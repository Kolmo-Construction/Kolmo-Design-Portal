import { db } from "../db";
import { customerQuotes, quoteLineItems, quoteImages, quoteBeforeAfterPairs } from "@shared/schema";
import type { 
  CustomerQuote, 
  InsertCustomerQuote,
  QuoteLineItem, 
  InsertQuoteLineItem,
  QuoteImage,
  InsertQuoteImage,
  QuoteBeforeAfterPair,
  InsertQuoteBeforeAfterPair
} from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";

export class QuoteStorage {
  // Quotes
  async createQuote(data: any): Promise<CustomerQuote> {
    // Generate unique quote number
    const year = new Date().getFullYear();
    const allQuotes = await db
      .select({ quoteNumber: customerQuotes.quoteNumber })
      .from(customerQuotes)
      .orderBy(desc(customerQuotes.id));
    
    // Find the highest number for the current year
    let quoteCounter = 1;
    const yearPrefix = `Q-${year}-`;
    for (const quote of allQuotes) {
      if (quote.quoteNumber.startsWith(yearPrefix)) {
        const numberPart = quote.quoteNumber.replace(yearPrefix, '');
        const currentNumber = parseInt(numberPart);
        if (currentNumber >= quoteCounter) {
          quoteCounter = currentNumber + 1;
        }
      }
    }
    
    const quoteNumber = `Q-${year}-${quoteCounter.toString().padStart(3, '0')}`;
    
    // Generate magic token for customer access
    const magicToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Extract line items for separate handling
    const { lineItems, ...quoteData } = data;
    
    // Convert string dates to Date objects for proper database handling
    const processedData = { 
      ...quoteData, 
      quoteNumber,
      magicToken
    };
    
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
      .values(processedData)
      .returning();

    // Create line items if provided
    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        await this.createLineItem({
          quoteId: quote.id,
          ...item
        });
      }
    }

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
    
    if (!quote) return null;
    
    // Fetch related line items
    const lineItems = await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, id))
      .orderBy(quoteLineItems.id);
    
    return {
      ...quote,
      lineItems
    } as any;
  }

  async getQuoteByMagicToken(token: string): Promise<CustomerQuote | null> {
    const [quote] = await db
      .select()
      .from(customerQuotes)
      .where(eq(customerQuotes.magicToken, token));
    
    if (!quote) return null;
    
    // Fetch related line items
    const lineItems = await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quote.id))
      .orderBy(quoteLineItems.id);
    
    return {
      ...quote,
      lineItems
    } as any;
  }

  async getQuoteByToken(token: string): Promise<CustomerQuote | null> {
    return this.getQuoteByMagicToken(token);
  }

  async updateQuote(id: number, data: Partial<InsertCustomerQuote & { lineItems?: any[] }>): Promise<CustomerQuote | null> {
    // Extract line items from the data
    const { lineItems, ...quoteData } = data;
    
    // Convert string dates to Date objects for proper database handling
    const processedData: any = { ...quoteData };
    
    // Handle date fields specifically
    const dateFields = ['validUntil', 'estimatedStartDate', 'estimatedCompletionDate'] as const;
    dateFields.forEach(field => {
      if (processedData[field]) {
        if (typeof processedData[field] === 'string') {
          processedData[field] = new Date(processedData[field]);
        }
      }
    });

    // Handle numeric fields - remove empty strings and undefined values to prevent database errors
    const numericFields = [
      'subtotal', 'discountPercentage', 'discountAmount', 'taxPercentage', 
      'taxableAmount', 'taxAmount', 'totalAmount', 'downPaymentPercentage', 
      'milestonePaymentPercentage', 'finalPaymentPercentage', 'creditCardProcessingFee'
    ] as const;
    
    numericFields.forEach(field => {
      if (processedData[field] === '' || processedData[field] === undefined || processedData[field] === null) {
        delete processedData[field];
      }
    });

    // Update the quote
    const updateData = { ...processedData, updatedAt: new Date() };
    const [quote] = await db
      .update(customerQuotes)
      .set(updateData)
      .where(eq(customerQuotes.id, id))
      .returning();

    // Handle line items if provided
    if (lineItems && Array.isArray(lineItems)) {
      // Delete existing line items
      await db
        .delete(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, id));

      // Insert new line items
      if (lineItems.length > 0) {
        const lineItemsToInsert = lineItems.map(item => ({
          quoteId: id,
          category: item.category || '',
          description: item.description || '',
          quantity: item.quantity || '1',
          unit: item.unit || '',
          unitPrice: item.unitPrice || '0',
          discountPercentage: item.discountPercentage || '0',
          totalPrice: item.totalPrice || '0'
        }));

        await db.insert(quoteLineItems).values(lineItemsToInsert);
      }
    }

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

  // Before/After Pairs
  async createBeforeAfterPair(data: InsertQuoteBeforeAfterPair): Promise<QuoteBeforeAfterPair> {
    const [pair] = await db
      .insert(quoteBeforeAfterPairs)
      .values(data)
      .returning();
    return pair;
  }

  async getBeforeAfterPairsByQuoteId(quoteId: number): Promise<QuoteBeforeAfterPair[]> {
    return await db
      .select()
      .from(quoteBeforeAfterPairs)
      .where(eq(quoteBeforeAfterPairs.quoteId, quoteId))
      .orderBy(asc(quoteBeforeAfterPairs.sortOrder));
  }

  async getBeforeAfterPairById(id: number): Promise<QuoteBeforeAfterPair | null> {
    const [pair] = await db
      .select()
      .from(quoteBeforeAfterPairs)
      .where(eq(quoteBeforeAfterPairs.id, id));
    return pair || null;
  }

  async updateBeforeAfterPair(id: number, data: Partial<InsertQuoteBeforeAfterPair>): Promise<QuoteBeforeAfterPair | null> {
    const [pair] = await db
      .update(quoteBeforeAfterPairs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quoteBeforeAfterPairs.id, id))
      .returning();
    return pair || null;
  }

  async deleteBeforeAfterPair(id: number): Promise<boolean> {
    const result = await db
      .delete(quoteBeforeAfterPairs)
      .where(eq(quoteBeforeAfterPairs.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteBeforeAfterPairsByQuoteId(quoteId: number): Promise<boolean> {
    const result = await db
      .delete(quoteBeforeAfterPairs)
      .where(eq(quoteBeforeAfterPairs.quoteId, quoteId));
    return (result.rowCount ?? 0) >= 0;
  }

  async reorderBeforeAfterPairs(quoteId: number, pairIds: number[]): Promise<boolean> {
    try {
      for (let i = 0; i < pairIds.length; i++) {
        await db
          .update(quoteBeforeAfterPairs)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(quoteBeforeAfterPairs.id, pairIds[i]));
      }
      return true;
    } catch (error) {
      console.error('Error reordering before/after pairs:', error);
      return false;
    }
  }

  // Combined operations
  async getQuoteWithDetails(id: number): Promise<(CustomerQuote & { lineItems: QuoteLineItem[], images: QuoteImage[], beforeAfterPairs: QuoteBeforeAfterPair[] }) | null> {
    const quote = await this.getQuoteById(id);
    if (!quote) return null;

    const [lineItems, images, beforeAfterPairs] = await Promise.all([
      this.getLineItemsByQuoteId(id),
      this.getImagesByQuoteId(id),
      this.getBeforeAfterPairsByQuoteId(id)
    ]);

    return { ...quote, lineItems, images, beforeAfterPairs };
  }

  async getQuoteWithDetailsByToken(token: string): Promise<(CustomerQuote & { lineItems: QuoteLineItem[], images: QuoteImage[], beforeAfterPairs: QuoteBeforeAfterPair[] }) | null> {
    const quote = await this.getQuoteByMagicToken(token);
    if (!quote) return null;

    const [lineItems, images, beforeAfterPairs] = await Promise.all([
      this.getLineItemsByQuoteId(quote.id),
      this.getImagesByQuoteId(quote.id),
      this.getBeforeAfterPairsByQuoteId(quote.id)
    ]);

    return { ...quote, lineItems, images, beforeAfterPairs };
  }
}

export const quoteStorage = new QuoteStorage();