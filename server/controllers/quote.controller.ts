import { Request, Response } from "express";
import { QuoteRepository } from "../storage/repositories/quote.repository";
import { createInsertSchema } from "drizzle-zod";
import { quotes, quoteLineItems, quoteResponses } from "@shared/schema";
import { z } from "zod";
import { sendEmail } from "../email";

const createQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  accessToken: true,
  createdAt: true,
  updatedAt: true,
});

const createLineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.string(),
  unit: z.string(),
  unitPrice: z.string(),
  discountPercentage: z.string().optional().default("0"),
  discountAmount: z.string().optional().default("0"),
  totalPrice: z.string(),
  sortOrder: z.number().optional().default(0),
});

const createResponseSchema = createInsertSchema(quoteResponses).omit({
  id: true,
  quoteId: true,
  createdAt: true,
});

export class QuoteController {
  private quoteRepository: QuoteRepository;

  constructor() {
    this.quoteRepository = new QuoteRepository();
  }

  async getAllQuotes(req: Request, res: Response) {
    try {
      const quotes = await this.quoteRepository.getAllQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  }

  async getQuoteById(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const quote = await this.quoteRepository.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  }

  async createQuote(req: Request, res: Response) {
    try {
      const validatedData = createQuoteSchema.parse(req.body);
      const quote = await this.quoteRepository.createQuote(validatedData);
      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  }

  async updateQuote(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const validatedData = createQuoteSchema.partial().parse(req.body);
      const quote = await this.quoteRepository.updateQuote(quoteId, validatedData);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating quote:", error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  }

  async deleteQuote(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const success = await this.quoteRepository.deleteQuote(quoteId);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  }

  async sendQuote(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const quote = await this.quoteRepository.sendQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json({ message: "Quote sent successfully", quote });
    } catch (error) {
      console.error("Error sending quote:", error);
      res.status(500).json({ error: "Failed to send quote" });
    }
  }

  async getQuoteLineItems(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const lineItems = await this.quoteRepository.getQuoteLineItems(quoteId);
      res.json(lineItems);
    } catch (error) {
      console.error("Error fetching line items:", error);
      res.status(500).json({ error: "Failed to fetch line items" });
    }
  }

  async createLineItem(req: Request, res: Response) {
    try {
      console.log("CreateLineItem - Request body:", JSON.stringify(req.body, null, 2));
      
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      console.log("CreateLineItem - Quote ID:", quoteId);
      
      const validatedData = createLineItemSchema.parse(req.body);
      console.log("CreateLineItem - Validated data:", JSON.stringify(validatedData, null, 2));
      
      const lineItem = await this.quoteRepository.createLineItem(quoteId, validatedData);
      console.log("CreateLineItem - Created line item:", JSON.stringify(lineItem, null, 2));
      
      res.status(201).json(lineItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("CreateLineItem - Validation error:", error.errors);
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("CreateLineItem - Error:", error);
      res.status(500).json({ error: "Failed to create line item" });
    }
  }

  async updateLineItem(req: Request, res: Response) {
    try {
      const lineItemId = parseInt(req.params.lineItemId);
      if (isNaN(lineItemId)) {
        return res.status(400).json({ error: "Invalid line item ID" });
      }

      const validatedData = createLineItemSchema.partial().parse(req.body);
      const lineItem = await this.quoteRepository.updateLineItem(lineItemId, validatedData);
      
      if (!lineItem) {
        return res.status(404).json({ error: "Line item not found" });
      }

      res.json(lineItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating line item:", error);
      res.status(500).json({ error: "Failed to update line item" });
    }
  }

  async deleteLineItem(req: Request, res: Response) {
    try {
      const lineItemId = parseInt(req.params.lineItemId);
      if (isNaN(lineItemId)) {
        return res.status(400).json({ error: "Invalid line item ID" });
      }

      const success = await this.quoteRepository.deleteLineItem(lineItemId);
      if (!success) {
        return res.status(404).json({ error: "Line item not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting line item:", error);
      res.status(500).json({ error: "Failed to delete line item" });
    }
  }

  async uploadQuoteImage(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { type, caption } = req.body;
      const image = await this.quoteRepository.uploadQuoteImage(
        quoteId,
        req.file,
        type,
        caption
      );

      res.status(201).json(image);
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }

  async deleteQuoteImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
      }

      const success = await this.quoteRepository.deleteQuoteImage(imageId);
      if (!success) {
        return res.status(404).json({ error: "Image not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  }

  async getQuoteByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const quote = await this.quoteRepository.getQuoteByAccessToken(token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found or expired" });
      }

      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote by token:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  }

  async respondToQuote(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const validatedData = createResponseSchema.parse(req.body);
      const response = await this.quoteRepository.createQuoteResponse(token, validatedData);
      
      if (!response) {
        return res.status(404).json({ error: "Quote not found or expired" });
      }

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating quote response:", error);
      res.status(500).json({ error: "Failed to create response" });
    }
  }

  async sendQuote(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const { customerEmail, customerName } = req.body;
      if (!customerEmail || !customerName) {
        return res.status(400).json({ error: "Customer email and name are required" });
      }

      // Get the quote details
      const quote = await this.quoteRepository.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Generate the customer link
      const customerLink = `${req.protocol}://${req.get('host')}/quotes/${quote.accessToken}`;

      // Send the email
      const emailSent = await sendEmail({
        to: customerEmail,
        subject: `Quote ${quote.quoteNumber} - ${quote.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Quote from Kolmo Construction</h2>
            <p>Dear ${customerName},</p>
            <p>Thank you for your interest in our construction services. We have prepared a detailed quote for your project: <strong>${quote.title}</strong></p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Quote Summary</h3>
              <p><strong>Quote Number:</strong> ${quote.quoteNumber}</p>
              <p><strong>Project:</strong> ${quote.title}</p>
              <p><strong>Total Amount:</strong> $${parseFloat(quote.total.toString()).toLocaleString()}</p>
              <p><strong>Valid Until:</strong> ${new Date(quote.validUntil).toLocaleDateString()}</p>
            </div>

            <p>You can view the complete quote details, including all line items and project specifications, by clicking the link below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${customerLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                View Your Quote
              </a>
            </div>

            <p>If you have any questions about this quote or would like to discuss your project further, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            The Kolmo Construction Team</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
            <p style="font-size: 12px; color: #666;">
              This quote is valid until ${new Date(quote.validUntil).toLocaleDateString()}. 
              You can access your quote anytime using the link above.
            </p>
          </div>
        `,
        text: `
Dear ${customerName},

Thank you for your interest in our construction services. We have prepared a detailed quote for your project: ${quote.title}

Quote Details:
- Quote Number: ${quote.quoteNumber}
- Project: ${quote.title}
- Total Amount: $${parseFloat(quote.total.toString()).toLocaleString()}
- Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}

You can view the complete quote details by visiting: ${customerLink}

If you have any questions about this quote or would like to discuss your project further, please don't hesitate to contact us.

Best regards,
The Kolmo Construction Team

This quote is valid until ${new Date(quote.validUntil).toLocaleDateString()}.
        `
      });

      if (!emailSent) {
        return res.status(500).json({ error: "Failed to send email" });
      }

      // Update quote status to 'sent' if it was previously 'draft'
      if (quote.status === 'draft') {
        await this.quoteRepository.updateQuote(quoteId, { status: 'sent' });
      }

      res.json({ 
        success: true, 
        message: "Quote sent successfully",
        customerLink 
      });
    } catch (error) {
      console.error("Error sending quote:", error);
      res.status(500).json({ error: "Failed to send quote" });
    }
  }
}