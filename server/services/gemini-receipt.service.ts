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
   * Analyze construction photo and generate caption + insights
   * @param imageSource - Either a URL string or a Buffer containing the image
   * @param projectContext - Optional project context for better analysis
   */
  async analyzeConstructionPhoto(imageSource: string | Buffer, projectContext?: string, filename?: string): Promise<{
    caption: string;
    detectedElements: string[];
    workStatus: string;
    suggestedTags: string[];
    extractedInfo?: {
      projectType?: string;
      dimensions?: string;
      materials?: string;
      scopeSummary?: string;
    };
  }> {
    if (!this.isConfigured()) {
      return {
        caption: 'Construction site photo',
        detectedElements: [],
        workStatus: 'Photo uploaded',
        suggestedTags: [],
      };
    }

    try {
      let imageBuffer: Buffer;
      let mimeType: string;

      // Handle both URL and Buffer inputs
      if (Buffer.isBuffer(imageSource)) {
        imageBuffer = imageSource;
        // Determine mime type from filename if provided
        mimeType = filename ? this.getContentType(filename) : 'image/jpeg';
      } else {
        // Fetch image from URL
        const response = await fetch(imageSource);
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        // Determine mime type from URL
        const ext = imageSource.split('.').pop()?.toLowerCase() || 'jpg';
        mimeType = this.getContentType(`file.${ext}`);
      }

      const base64Image = imageBuffer.toString('base64');

      const contextPrompt = projectContext
        ? `PROJECT CONTEXT: ${projectContext}\n\n`
        : '';

      const prompt = `${contextPrompt}You are an expert construction analyst. Analyze this construction/renovation site photo in detail and extract ALL relevant information.

CRITICAL: Estimate dimensions and measurements whenever possible - this is ESSENTIAL for quotes!

FOCUS AREAS:
- Identify the EXACT type of work (e.g., kitchen remodel, deck construction, bathroom renovation, landscaping)
- ESTIMATE DIMENSIONS: Size of deck, room dimensions, square footage, linear footage
- Describe current state: what's visible, what's completed, what's in progress
- Note materials, finishes, and quality indicators
- Identify any equipment, tools, or safety measures visible
- Assess the scope and complexity of work shown
- Note specific features, fixtures, or design elements
- Identify any potential issues or areas of concern

PROVIDE:
1. **Caption**: A detailed 2-3 sentence professional description. MUST include:
   - EXACT project type (be specific: "deck construction", "kitchen remodel", NOT just "renovation")
   - ESTIMATED DIMENSIONS (e.g., "approximately 12x16 feet", "roughly 200 sq ft")
   - Current condition and materials visible
   - Notable features

2. **Detected Elements**: Comprehensive list including dimensions (15-20 items)
   Examples: "12x16 deck frame", "pressure-treated lumber", "composite decking", "metal post brackets", "approximately 200 sq ft", "granite countertops", "custom cabinets"

3. **Work Status**: Brief assessment of the project stage
   Examples: "Pre-construction - existing conditions", "Demolition in progress", "Framing complete", "Finish work in progress", "Near completion"

4. **Suggested Tags**: 5-7 relevant categorization tags
   Examples: "deck", "construction", "outdoor", "12x16", "pressure-treated", "new-build"

5. **Extracted Info**: Quote-relevant structured data
   - projectType: Specific type (e.g., "deck construction", "kitchen remodel")
   - dimensions: Estimated size (e.g., "12x16 feet", "200 square feet")
   - materials: Primary materials visible
   - scopeSummary: Brief scope description

Respond in JSON format:
{
  "caption": "Detailed professional caption with dimensions...",
  "detectedElements": ["12x16 deck frame", "element2", "element3", ...],
  "workStatus": "Current stage assessment",
  "suggestedTags": ["tag1", "tag2", "tag3", ...],
  "extractedInfo": {
    "projectType": "deck construction",
    "dimensions": "12x16 feet",
    "materials": "pressure-treated lumber, composite decking",
    "scopeSummary": "New deck construction with composite decking"
  }
}`;

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

      const text = result.response.text();

      // Parse JSON response (handle markdown code blocks)
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const analysis = JSON.parse(jsonText);

      return {
        caption: analysis.caption || 'Construction site photo',
        detectedElements: analysis.detectedElements || [],
        workStatus: analysis.workStatus || 'Work in progress',
        suggestedTags: analysis.suggestedTags || [],
        extractedInfo: analysis.extractedInfo || {},
      };
    } catch (error) {
      console.error('[GeminiReceipt] Error analyzing construction photo:', error);
      return {
        caption: 'Construction site photo',
        detectedElements: [],
        workStatus: 'Photo uploaded',
        suggestedTags: [],
        extractedInfo: {},
      };
    }
  }

  /**
   * Generate project status update from multiple photos
   */
  async generateProjectUpdate(
    photos: Array<{ url: string; caption?: string }>,
    projectDetails: { name: string; description?: string }
  ): Promise<string> {
    if (!this.isConfigured() || photos.length === 0) {
      return `${photos.length} photos uploaded for ${projectDetails.name}`;
    }

    try {
      const prompt = `Based on ${photos.length} construction photos for project "${projectDetails.name}", generate a brief project status update (2-3 sentences).

Photos show:
${photos.map((p, i) => `${i + 1}. ${p.caption || 'Construction photo'}`).join('\n')}

${projectDetails.description ? `Project context: ${projectDetails.description}` : ''}

Generate a concise status update suitable for project reporting. Focus on what work has been completed or is in progress.`;

      const model = genAI.getGenerativeModel({ model: this.MODEL });
      const result = await model.generateContent(prompt);

      return result.response.text().trim();
    } catch (error) {
      console.error('[GeminiReceipt] Error generating project update:', error);
      return `${photos.length} new photos uploaded showing project progress for ${projectDetails.name}`;
    }
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
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'image/jpeg'; // Default to jpeg for unknown image types
    }
  }
}

export const geminiReceiptService = new GeminiReceiptService();
export { ProcessedReceipt, GeminiReceiptStatus };
