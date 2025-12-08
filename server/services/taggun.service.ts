interface TaggunStatus {
  configured: boolean;
  connected: boolean;
  message: string;
}

interface ProcessedReceipt {
  id: string;
  projectId: number;
  amount: number;
  merchant: string;
  date: string;
  category: string;
  confidence: number;
  status: 'pending' | 'processed' | 'error';
}

class TaggunService {
  private apiKey: string | undefined;

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
      connected: configured, // For now, assume connected if configured
      message: configured
        ? 'Taggun is configured and ready'
        : 'Taggun API key not configured. Set TAGGUN_API_KEY environment variable.',
    };
  }

  /**
   * Get all receipts for a project
   */
  async getProjectReceipts(projectId: number): Promise<ProcessedReceipt[]> {
    // TODO: Implement actual database query or Taggun API call
    // For now, return empty array
    return [];
  }

  /**
   * Scan a receipt using Taggun API
   */
  async scanReceipt(file: Buffer, projectId: number): Promise<ProcessedReceipt> {
    if (!this.isConfigured()) {
      throw new Error('Taggun API key not configured');
    }

    // TODO: Implement actual Taggun API integration
    // This is a placeholder implementation
    throw new Error('Receipt scanning not yet implemented');
  }
}

export const taggunService = new TaggunService();
export { ProcessedReceipt, TaggunStatus };
