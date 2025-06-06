import { Request, Response } from "express";
import { QuoteRepository } from "../storage/repositories/quote.repository";
import { createInsertSchema } from "drizzle-zod";
import { quotes, quoteLineItems, quoteResponses } from "@shared/schema";
import { z } from "zod";

const createQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  accessToken: true,
  createdAt: true,
  updatedAt: true,
});

const createLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
  quoteId: true,
  createdAt: true,
  updatedAt: true,
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
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const validatedData = createLineItemSchema.parse(req.body);
      const lineItem = await this.quoteRepository.createLineItem(quoteId, validatedData);
      res.status(201).json(lineItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating line item:", error);
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
}