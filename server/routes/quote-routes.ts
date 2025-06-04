import { Router } from "express";
import { quoteStorage } from "../storage/quote-storage";
import { 
  insertCustomerQuoteSchema, 
  insertQuoteLineItemSchema, 
  insertQuoteImageSchema 
} from "@shared/schema";
import { z } from "zod";

export const quoteRoutes = Router();

// Get all quotes (admin)
quoteRoutes.get("/", async (req, res) => {
  try {
    const quotes = await quoteStorage.getQuotes();
    res.json(quotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

// Get quote by ID with details (admin)
quoteRoutes.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const quote = await quoteStorage.getQuoteWithDetails(id);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    res.json(quote);
  } catch (error) {
    console.error("Error fetching quote:", error);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

// Get quote by magic token (customer view)
quoteRoutes.get("/view/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Mark quote as viewed and get details
    await quoteStorage.markQuoteAsViewed(token);
    const quote = await quoteStorage.getQuoteWithDetailsByToken(token);
    
    if (!quote) {
      return res.status(404).json({ error: "Quote not found or expired" });
    }

    res.json(quote);
  } catch (error) {
    console.error("Error fetching quote by token:", error);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

// Create new quote
quoteRoutes.post("/", async (req, res) => {
  try {
    const validatedData = insertCustomerQuoteSchema.parse(req.body);
    const quote = await quoteStorage.createQuote(validatedData);
    res.status(201).json(quote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating quote:", error);
    res.status(500).json({ error: "Failed to create quote" });
  }
});

// Update quote
quoteRoutes.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const validatedData = insertCustomerQuoteSchema.partial().parse(req.body);
    const quote = await quoteStorage.updateQuote(id, validatedData);
    
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    res.json(quote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating quote:", error);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

// Delete quote
quoteRoutes.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const success = await quoteStorage.deleteQuote(id);
    if (!success) {
      return res.status(404).json({ error: "Quote not found" });
    }

    res.json({ message: "Quote deleted successfully" });
  } catch (error) {
    console.error("Error deleting quote:", error);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

// Customer response to quote
quoteRoutes.post("/respond/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { response, notes } = req.body;

    if (!response || !['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ error: "Response must be 'accepted' or 'declined'" });
    }

    const quote = await quoteStorage.respondToQuote(token, response, notes);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found or expired" });
    }

    res.json(quote);
  } catch (error) {
    console.error("Error responding to quote:", error);
    res.status(500).json({ error: "Failed to respond to quote" });
  }
});

// Line Items Routes

// Add line item to quote
quoteRoutes.post("/:id/line-items", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const validatedData = insertQuoteLineItemSchema.parse({
      ...req.body,
      quoteId
    });

    const lineItem = await quoteStorage.createLineItem(validatedData);
    res.status(201).json(lineItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating line item:", error);
    res.status(500).json({ error: "Failed to create line item" });
  }
});

// Update line item
quoteRoutes.put("/line-items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid line item ID" });
    }

    const validatedData = insertQuoteLineItemSchema.partial().parse(req.body);
    const lineItem = await quoteStorage.updateLineItem(id, validatedData);
    
    if (!lineItem) {
      return res.status(404).json({ error: "Line item not found" });
    }

    res.json(lineItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating line item:", error);
    res.status(500).json({ error: "Failed to update line item" });
  }
});

// Delete line item
quoteRoutes.delete("/line-items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid line item ID" });
    }

    const success = await quoteStorage.deleteLineItem(id);
    if (!success) {
      return res.status(404).json({ error: "Line item not found" });
    }

    res.json({ message: "Line item deleted successfully" });
  } catch (error) {
    console.error("Error deleting line item:", error);
    res.status(500).json({ error: "Failed to delete line item" });
  }
});

// Image Routes

// Add image to quote
quoteRoutes.post("/:id/images", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const validatedData = insertQuoteImageSchema.parse({
      ...req.body,
      quoteId
    });

    const image = await quoteStorage.createImage(validatedData);
    res.status(201).json(image);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating image:", error);
    res.status(500).json({ error: "Failed to create image" });
  }
});

// Update image
quoteRoutes.put("/images/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid image ID" });
    }

    const validatedData = insertQuoteImageSchema.partial().parse(req.body);
    const image = await quoteStorage.updateImage(id, validatedData);
    
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.json(image);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating image:", error);
    res.status(500).json({ error: "Failed to update image" });
  }
});

// Delete image
quoteRoutes.delete("/images/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid image ID" });
    }

    const success = await quoteStorage.deleteImage(id);
    if (!success) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});