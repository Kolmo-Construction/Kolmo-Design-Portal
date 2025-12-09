import axios from 'axios';
import FormData from 'form-data';

interface TaggunStatus {
  configured: boolean;
  connected: boolean;
  message: string;
}

interface TaggunResponse {
  totalAmount?: {
    data?: number;
  };
  amounts?: Array<{
    data?: number;
  }>;
  merchantName?: {
    data?: string;
    confidenceLevel?: number;
  };
  date?: {
    data?: string;
    confidenceLevel?: number;
  };
  entities?: {
    merchant?: {
      data?: string;
      confidenceLevel?: number;
    };
  };
  confidenceLevel?: number;
}

interface ProcessedReceipt {
  vendorName: string | null;
  totalAmount: number | null;
  receiptDate: Date | null;
  currency: string;
  ocrData: any;
  ocrConfidence: number;
}

interface TaggunScanResult extends ProcessedReceipt {
  success: boolean;
  error?: string;
}

class TaggunService {
  private apiKey: string | undefined;
  private apiUrl = 'https://api.taggun.io/api/receipt/v1/verbose/file';

  constructor() {
    this.apiKey = process.env.TAGGUN_API_KEY;
  }

  /**
   * Check if Taggun is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get Taggun configuration and connection status
   */
  getStatus(): TaggunStatus {
    const configured = this.isConfigured();

    return {
      configured,
      connected: configured,
      message: configured
        ? 'Taggun is configured and ready'
        : 'Taggun API key not configured. Set TAGGUN_API_KEY environment variable.',
    };
  }

  /**
   * Scan a receipt using Taggun API
   * @param imageBuffer - Image file buffer
   * @param filename - Original filename for content type detection
   * @returns Processed receipt data
   */
  async scanReceipt(imageBuffer: Buffer, filename: string): Promise<TaggunScanResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Taggun API key not configured',
        vendorName: null,
        totalAmount: null,
        receiptDate: null,
        currency: 'USD',
        ocrData: null,
        ocrConfidence: 0,
      };
    }

    try {
      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename,
        contentType: this.getContentType(filename),
      });

      // Make API request to Taggun
      const response = await axios.post<TaggunResponse>(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'apikey': this.apiKey!,
          'Accept': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      });

      // Parse response
      const data = response.data;

      // Extract vendor name (try multiple fields)
      const vendorName = data.merchantName?.data ||
                        data.entities?.merchant?.data ||
                        null;

      // Extract total amount
      const totalAmount = data.totalAmount?.data ||
                         (data.amounts && data.amounts.length > 0 ? data.amounts[0].data : null) ||
                         null;

      // Extract date
      let receiptDate: Date | null = null;
      if (data.date?.data) {
        try {
          receiptDate = new Date(data.date.data);
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
      if (data.merchantName?.confidenceLevel) confidences.push(data.merchantName.confidenceLevel);
      if (data.date?.confidenceLevel) confidences.push(data.date.confidenceLevel);
      if (data.confidenceLevel) confidences.push(data.confidenceLevel);

      const avgConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

      return {
        success: true,
        vendorName,
        totalAmount,
        receiptDate,
        currency: 'USD', // Taggun doesn't always return currency, default to USD
        ocrData: data, // Store full response
        ocrConfidence: Math.round(avgConfidence * 100) / 100, // Round to 2 decimals
      };

    } catch (error: any) {
      console.error('[Taggun] Error scanning receipt:', error.message);

      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          return {
            success: false,
            error: 'Invalid Taggun API key',
            vendorName: null,
            totalAmount: null,
            receiptDate: null,
            currency: 'USD',
            ocrData: null,
            ocrConfidence: 0,
          };
        } else if (status === 429) {
          return {
            success: false,
            error: 'Taggun API rate limit exceeded',
            vendorName: null,
            totalAmount: null,
            receiptDate: null,
            currency: 'USD',
            ocrData: null,
            ocrConfidence: 0,
          };
        }
      }

      return {
        success: false,
        error: error.message || 'Failed to scan receipt',
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

export const taggunService = new TaggunService();
export { ProcessedReceipt, TaggunStatus };
