/**
 * Gemini-powered Receipt OCR Service
 * Uses Google Gemini 2.0 Flash to extract receipt data
 * Returns data in the same format as Taggun for compatibility
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface GeminiReceiptStatus {
  configured: boolean;
  connected: boolean;
  message: string;
}

interface ProcessedReceipt {
  vendorName: string | null;
  totalAmount: number | null;
  receiptDate: Date | null;
  currency: string;
  ocrData: any;
  ocrConfidence: number;
}

interface GeminiScanResult extends ProcessedReceipt {
  success: boolean;
  error?: string;
}

class GeminiReceiptService {
  private readonly MODEL = 'gemini-2.0-flash-exp';

  /**
   * Check if Gemini is configured
   */
  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  /**
   * Get Gemini configuration and connection status
   */
  getStatus(): GeminiReceiptStatus {
    const configured = this.isConfigured();

    return {
      configured,
      connected: configured,
      message: configured
        ? 'Gemini is configured and ready for receipt OCR'
        : 'Gemini API key not configured. Set GEMINI_API_KEY environment variable.',
    };
  }

  /**
   * Scan a receipt using Gemini API
   * Returns data in Taggun-compatible format
   * @param imageBuffer - Image file buffer
   * @param filename - Original filename for content type detection
   * @returns Processed receipt data in Taggun format
   */
  async scanReceipt(imageBuffer: Buffer, filename: string): Promise<GeminiScanResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Gemini API key not configured',
        vendorName: null,
        totalAmount: null,
        receiptDate: null,
        currency: 'USD',
        ocrData: null,
        ocrConfidence: 0,
      };
    }

    try {
      console.log('[GeminiReceipt] Starting receipt scan with Gemini 2.0...');

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getContentType(filename);

      // Build the prompt - force strict JSON output in Taggun format
      const prompt = `You are an expert receipt OCR system. Analyze this receipt image and extract the following information.

IMPORTANT: Respond ONLY with valid JSON in this EXACT format (no markdown, no explanations):

{
  "merchantName": {
    "data": "Vendor name as shown on receipt",
    "confidenceLevel": 0.95
  },
  "totalAmount": {
    "data": 123.45
  },
  "date": {
    "data": "2025-12-09",
    "confidenceLevel": 0.90
  },
  "confidenceLevel": 0.92
}

EXTRACTION RULES:
1. merchantName.data: Extract the business/vendor name (e.g., "Home Depot", "Starbucks", "Shell")
2. totalAmount.data: Extract the final total amount as a number (e.g., 123.45, not "$123.45")
3. date.data: Extract the receipt date in YYYY-MM-DD format
4. confidenceLevel: Your overall confidence in the extraction (0.0 to 1.0)
5. Each field's confidenceLevel: Your confidence in that specific field (0.0 to 1.0)

If you cannot find a field, use null for the data value and set confidenceLevel to 0.0.

Example responses:

Good receipt (clear):
{
  "merchantName": {"data": "Walmart", "confidenceLevel": 0.98},
  "totalAmount": {"data": 45.67},
  "date": {"data": "2025-12-08", "confidenceLevel": 0.95},
  "confidenceLevel": 0.97
}

Unclear receipt:
{
  "merchantName": {"data": "ABC Store", "confidenceLevel": 0.60},
  "totalAmount": {"data": null},
  "date": {"data": null, "confidenceLevel": 0.0},
  "confidenceLevel": 0.40
}

Now analyze the receipt and respond with ONLY the JSON (no markdown, no code blocks, no explanations):`;

      // Call Gemini API
      const model = genAI.getGenerativeModel({ model: this.MODEL });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ]);

      const response = result.response;
      const text = response.text();

      console.log('[GeminiReceipt] Received response from Gemini');
      console.log('[GeminiReceipt] Raw response (first 500 chars):', text.substring(0, 500));

      // Parse the response
      const parsedData = this.parseGeminiResponse(text);

      // Convert to Taggun format
      const taggunFormat = this.convertToTaggunFormat(parsedData);

      console.log('[GeminiReceipt] Successfully extracted receipt data:', {
        vendor: taggunFormat.vendorName,
        amount: taggunFormat.totalAmount,
        confidence: taggunFormat.ocrConfidence,
      });

      return {
        success: true,
        ...taggunFormat,
      };

    } catch (error: any) {
      console.error('[GeminiReceipt] Error scanning receipt:', error.message);
      console.error('[GeminiReceipt] Full error:', error);

      return {
        success: false,
        error: error.message || 'Failed to scan receipt with Gemini',
        vendorName: null,
        totalAmount: null,
        receiptDate: null,
        currency: 'USD',
        ocrData: null,
        ocrConfidence: 0,
      };
    }
  }

  /**
   * Parse Gemini's response and extract JSON
   */
  private parseGeminiResponse(text: string): any {
    try {
      // Try to extract JSON from the response
      let jsonText = text.trim();

      // Remove markdown code blocks if present
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
        console.log('[GeminiReceipt] Extracted JSON from code block');
      }

      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText);
      console.log('[GeminiReceipt] Successfully parsed JSON response');

      return parsed;
    } catch (error) {
      console.error('[GeminiReceipt] Failed to parse Gemini response as JSON:', error);
      console.error('[GeminiReceipt] Raw text:', text);

      // Return empty structure if parsing fails
      return {
        merchantName: { data: null, confidenceLevel: 0 },
        totalAmount: { data: null },
        date: { data: null, confidenceLevel: 0 },
        confidenceLevel: 0,
      };
    }
  }

  /**
   * Convert Gemini response to Taggun-compatible format
   */
  private convertToTaggunFormat(geminiData: any): ProcessedReceipt {
    // Extract vendor name
    const vendorName = geminiData.merchantName?.data || null;

    // Extract total amount
    const totalAmount = geminiData.totalAmount?.data || null;

    // Extract and parse date
    let receiptDate: Date | null = null;
    if (geminiData.date?.data) {
      try {
        receiptDate = new Date(geminiData.date.data);
        // Validate date
        if (isNaN(receiptDate.getTime())) {
          receiptDate = null;
        }
      } catch (e) {
        receiptDate = null;
      }
    }

    // Calculate average confidence
    const confidences: number[] = [];
    if (geminiData.merchantName?.confidenceLevel) {
      confidences.push(geminiData.merchantName.confidenceLevel);
    }
    if (geminiData.date?.confidenceLevel) {
      confidences.push(geminiData.date.confidenceLevel);
    }
    if (geminiData.confidenceLevel) {
      confidences.push(geminiData.confidenceLevel);
    }

    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    return {
      vendorName,
      totalAmount,
      receiptDate,
      currency: 'USD', // Default to USD (can be enhanced later)
      ocrData: geminiData, // Store full Gemini response in same field as Taggun
      ocrConfidence: Math.round(avgConfidence * 100) / 100, // Round to 2 decimals
    };
  }

  /**
   * Get content type from filename
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}

export const geminiReceiptService = new GeminiReceiptService();
export { ProcessedReceipt, GeminiReceiptStatus };
