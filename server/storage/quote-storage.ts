import { db } from "../db";
import { customerQuotes, quoteLineItems, quoteImages } from "@shared/schema";
import type { 
  CustomerQuote, 
  InsertCustomerQuote,
  QuoteLineItem, 
  InsertQuoteLineItem,
  QuoteImage,
  InsertQuoteImage
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class QuoteStorage {
  // Quotes
  async createQuote(data: InsertCustomerQuote): Promise<CustomerQuote> {
    // Convert string dates to Date objects for proper database handling
    const processedData = { ...data };
    if (processedData.validUntil && typeof processedData.validUntil === 'string') {
      processedData.validUntil = new Date(processedData.validUntil);
    }
    if (processedData.estimatedStartDate && typeof processedData.estimatedStartDate === 'string') {
      processedData.estimatedStartDate = new Date(processedData.estimatedStartDate);
    }
    if (processedData.estimatedCompletionDate && typeof processedData.estimatedCompletionDate === 'string') {
      processedData.estimatedCompletionDate = new Date(processedData.estimatedCompletionDate);
    }

    const [quote] = await db
      .insert(customerQuotes)
      .values([processedData])
      .returning();
    return quote;
  }

  async getQuotes(): Promise<CustomerQuote[]> {
    return await db
      .select()
      .from(customerQuotes)
      .orderBy(desc(customerQuotes.createdAt));
  }

  async getQuoteById(id: number): Promise<CustomerQuote | null> {
    const [quote] = await db
      .select()
      .from(customerQuotes)
      .where(eq(customerQuotes.id, id));
    return quote || null;
  }

  async getQuoteByMagicToken(token: string): Promise<CustomerQuote | null> {
    const [quote] = await db
      .select()
      .from(customerQuotes)
      .where(eq(customerQuotes.magicToken, token));
    return quote || null;
  }

  async updateQuote(id: number, data: Partial<InsertCustomerQuote>): Promise<CustomerQuote | null> {
    // Convert string dates to Date objects for proper database handling
    const processedData = { ...data };
    if (processedData.validUntil && typeof processedData.validUntil === 'string') {
      processedData.validUntil = new Date(processedData.validUntil);
    }
    if (processedData.estimatedStartDate && typeof processedData.estimatedStartDate === 'string') {
      processedData.estimatedStartDate = new Date(processedData.estimatedStartDate);
    }
    if (processedData.estimatedCompletionDate && typeof processedData.estimatedCompletionDate === 'string') {
      processedData.estimatedCompletionDate = new Date(processedData.estimatedCompletionDate);
    }

    const [quote] = await db
      .update(customerQuotes)
      .set({ ...processedData, updatedAt: new Date() })
      .where(eq(customerQuotes.id, id))
      .returning();
    return quote || null;
  }

  async deleteQuote(id: number): Promise<boolean> {
    const result = await db
      .delete(customerQuotes)
      .where(eq(customerQuotes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async markQuoteAsViewed(token: string): Promise<CustomerQuote | null> {
    const [quote] = await db
      .update(customerQuotes)
      .set({ 
        viewedAt: new Date(),
        status: 'viewed',
        updatedAt: new Date() 
      })
      .where(eq(customerQuotes.magicToken, token))
      .returning();
    return quote || null;
  }

  async respondToQuote(token: string, response: string, notes?: string): Promise<CustomerQuote | null> {
    const [quote] = await db
      .update(customerQuotes)
      .set({ 
        respondedAt: new Date(),
        customerResponse: response,
        customerNotes: notes,
        status: response === 'accepted' ? 'accepted' : 'declined',
        updatedAt: new Date() 
      })
      .where(eq(customerQuotes.magicToken, token))
      .returning();
    return quote || null;
  }

  // Line Items
  async createLineItem(data: InsertQuoteLineItem): Promise<QuoteLineItem> {
    const [lineItem] = await db
      .insert(quoteLineItems)
      .values(data)
      .returning();
    return lineItem;
  }

  async getLineItemsByQuoteId(quoteId: number): Promise<QuoteLineItem[]> {
    return await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId));
  }

  async updateLineItem(id: number, data: Partial<InsertQuoteLineItem>): Promise<QuoteLineItem | null> {
    const [lineItem] = await db
      .update(quoteLineItems)
      .set(data)
      .where(eq(quoteLineItems.id, id))
      .returning();
    return lineItem || null;
  }

  async deleteLineItem(id: number): Promise<boolean> {
    const result = await db
      .delete(quoteLineItems)
      .where(eq(quoteLineItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteLineItemsByQuoteId(quoteId: number): Promise<boolean> {
    const result = await db
      .delete(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId));
    return (result.rowCount ?? 0) >= 0; // Allow 0 items to be deleted
  }

  // Images
  async createImage(data: InsertQuoteImage): Promise<QuoteImage> {
    const [image] = await db
      .insert(quoteImages)
      .values(data)
      .returning();
    return image;
  }

  async getImagesByQuoteId(quoteId: number): Promise<QuoteImage[]> {
    return await db
      .select()
      .from(quoteImages)
      .where(eq(quoteImages.quoteId, quoteId));
  }

  async updateImage(id: number, data: Partial<InsertQuoteImage>): Promise<QuoteImage | null> {
    const [image] = await db
      .update(quoteImages)
      .set(data)
      .where(eq(quoteImages.id, id))
      .returning();
    return image || null;
  }

  async deleteImage(id: number): Promise<boolean> {
    const result = await db
      .delete(quoteImages)
      .where(eq(quoteImages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteImagesByQuoteId(quoteId: number): Promise<boolean> {
    const result = await db
      .delete(quoteImages)
      .where(eq(quoteImages.quoteId, quoteId));
    return (result.rowCount ?? 0) >= 0; // Allow 0 items to be deleted
  }

  // Combined operations
  async getQuoteWithDetails(id: number): Promise<(CustomerQuote & { lineItems: QuoteLineItem[], images: QuoteImage[] }) | null> {
    const quote = await this.getQuoteById(id);
    if (!quote) return null;

    const [lineItems, images] = await Promise.all([
      this.getLineItemsByQuoteId(id),
      this.getImagesByQuoteId(id)
    ]);

    return { ...quote, lineItems, images };
  }

  async getQuoteWithDetailsByToken(token: string): Promise<(CustomerQuote & { lineItems: QuoteLineItem[], images: QuoteImage[] }) | null> {
    const quote = await this.getQuoteByMagicToken(token);
    if (!quote) return null;

    const [lineItems, images] = await Promise.all([
      this.getLineItemsByQuoteId(quote.id),
      this.getImagesByQuoteId(quote.id)
    ]);

    return { ...quote, lineItems, images };
  }
}

export const quoteStorage = new QuoteStorage();