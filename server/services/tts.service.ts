/**
 * Text-to-Speech Service
 * Supports OpenAI TTS for high-quality voice synthesis
 */

import OpenAI from 'openai';
import { Readable } from 'stream';

interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  speed?: number; // 0.25 to 4.0
}

class TTSService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('[TTS] OpenAI TTS initialized');
    } else {
      console.log('[TTS] OpenAI API key not configured - TTS disabled');
    }
  }

  isAvailable(): boolean {
    return !!this.openai;
  }

  /**
   * Generate speech from text using OpenAI TTS
   * Returns audio buffer (MP3 format)
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<Buffer> {
    if (!this.openai) {
      throw new Error('OpenAI TTS not configured');
    }

    try {
      const {
        voice = 'nova', // Nova is warm and friendly
        model = 'tts-1', // Use tts-1-hd for higher quality
        speed = 0.9, // Slightly slower for natural conversation
      } = options;

      console.log(`[TTS] Synthesizing: "${text.substring(0, 50)}..." with voice ${voice}`);

      const response = await this.openai.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
      });

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      console.log(`[TTS] Generated ${buffer.length} bytes of audio`);

      return buffer;
    } catch (error: any) {
      console.error('[TTS] Synthesis error:', error.message);
      throw error;
    }
  }

  /**
   * Get available voice options
   */
  getAvailableVoices() {
    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
      { id: 'echo', name: 'Echo', description: 'Male, clear and direct' },
      { id: 'fable', name: 'Fable', description: 'British accent, warm' },
      { id: 'onyx', name: 'Onyx', description: 'Deep and authoritative' },
      { id: 'nova', name: 'Nova', description: 'Female, warm and friendly (recommended)' },
      { id: 'shimmer', name: 'Shimmer', description: 'Female, bright and energetic' },
    ];
  }
}

export const ttsService = new TTSService();
