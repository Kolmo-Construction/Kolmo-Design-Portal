import { db } from "../../db";
import { 
  quotes, 
  quoteLineItems, 
  quoteMedia, 
  quoteResponses,
  quoteAccessTokens,
  type InsertQuote,
  type InsertQuoteLineItem,
  type InsertQuoteResponse
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
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

  async createQuote(data: any) {
    try {
      // Generate unique access token
      const accessToken = uuidv4();

      const [quote] = await db
        .insert(quotes)
        .values({
          ...data,
          accessToken,
          subtotal: data.subtotal || "0",
          taxRate: data.taxRate || "0.1060",
          taxAmount: data.taxAmount || "0",
          total: data.total || "0",
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
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        });

      await this.recalculateQuoteTotals(quote.id);
      return quote;
    } catch (error) {
      console.error("Error creating quote:", error);
      throw error;
    }
  }

  async updateQuote(id: number, data: any) {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
        // Handle date conversion if needed
        validUntil: typeof data.validUntil === 'string' ? new Date(data.validUntil) : data.validUntil,
      };

      const [updatedQuote] = await db
        .update(quotes)
        .set(updateData)
        .where(eq(quotes.id, id))
        .returning();

      if (updatedQuote) {
        await this.recalculateQuoteTotals(id);
      }

      return updatedQuote;
    } catch (error) {
      console.error("Error updating quote:", error);
      throw error;
    }
  }

  async deleteQuote(id: number) {
    try {
      await db.delete(quotes).where(eq(quotes.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting quote:", error);
      return false;
    }
  }

  async getQuoteLineItems(quoteId: number) {
    try {
      return await db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, quoteId))
        .orderBy(quoteLineItems.id);
    } catch (error) {
      console.error("Error fetching line items:", error);
      return [];
    }
  }

  async createLineItem(quoteId: number, data: any) {
    try {
      const [lineItem] = await db
        .insert(quoteLineItems)
        .values({
          quoteId,
          category: data.category,
          description: data.description,
          quantity: data.quantity ? data.quantity.toString() : "1",
          unit: data.unit || "each",
          unitPrice: data.unitPrice ? data.unitPrice.toString() : "0",
          discountPercentage: data.discountPercentage ? data.discountPercentage.toString() : "0",
          discountAmount: data.discountAmount ? data.discountAmount.toString() : "0",
          totalPrice: data.totalPrice ? data.totalPrice.toString() : "0",
          sortOrder: data.sortOrder || 0,
        })
        .returning();

      await this.recalculateQuoteTotals(quoteId);
      return lineItem;
    } catch (error) {
      console.error("Error creating line item:", error);
      throw error;
    }
  }

  async updateLineItem(id: number, data: any) {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
        quantity: data.quantity ? parseFloat(data.quantity.toString()) : undefined,
        unitPrice: data.unitPrice ? data.unitPrice.toString() : undefined,
        totalPrice: data.totalPrice ? data.totalPrice.toString() : undefined,
      };

      const [updatedLineItem] = await db
        .update(quoteLineItems)
        .set(updateData)
        .where(eq(quoteLineItems.id, id))
        .returning();

      if (updatedLineItem) {
        await this.recalculateQuoteTotals(updatedLineItem.quoteId);
      }

      return updatedLineItem;
    } catch (error) {
      console.error("Error updating line item:", error);
      throw error;
    }
  }

  async deleteLineItem(id: number) {
    try {
      const [deletedItem] = await db
        .delete(quoteLineItems)
        .where(eq(quoteLineItems.id, id))
        .returning();

      if (deletedItem) {
        await this.recalculateQuoteTotals(deletedItem.quoteId);
      }

      return true;
    } catch (error) {
      console.error("Error deleting line item:", error);
      return false;
    }
  }

  async getQuoteByAccessToken(token: string) {
    try {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.accessToken, token));

      if (!quote) {
        return null;
      }

      // Get line items
      const lineItems = await db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, quote.id))
        .orderBy(quoteLineItems.id);

      // Get responses
      const responses = await db
        .select()
        .from(quoteResponses)
        .where(eq(quoteResponses.quoteId, quote.id))
        .orderBy(desc(quoteResponses.createdAt));

      return {
        ...quote,
        lineItems,
        responses
      };
    } catch (error) {
      console.error("Error fetching quote by token:", error);
      return null;
    }
  }

  async createQuoteResponse(quoteId: number, data: any) {
    try {
      const responseData = {
        ...data,
        quoteId,
      };

      const [response] = await db
        .insert(quoteResponses)
        .values(responseData)
        .returning();

      // Update quote status and responded timestamp
      await db
        .update(quotes)
        .set({
          status: data.action === 'accepted' ? 'accepted' : 
                  data.action === 'declined' ? 'declined' : 'pending',
          respondedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId));

      return response;
    } catch (error) {
      console.error("Error creating quote response:", error);
      throw error;
    }
  }

  private async recalculateQuoteTotals(quoteId: number) {
    try {
      const lineItems = await db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteId, quoteId));

      const subtotal = lineItems.reduce((sum, item) => {
        return sum + parseFloat(item.totalPrice || "0");
      }, 0);

      const [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, quoteId));

      if (quote) {
        const taxRate = parseFloat(quote.taxRate || "0.1060");
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;

        await db
          .update(quotes)
          .set({
            subtotal: subtotal.toString(),
            taxAmount: taxAmount.toString(),
            total: total.toString(),
            updatedAt: new Date(),
          })
          .where(eq(quotes.id, quoteId));
      }
    } catch (error) {
      console.error("Error recalculating quote totals:", error);
    }
  }
}