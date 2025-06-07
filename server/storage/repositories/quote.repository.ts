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
import { eq, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export class QuoteRepository {
  async getAllQuotes() {
    try {
      const quotesWithLineItems = await db
        .select({
          id: quotes.id,
          quoteNumber: quotes.quoteNumber,
          title: quotes.title,
          description: quotes.description,
          customerName: quotes.customerName,
          customerEmail: quotes.customerEmail,
          customerPhone: quotes.customerPhone,
          customerAddress: quotes.customerAddress,
          projectType: quotes.projectType,
          location: quotes.location,
          subtotal: quotes.subtotal,
          discountPercentage: quotes.discountPercentage,
          discountAmount: quotes.discountAmount,
          discountedSubtotal: quotes.discountedSubtotal,
          taxRate: quotes.taxRate,
          taxAmount: quotes.taxAmount,
          isManualTax: quotes.isManualTax,
          total: quotes.total,
          downPaymentPercentage: quotes.downPaymentPercentage,
          milestonePaymentPercentage: quotes.milestonePaymentPercentage,
          finalPaymentPercentage: quotes.finalPaymentPercentage,
          milestoneDescription: quotes.milestoneDescription,
          estimatedStartDate: quotes.estimatedStartDate,
          estimatedCompletionDate: quotes.estimatedCompletionDate,
          validUntil: quotes.validUntil,
          status: quotes.status,
          projectNotes: quotes.projectNotes,
          accessToken: quotes.accessToken,
          sentAt: quotes.sentAt,
          viewedAt: quotes.viewedAt,
          respondedAt: quotes.respondedAt,
          createdById: quotes.createdById,
          createdAt: quotes.createdAt,
          updatedAt: quotes.updatedAt,
          lineItems: sql<any[]>`COALESCE(
            json_agg(
              json_build_object(
                'id', ${quoteLineItems.id},
                'description', ${quoteLineItems.description},
                'quantity', ${quoteLineItems.quantity},
                'unit', ${quoteLineItems.unit},
                'unitPrice', ${quoteLineItems.unitPrice},
                'discountPercentage', ${quoteLineItems.discountPercentage},
                'discountAmount', ${quoteLineItems.discountAmount},
                'totalPrice', ${quoteLineItems.totalPrice},
                'category', ${quoteLineItems.category}
              )
            ) FILTER (WHERE ${quoteLineItems.id} IS NOT NULL),
            '[]'::json
          )`.as('lineItems')
        })
        .from(quotes)
        .leftJoin(quoteLineItems, eq(quotes.id, quoteLineItems.quoteId))
        .groupBy(quotes.id)
        .orderBy(desc(quotes.createdAt));

      return quotesWithLineItems;
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

  async createQuote(data: any, userId: number) {
    try {
      // Generate unique access token and quote number
      const accessToken = uuidv4();
      const quoteNumber = `KOL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const [quote] = await db
        .insert(quotes)
        .values({
          ...data,
          quoteNumber,
          accessToken,
          createdById: userId,
          subtotal: data.subtotal || "0",
          discountedSubtotal: data.discountedSubtotal || data.subtotal || "0",
          taxRate: data.taxRate || "10.60",
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
          quantity: data.quantity || "1",
          unit: data.unit || "each",
          unitPrice: data.unitPrice || "0",
          discountPercentage: data.discountPercentage || "0",
          discountAmount: data.discountAmount || "0",
          totalPrice: data.totalPrice || "0",
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
      console.log(`Updating line item ${id} with data:`, data);
      
      const updateData = {
        ...data,
        updatedAt: new Date(),
        quantity: data.quantity ? parseFloat(data.quantity.toString()) : undefined,
        unitPrice: data.unitPrice ? data.unitPrice.toString() : undefined,
        totalPrice: data.totalPrice ? data.totalPrice.toString() : undefined,
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      console.log(`Update data after processing:`, updateData);

      const [updatedLineItem] = await db
        .update(quoteLineItems)
        .set(updateData)
        .where(eq(quoteLineItems.id, id))
        .returning();

      console.log(`Updated line item:`, updatedLineItem);

      if (updatedLineItem) {
        console.log(`Recalculating totals for quote ${updatedLineItem.quoteId}`);
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

  async sendQuote(quoteId: number) {
    try {
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      return updatedQuote;
    } catch (error) {
      console.error("Error sending quote:", error);
      return null;
    }
  }

  async uploadQuoteImage(quoteId: number, imageData: any) {
    try {
      const [quoteImage] = await db
        .insert(quoteMedia)
        .values({
          quoteId,
          mediaUrl: imageData.url,
          mediaType: imageData.type || 'image',
          caption: imageData.caption,
          category: imageData.category || 'reference',
          uploadedById: imageData.uploadedById,
        })
        .returning();

      return quoteImage;
    } catch (error) {
      console.error("Error uploading quote image:", error);
      throw error;
    }
  }

  async deleteQuoteImage(imageId: number) {
    try {
      const [deletedImage] = await db
        .delete(quoteMedia)
        .where(eq(quoteMedia.id, imageId))
        .returning();

      return !!deletedImage;
    } catch (error) {
      console.error("Error deleting quote image:", error);
      return false;
    }
  }

  async updateQuoteFinancials(quoteId: number, data: {
    discountPercentage?: string;
    discountAmount?: string;
    taxRate?: string;
    taxAmount?: string;
    isManualTax?: boolean;
  }) {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (data.discountPercentage !== undefined) {
        updateData.discountPercentage = data.discountPercentage === "" ? "0" : data.discountPercentage;
      }
      if (data.discountAmount !== undefined) {
        updateData.discountAmount = data.discountAmount === "" ? "0" : data.discountAmount;
      }
      if (data.taxRate !== undefined) {
        updateData.taxRate = data.taxRate === "" ? "0" : data.taxRate;
      }
      if (data.taxAmount !== undefined) {
        updateData.taxAmount = data.taxAmount === "" ? "0" : data.taxAmount;
      }
      if (data.isManualTax !== undefined) {
        updateData.isManualTax = data.isManualTax;
      }

      const [updatedQuote] = await db
        .update(quotes)
        .set(updateData)
        .where(eq(quotes.id, quoteId))
        .returning();

      if (updatedQuote) {
        await this.recalculateQuoteTotals(quoteId);
      }

      return updatedQuote;
    } catch (error) {
      console.error("Error updating quote financials:", error);
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
        // Calculate quote-level discount
        const discountPercentage = parseFloat(quote.discountPercentage || "0");
        const discountAmount = parseFloat(quote.discountAmount || "0");
        
        let totalDiscount = 0;
        if (discountPercentage > 0) {
          totalDiscount = (subtotal * discountPercentage) / 100;
        } else if (discountAmount > 0) {
          totalDiscount = discountAmount;
        }
        
        const discountedSubtotal = subtotal - totalDiscount;

        // Calculate tax
        let taxAmount = 0;
        if (quote.isManualTax) {
          // Use manually entered tax amount
          taxAmount = parseFloat(quote.taxAmount || "0");
        } else {
          // Calculate tax based on rate
          const taxRateValue = parseFloat(quote.taxRate || "10.60");
          let taxRate;
          
          // Handle both old decimal format (0.1060) and new percentage format (10.60)
          if (taxRateValue <= 1) {
            // Old decimal format - use as is
            taxRate = taxRateValue;
          } else {
            // New percentage format - convert to decimal
            taxRate = taxRateValue / 100;
          }
          
          taxAmount = discountedSubtotal * taxRate;
        }

        const total = discountedSubtotal + taxAmount;

        await db
          .update(quotes)
          .set({
            subtotal: subtotal.toString(),
            discountAmount: totalDiscount.toString(),
            discountedSubtotal: discountedSubtotal.toString(),
            taxAmount: taxAmount.toString(),
            total: total.toString(),
            updatedAt: new Date(),
          })
          .where(eq(quotes.id, quoteId));

        console.log(`Recalculated totals for quote ${quoteId}:`, {
          subtotal: subtotal.toString(),
          totalDiscount: totalDiscount.toString(), 
          discountedSubtotal: discountedSubtotal.toString(),
          taxAmount: taxAmount.toString(),
          total: total.toString()
        });
      }
    } catch (error) {
      console.error("Error recalculating quote totals:", error);
    }
  }
}