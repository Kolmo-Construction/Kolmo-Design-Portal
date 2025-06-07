import { Request, Response } from "express";
import { QuoteRepository } from "../storage/repositories/quote.repository";
import { createInsertSchema } from "drizzle-zod";
import { quotes, quoteLineItems, quoteResponses } from "@shared/schema";
import { uploadToR2, deleteFromR2 } from "../r2-upload";
import { z } from "zod";
import { sendEmail } from "../email";

const createQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  quoteNumber: true,
  accessToken: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override date fields to accept strings and convert them to Date objects
  validUntil: z.string().transform((str) => new Date(str)),
  estimatedStartDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  estimatedCompletionDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  sentAt: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  viewedAt: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  respondedAt: z.string().optional().transform((str) => str ? new Date(str) : undefined),
});

const createLineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.union([z.string(), z.number()]).transform(val => String(val)),
  unit: z.string().optional().default(""),
  unitPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
  discountPercentage: z.union([z.string(), z.number()]).optional().default("0").transform(val => String(val || "0")),
  discountAmount: z.union([z.string(), z.number()]).optional().default("0").transform(val => String(val || "0")),
  totalPrice: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : "0"),
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
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const quote = await this.quoteRepository.createQuote(validatedData, userId);
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

      const imageData = {
        url: req.file.path || req.file.filename,
        type: req.body.type || 'image',
        caption: req.body.caption,
        category: req.body.category || 'reference',
        uploadedById: (req as any).user?.id || 1,
      };

      const image = await this.quoteRepository.uploadQuoteImage(quoteId, imageData);
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

  async uploadBeforeAfterImage(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      const imageType = req.params.type;
      
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!['before', 'after'].includes(imageType)) {
        return res.status(400).json({ error: "Image type must be 'before' or 'after'" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const caption = req.body.caption || '';
      
      // Upload file to R2 storage
      const uploadResult = await uploadToR2({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        mimetype: req.file.mimetype,
        path: `quotes/${quoteId}/${imageType}`,
      });
      
      // Update the quote with the new image URL and caption
      const updateData = imageType === 'before' 
        ? { beforeImageUrl: uploadResult.url, beforeImageCaption: caption }
        : { afterImageUrl: uploadResult.url, afterImageCaption: caption };

      const updatedQuote = await this.quoteRepository.updateQuote(quoteId, updateData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(200).json({
        message: `${imageType} image uploaded successfully`,
        imageUrl: uploadResult.url,
        caption: caption
      });
    } catch (error) {
      console.error("Error uploading before/after image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }

  async updateImageCaption(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      const imageType = req.params.type;
      const { caption } = req.body;
      
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!['before', 'after'].includes(imageType)) {
        return res.status(400).json({ error: "Image type must be 'before' or 'after'" });
      }

      const updateData = imageType === 'before' 
        ? { beforeImageCaption: caption }
        : { afterImageCaption: caption };

      const updatedQuote = await this.quoteRepository.updateQuote(quoteId, updateData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(200).json({
        message: `${imageType} image caption updated successfully`,
        caption: caption
      });
    } catch (error) {
      console.error("Error updating image caption:", error);
      res.status(500).json({ error: "Failed to update caption" });
    }
  }

  async deleteBeforeAfterImage(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      const imageType = req.params.type;
      
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!['before', 'after'].includes(imageType)) {
        return res.status(400).json({ error: "Image type must be 'before' or 'after'" });
      }

      // Get the current quote to find the image URL for deletion
      const currentQuote = await this.quoteRepository.getQuoteById(quoteId);
      if (!currentQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Extract the R2 key from the image URL for deletion
      const imageUrl = imageType === 'before' ? currentQuote.beforeImageUrl : currentQuote.afterImageUrl;
      if (imageUrl) {
        try {
          // Extract the key from the R2 URL (assuming format: https://domain/key)
          const urlParts = imageUrl.split('/');
          const key = urlParts.slice(3).join('/'); // Remove protocol and domain
          await deleteFromR2(key);
        } catch (deleteError) {
          console.warn(`Failed to delete image from R2: ${deleteError}`);
          // Continue with database update even if R2 deletion fails
        }
      }

      const updateData = imageType === 'before' 
        ? { beforeImageUrl: null, beforeImageCaption: null }
        : { afterImageUrl: null, afterImageCaption: null };

      const updatedQuote = await this.quoteRepository.updateQuote(quoteId, updateData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(200).json({
        message: `${imageType} image deleted successfully`
      });
    } catch (error) {
      console.error("Error deleting before/after image:", error);
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

      // First get the quote to get its ID
      const quote = await this.quoteRepository.getQuoteByAccessToken(token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found or expired" });
      }

      const validatedData = createResponseSchema.parse(req.body);
      const response = await this.quoteRepository.createQuoteResponse(quote.id, validatedData);
      
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating quote response:", error);
      res.status(500).json({ error: "Failed to create response" });
    }
  }

  async updateQuoteFinancials(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const validatedData = z.object({
        discountPercentage: z.string().optional(),
        discountAmount: z.string().optional(),
        taxRate: z.string().optional(),
        taxAmount: z.string().optional(),
        isManualTax: z.boolean().optional(),
      }).parse(req.body);

      const updatedQuote = await this.quoteRepository.updateQuoteFinancials(quoteId, validatedData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(updatedQuote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating quote financials:", error);
      res.status(500).json({ error: "Failed to update quote financials" });
    }
  }
}