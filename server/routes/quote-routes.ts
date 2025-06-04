import { Router } from "express";
import { quoteStorage } from "../storage/quote-storage";
import { 
  insertCustomerQuoteSchema, 
  insertQuoteLineItemSchema, 
  insertQuoteImageSchema,
  insertQuoteBeforeAfterPairSchema
} from "@shared/schema";
import { z } from "zod";

// Line item schema for validation
const lineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().transform(val => parseFloat(val) || 0),
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.string().transform(val => parseFloat(val) || 0),
  discountPercentage: z.string().transform(val => parseFloat(val) || 0),
  totalPrice: z.string().transform(val => parseFloat(val) || 0),
});

// Custom validation schema for quote creation that handles empty date strings
const createQuoteSchema = z.object({
  projectType: z.string().min(1, "Project type is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().min(1, "Project description is required"),
  projectLocation: z.string().optional(),
  subtotal: z.string().transform(val => parseFloat(val) || 0),
  discountPercentage: z.string().transform(val => parseFloat(val) || 0),
  discountAmount: z.string().transform(val => parseFloat(val) || 0),
  taxPercentage: z.string().transform(val => parseFloat(val) || 0),
  taxableAmount: z.string().transform(val => parseFloat(val) || 0),
  taxAmount: z.string().transform(val => parseFloat(val) || 0),
  totalAmount: z.string().transform(val => parseFloat(val) || 0),
  estimatedStartDate: z.string().optional().transform(val => val === "" ? undefined : val),
  estimatedCompletionDate: z.string().optional().transform(val => val === "" ? undefined : val),
  validUntil: z.string().min(1, "Valid until date is required"),
  showBeforeAfter: z.boolean().default(false),
  beforeAfterTitle: z.string().optional(),
  beforeAfterDescription: z.string().optional(),
  showColorVerification: z.boolean().default(false),
  colorVerificationTitle: z.string().optional(),
  colorVerificationDescription: z.string().optional(),
  permitRequired: z.boolean().default(false),
  permitDetails: z.string().optional(),
  downPaymentPercentage: z.string().optional().transform(val => val === "" ? undefined : parseFloat(val)),
  milestonePaymentPercentage: z.string().optional().transform(val => val === "" ? undefined : parseFloat(val)),
  finalPaymentPercentage: z.string().optional().transform(val => val === "" ? undefined : parseFloat(val)),
  milestoneDescription: z.string().optional(),
  acceptsCreditCards: z.boolean().default(false),
  creditCardProcessingFee: z.string().optional().transform(val => val === "" ? undefined : parseFloat(val)),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

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

// Customer response to quote (accept/decline)
quoteRoutes.post("/respond/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { response, notes } = req.body;

    if (!response || !["accepted", "declined"].includes(response)) {
      return res.status(400).json({ error: "Invalid response. Must be 'accepted' or 'declined'" });
    }

    const quote = await quoteStorage.getQuoteByToken(token);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found or expired" });
    }

    // Check if quote is still valid
    if (new Date(quote.validUntil) < new Date()) {
      return res.status(400).json({ error: "Quote has expired" });
    }

    // Check if already responded
    if (quote.respondedAt) {
      return res.status(400).json({ error: "Quote has already been responded to" });
    }

    // Update quote with customer response
    const updatedQuote = await quoteStorage.updateQuote(quote.id, {
      customerResponse: response,
      customerNotes: notes || null,
      respondedAt: new Date(),
      status: response === "accepted" ? "accepted" : "declined"
    });

    res.json({ 
      success: true, 
      message: `Quote ${response} successfully`,
      quote: updatedQuote 
    });
  } catch (error) {
    console.error("Error responding to quote:", error);
    res.status(500).json({ error: "Failed to respond to quote" });
  }
});

// Create new quote
quoteRoutes.post("/", async (req, res) => {
  try {
    const validatedData = createQuoteSchema.parse(req.body);
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

// Before/After Pairs Routes

// Get before/after pairs for a quote
quoteRoutes.get("/:quoteId/before-after-pairs", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const pairs = await quoteStorage.getBeforeAfterPairsByQuoteId(quoteId);
    res.json(pairs);
  } catch (error) {
    console.error("Error fetching before/after pairs:", error);
    res.status(500).json({ error: "Failed to fetch before/after pairs" });
  }
});

// Create a new before/after pair
quoteRoutes.post("/:quoteId/before-after-pairs", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const validatedData = insertQuoteBeforeAfterPairSchema.parse({
      ...req.body,
      quoteId
    });

    const pair = await quoteStorage.createBeforeAfterPair(validatedData);
    res.status(201).json(pair);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error creating before/after pair:", error);
    res.status(500).json({ error: "Failed to create before/after pair" });
  }
});

// Update a before/after pair
quoteRoutes.put("/before-after-pairs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid pair ID" });
    }

    const validatedData = insertQuoteBeforeAfterPairSchema.partial().parse(req.body);
    const pair = await quoteStorage.updateBeforeAfterPair(id, validatedData);
    
    if (!pair) {
      return res.status(404).json({ error: "Before/after pair not found" });
    }

    res.json(pair);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Error updating before/after pair:", error);
    res.status(500).json({ error: "Failed to update before/after pair" });
  }
});

// Delete a before/after pair
quoteRoutes.delete("/before-after-pairs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid pair ID" });
    }

    const success = await quoteStorage.deleteBeforeAfterPair(id);
    if (!success) {
      return res.status(404).json({ error: "Before/after pair not found" });
    }

    res.json({ message: "Before/after pair deleted successfully" });
  } catch (error) {
    console.error("Error deleting before/after pair:", error);
    res.status(500).json({ error: "Failed to delete before/after pair" });
  }
});

// Reorder before/after pairs
quoteRoutes.put("/:quoteId/before-after-pairs/reorder", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: "Invalid quote ID" });
    }

    const { pairIds } = req.body;
    if (!Array.isArray(pairIds)) {
      return res.status(400).json({ error: "pairIds must be an array" });
    }

    const success = await quoteStorage.reorderBeforeAfterPairs(quoteId, pairIds);
    if (!success) {
      return res.status(500).json({ error: "Failed to reorder pairs" });
    }

    res.json({ message: "Pairs reordered successfully" });
  } catch (error) {
    console.error("Error reordering before/after pairs:", error);
    res.status(500).json({ error: "Failed to reorder before/after pairs" });
  }
});