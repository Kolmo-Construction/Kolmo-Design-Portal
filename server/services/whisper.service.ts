// server/services/whisper.service.ts

/**
 * Whisper Service
 * Handles speech-to-text transcription using OpenAI Whisper API
 */

import OpenAI from 'openai';
import * as fs from 'fs';

class WhisperService {
  private client: OpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('[WhisperService] OpenAI API key not configured');
      return;
    }

    this.client = new OpenAI({ apiKey });
    this.initialized = true;
    console.log('[WhisperService] Initialized successfully');
  }

  /**
   * Transcribe audio file to text
   * @param audioFilePath Path to the audio file on disk
   * @returns Transcribed text
   */
  async transcribe(audioFilePath: string): Promise<string> {
    if (!this.initialized || !this.client) {
      throw new Error('Whisper service not initialized');
    }

    try {
      // Verify file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      const audioFile = fs.createReadStream(audioFilePath);

      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en', // Optional: specify language for better accuracy
        response_format: 'text',
      });

      console.log('[WhisperService] Transcription successful');
      return transcription;
    } catch (error: any) {
      console.error('[WhisperService] Transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export const whisperService = new WhisperService();
