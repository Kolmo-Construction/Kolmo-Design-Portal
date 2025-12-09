import express, { Request, Response } from 'express';
import { db } from '../db';
import { chatMessages, chatAttachments } from '@shared/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import OpenAI from 'openai';
import multer from 'multer';
import { uploadToR2 } from '../r2-upload';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY,
});

// Schema for chat message creation
const createChatMessageSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

// POST /api/chat/upload - Upload file attachments
router.post('/upload', upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { messageId } = req.body;
    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required' });
    }

    // Verify that the message exists
    const [message] = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Upload each file to R2 and save metadata
    const attachments = await Promise.all(
      files.map(async (file) => {
        // Upload to R2
        const { url, key } = await uploadToR2({
          fileName: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype,
          path: 'chat-attachments/',
        });

        // Save metadata to database
        const [attachment] = await db.insert(chatAttachments).values({
          messageId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          storageKey: key,
          url,
        }).returning();

        return attachment;
      })
    );

    res.status(201).json({ attachments });
  } catch (error) {
    console.error('Error uploading chat attachments:', error);
    res.status(500).json({
      error: 'Failed to upload attachments',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/chat - Save chat message (without embedding)
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('Received chat message request:', req.body);
    const { sessionId, role, content } = createChatMessageSchema.parse(req.body);
    console.log('Validated data:', { sessionId, role, content });

    const [message] = await db.insert(chatMessages).values({
      sessionId,
      role,
      content,
      isVerified: false,
      embedding: null,
    }).returning();

    console.log('Saved message:', message);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error saving chat message:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    res.status(400).json({ error: 'Failed to save chat message', details: error instanceof Error ? error.message : String(error) });
  }
});

// POST /api/chat/:messageId/verify - Generate embedding and mark as verified
router.post('/:messageId/verify', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    // Fetch the message
    const [message] = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.isVerified) {
      return res.status(400).json({ error: 'Message already verified' });
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message.content,
      encoding_format: 'float',
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Update the message with embedding and mark as verified
    const [updatedMessage] = await db.update(chatMessages)
      .set({
        isVerified: true,
        embedding: embedding,
      })
      .where(eq(chatMessages.id, messageId))
      .returning();

    res.json(updatedMessage);
  } catch (error) {
    console.error('Error verifying chat message:', error);
    res.status(500).json({ error: 'Failed to verify chat message' });
  }
});

// GET /api/chat/:messageId/attachments - Get attachments for a message
router.get('/:messageId/attachments', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    const attachments = await db.select()
      .from(chatAttachments)
      .where(eq(chatAttachments.messageId, messageId));

    res.json({ attachments });
  } catch (error) {
    console.error('Error fetching chat attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// GET /api/chat/session/:sessionId - Get chat history for a session with pagination
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get total count for pagination metadata
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId));

    // Fetch messages with pagination, ordered by most recent first
    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch attachments for all messages
    const messageIds = messages.map(m => m.id);
    const attachments = messageIds.length > 0
      ? await db.select()
          .from(chatAttachments)
          .where(sql`${chatAttachments.messageId} = ANY(${messageIds})`)
      : [];

    // Group attachments by message ID
    const attachmentsByMessage = attachments.reduce((acc, attachment) => {
      if (!acc[attachment.messageId]) {
        acc[attachment.messageId] = [];
      }
      acc[attachment.messageId].push(attachment);
      return acc;
    }, {} as Record<string, typeof attachments>);

    // Add attachments to messages
    const messagesWithAttachments = messages.map(message => ({
      ...message,
      attachments: attachmentsByMessage[message.id] || [],
    }));

    res.json({
      messages: messagesWithAttachments,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + messages.length < count,
      },
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

export default router;
