// server/routes/tts.routes.ts

import { Router, Request, Response } from 'express';
import { isAuthenticated, AuthenticatedRequest } from '../middleware/auth.middleware';
import { ttsService } from '../services/tts.service';

const router = Router();

/**
 * POST /api/tts/synthesize
 * Generate speech audio from text
 */
router.post(
  '/synthesize',
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text, voice, model, speed } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Text is required',
        });
      }

      if (!ttsService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'TTS service not available',
        });
      }

      // Generate audio
      const audioBuffer = await ttsService.synthesize(text, {
        voice,
        model,
        speed,
      });

      // Return audio as MP3
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });

      res.send(audioBuffer);
    } catch (error: any) {
      console.error('[TTSRoutes] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to synthesize speech',
      });
    }
  }
);

/**
 * GET /api/tts/voices
 * Get available voice options
 */
router.get(
  '/voices',
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const voices = ttsService.getAvailableVoices();

      res.json({
        success: true,
        data: {
          available: ttsService.isAvailable(),
          voices,
        },
      });
    } catch (error: any) {
      console.error('[TTSRoutes] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get voices',
      });
    }
  }
);

export default router;
