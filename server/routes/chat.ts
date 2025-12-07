import express, { Request, Response } from 'express';
import { db } from '../db';
import { chatMessages } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import OpenAI from 'openai';

const router = express.Router();

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY,
});

// Schema for chat message creation
const createChatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

// POST /api/chat - Save chat message (without embedding)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sessionId, role, content } = createChatMessageSchema.parse(req.body);

    const [message] = await db.insert(chatMessages).values({
      sessionId,
      role,
      content,
      isVerified: false,
      embedding: null,
    }).returning();

    res.status(201).json(message);
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(400).json({ error: 'Failed to save chat message' });
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

// GET /api/chat/session/:sessionId - Get chat history for a session
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt));

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

export default router;
