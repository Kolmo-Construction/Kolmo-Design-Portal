import { db } from "../../db";
import { 
  quotes, 
  quoteLineItems, 
  quoteMedia, 
  quoteResponses,
  quoteAccessTokens
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export class QuoteRepository {
  async getAllQuotes() {
    try {
      return await db
        .select()
        .from(quotes)
        .orderBy(desc(quotes.createdAt));
    } catch (error) {
      console.error("Error fetching quotes:", error);
      return [];
    }
  }

  async getQuoteById(id: number) {
    try {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, id));

      if (!quote) {
        return null;
      }

      // Get line items
      const lineItems = await db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, id))
        .orderBy(quoteLineItems.id);

      // Get responses
      const responses = await db
        .select()
        .from(quoteResponses)
        .where(eq(quoteResponses.quoteId, id))
        .orderBy(desc(quoteResponses.createdAt));

      return {
        ...quote,
        lineItems,
        responses
      };
    } catch (error) {
      console.error("Error fetching quote:", error);
      return null;
    }
  }

  async createQuote(data: Omit<InsertQuote, 'accessToken'>) {
    // Generate unique access token
    const accessToken = uuidv4();

    const [quote] = await db
      .insert(quotes)
      .values({
        ...data,
        accessToken,
        subtotal: typeof data.subtotal === 'string' ? data.subtotal : '0',
        taxRate: typeof data.taxRate === 'string' ? data.taxRate : '0.1060',
        taxAmount: typeof data.taxAmount === 'string' ? data.taxAmount : '0',
        total: typeof data.total === 'string' ? data.total : '0',
        downPaymentPercentage: data.downPaymentPercentage || 30,
        milestonePaymentPercentage: data.milestonePaymentPercentage || 40,
        finalPaymentPercentage: data.finalPaymentPercentage || 30,
      })
      .returning();

    // Create access token record
    await db
      .insert(quoteAccessTokens)
      .values({
        quoteId: quote.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

    return quote;
  }

  async updateQuote(id: number, data: Partial<InsertQuote>) {
    const [quote] = await db
      .update(quotes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();

    return quote;
  }

  async deleteQuote(id: number) {
    // Delete associated images from R2
    const images = await db
      .select()
      .from(quoteImages)
      .where(eq(quoteImages.quoteId, id));

    for (const image of images) {
      try {
        await deleteFromR2(image.storageKey);
      } catch (error) {
        console.error(`Failed to delete image ${image.storageKey}:`, error);
      }
    }

    // Delete quote (cascade will handle related records)
    await db
      .delete(quotes)
      .where(eq(quotes.id, id));

    return true;
  }

  async getQuoteLineItems(quoteId: number) {
    return await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId))
      .orderBy(quoteLineItems.id);
  }

  async createLineItem(quoteId: number, data: Omit<InsertQuoteLineItem, 'quoteId'>) {
    const [lineItem] = await db
      .insert(quoteLineItems)
      .values({
        ...data,
        quoteId,
      })
      .returning();

    // Recalculate quote totals
    await this.recalculateQuoteTotals(quoteId);

    return lineItem;
  }

  async updateLineItem(id: number, data: Partial<InsertQuoteLineItem>) {
    const [lineItem] = await db
      .update(quoteLineItems)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(quoteLineItems.id, id))
      .returning();

    if (lineItem) {
      // Recalculate quote totals
      await this.recalculateQuoteTotals(lineItem.quoteId);
    }

    return lineItem;
  }

  async deleteLineItem(id: number) {
    const [lineItem] = await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.id, id));

    if (!lineItem) {
      return false;
    }

    await db
      .delete(quoteLineItems)
      .where(eq(quoteLineItems.id, id));

    // Recalculate quote totals
    await this.recalculateQuoteTotals(lineItem.quoteId);

    return true;
  }

  async uploadQuoteImage(quoteId: number, file: Express.Multer.File, type: string, caption?: string) {
    // Upload to R2
    const { url, key } = await uploadToR2({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype,
      folder: `quotes/${quoteId}`,
    });

    // Save to database
    const [image] = await db
      .insert(quoteImages)
      .values({
        quoteId,
        type,
        url,
        storageKey: key,
        caption,
        filename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      })
      .returning();

    return image;
  }

  async deleteQuoteImage(id: number) {
    const [image] = await db
      .select()
      .from(quoteImages)
      .where(eq(quoteImages.id, id));

    if (!image) {
      return false;
    }

    // Delete from R2
    try {
      await deleteFromR2(image.storageKey);
    } catch (error) {
      console.error(`Failed to delete image ${image.storageKey}:`, error);
    }

    // Delete from database
    await db
      .delete(quoteImages)
      .where(eq(quoteImages.id, id));

    return true;
  }

  async getQuoteByAccessToken(token: string) {
    // Check if token is valid and not expired
    const [accessToken] = await db
      .select()
      .from(quoteAccessTokens)
      .where(
        and(
          eq(quoteAccessTokens.token, token),
          gte(quoteAccessTokens.expiresAt, new Date())
        )
      );

    if (!accessToken) {
      return null;
    }

    return await this.getQuoteById(accessToken.quoteId);
  }

  async createQuoteResponse(token: string, data: InsertQuoteResponse) {
    // Verify token and get quote
    const [accessToken] = await db
      .select()
      .from(quoteAccessTokens)
      .where(
        and(
          eq(quoteAccessTokens.token, token),
          gte(quoteAccessTokens.expiresAt, new Date())
        )
      );

    if (!accessToken) {
      return null;
    }

    // Create response
    const [response] = await db
      .insert(quoteResponses)
      .values({
        ...data,
        quoteId: accessToken.quoteId,
      })
      .returning();

    // Update quote status based on response
    await db
      .update(quotes)
      .set({
        status: data.action === 'accepted' ? 'accepted' : 'declined',
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, accessToken.quoteId));

    return response;
  }

  private async recalculateQuoteTotals(quoteId: number) {
    // Get all line items for the quote
    const lineItems = await db
      .select()
      .from(quoteLineItems)
      .where(eq(quoteLineItems.quoteId, quoteId));

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + parseFloat(item.totalPrice);
    }, 0);

    // Get current quote to preserve tax rate
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId));

    if (!quote) {
      return;
    }

    const taxRate = parseFloat(quote.taxRate) || 0;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // Update quote totals
    await db
      .update(quotes)
      .set({
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
  }
}