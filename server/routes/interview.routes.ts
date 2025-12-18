// server/routes/interview.routes.ts

import { Router, Request, Response } from 'express';
import { isAuthenticated, AuthenticatedRequest } from '../middleware/auth.middleware';
import { hasRole } from '../middleware/role.middleware';
import { interviewService } from '../services/interview.service';
import { whisperService } from '../services/whisper.service';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Configure multer for audio uploads
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'audio');
      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      cb(null, `audio_${uniqueSuffix}.m4a`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// Configure multer for image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(), // Store in memory for R2 upload
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/interview/start
 * Start a new interview session or resume existing active session
 */
router.post(
  '/start',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { leadId, initialData } = req.body;
      const userId = req.user!.id;

      const result = await interviewService.startSession(userId, leadId, initialData);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error starting session:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start interview session',
      });
    }
  }
);

/**
 * POST /api/interview/:sessionId/turn
 * Submit a turn in the interview (text input)
 */
router.post(
  '/:sessionId/turn',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { input, audioUri } = req.body;

      if (!input || typeof input !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Input is required',
        });
      }

      const result = await interviewService.processTurn(
        parseInt(sessionId),
        input,
        audioUri
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error processing turn:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process interview turn',
      });
    }
  }
);

/**
 * POST /api/interview/:sessionId/turn-voice
 * Submit a turn with voice input (audio file upload)
 */
router.post(
  '/:sessionId/turn-voice',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  audioUpload.single('audio'),
  async (req: AuthenticatedRequest, res: Response) => {
    let filePath: string | undefined;

    try {
      const { sessionId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Audio file is required',
        });
      }

      filePath = req.file.path;

      // Check if Whisper service is initialized
      if (!whisperService.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: 'Speech-to-text service is not available',
        });
      }

      console.log('[InterviewRoutes] Transcribing audio file:', filePath);

      // Transcribe audio to text
      const transcribedText = await whisperService.transcribe(filePath);

      console.log('[InterviewRoutes] Transcription result:', transcribedText);

      // Process the turn with the transcribed text
      const result = await interviewService.processTurn(
        parseInt(sessionId),
        transcribedText,
        req.file.filename // Store audio filename reference
      );

      res.json({
        success: true,
        data: {
          ...result,
          transcribedText,
        },
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error processing voice turn:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process voice input',
      });
    } finally {
      // Clean up uploaded file
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('[InterviewRoutes] Cleaned up audio file:', filePath);
        } catch (cleanupError) {
          console.error('[InterviewRoutes] Error cleaning up audio file:', cleanupError);
        }
      }
    }
  }
);

/**
 * GET /api/interview/:sessionId
 * Get interview session details
 */
router.get(
  '/:sessionId',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      const result = await interviewService.getSession(parseInt(sessionId));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error fetching session:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch session',
      });
    }
  }
);

/**
 * POST /api/interview/:sessionId/create-quote
 * Create a quote from completed session
 */
router.post(
  '/:sessionId/create-quote',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.id;

      const quote = await interviewService.createQuoteFromSession(
        parseInt(sessionId),
        userId
      );

      res.json({
        success: true,
        data: { quote },
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error creating quote:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create quote from session',
      });
    }
  }
);

/**
 * POST /api/interview/:sessionId/abandon
 * Abandon an interview session
 */
router.post(
  '/:sessionId/abandon',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { interviewRepository } = await import('../storage/repositories/interview.repository');

      const session = await interviewRepository.abandonSession(parseInt(sessionId));

      res.json({
        success: true,
        data: { session },
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error abandoning session:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to abandon session',
      });
    }
  }
);

/**
 * POST /api/interview/:sessionId/upload-image
 * Upload and analyze an image during the interview
 */
router.post(
  '/:sessionId/upload-image',
  isAuthenticated,
  hasRole(['admin', 'project_manager']),
  imageUpload.single('image'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Image file is required',
        });
      }

      console.log('[InterviewRoutes] Processing image upload for session:', sessionId);
      console.log('[InterviewRoutes] File info:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      const result = await interviewService.uploadAndAnalyzeImage(
        parseInt(sessionId),
        req.file.buffer,
        req.file.originalname
      );

      console.log('[InterviewRoutes] Image upload successful');

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[InterviewRoutes] Error uploading image:', error);
      console.error('[InterviewRoutes] Error stack:', error.stack);
      console.error('[InterviewRoutes] Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload and analyze image',
      });
    }
  }
);

export default router;
