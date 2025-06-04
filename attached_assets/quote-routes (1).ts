import { Router } from 'express';
import { z } from 'zod';
import { insertCustomerQuoteSchema, insertQuoteLineItemSchema, insertQuoteImageSchema } from '@shared/schema';
import { storage } from '../../storage';
import { v4 as uuidv4 } from 'uuid';

// Admin middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  next();
};

export const quoteRoutes = Router();

// Admin endpoints

// Get all customer quotes (admin only)
quoteRoutes.get('/admin/quotes', requireAdmin, async (req, res) => {
  try {
    const quotes = await storage.getAllCustomerQuotes();
    res.json(quotes);
  } catch (error) {
    console.error('Error fetching customer quotes:', error);
    res.status(500).json({ message: 'Failed to fetch customer quotes' });
  }
});

// Get a specific quote by ID (admin only)
quoteRoutes.get('/admin/quotes/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid quote ID' });
    }

    const quote = await storage.getCustomerQuoteById(id);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Get line items and images
    const [lineItems, images] = await Promise.all([
      storage.getQuoteLineItems(id),
      storage.getQuoteImages(id)
    ]);

    res.json({
      ...quote,
      lineItems,
      images
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Failed to fetch quote' });
  }
});

// Create a new customer quote (admin only)
quoteRoutes.post('/admin/quotes', requireAdmin, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    
    // Extract line items and images from request body
    const { lineItems, images, ...quoteData } = req.body;
    
    // Validate the quote data (excluding lineItems and images)
    const validatedQuoteData = insertCustomerQuoteSchema.parse(quoteData);
    
    // Generate quote number and magic token if not provided
    const quoteNumber = validatedQuoteData.quoteNumber || `QUO-${Date.now()}`;
    const magicToken = validatedQuoteData.magicToken || uuidv4();
    
    // Add created by user ID
    const quote = {
      ...validatedQuoteData,
      quoteNumber,
      magicToken,
      createdBy: userId || null
    };
    
    // Create the quote
    const savedQuote = await storage.createCustomerQuote(quote);
    
    // Create associated line items
    const savedLineItems = [];
    if (lineItems && lineItems.length > 0) {
      for (const lineItem of lineItems) {
        const savedLineItem = await storage.createQuoteLineItem({
          ...lineItem,
          quoteId: savedQuote.id
        });
        savedLineItems.push(savedLineItem);
      }
    }
    
    // Create associated images
    const savedImages = [];
    if (images && images.length > 0) {
      for (const image of images) {
        const savedImage = await storage.createQuoteImage({
          ...image,
          quoteId: savedQuote.id
        });
        savedImages.push(savedImage);
      }
    }
    
    res.status(201).json({
      ...savedQuote,
      lineItems: savedLineItems,
      images: savedImages
    });
  } catch (error) {
    console.error('Error creating quote:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid quote data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to create quote' });
  }
});

// Update a customer quote (admin only)
quoteRoutes.put('/admin/quotes/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid quote ID' });
    }

    const updateSchema = insertCustomerQuoteSchema.partial();
    const quoteData = updateSchema.parse(req.body);
    
    const updatedQuote = await storage.updateCustomerQuote(id, quoteData);
    if (!updatedQuote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json(updatedQuote);
  } catch (error) {
    console.error('Error updating quote:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid quote data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to update quote' });
  }
});

// Delete a customer quote (admin only)
quoteRoutes.delete('/admin/quotes/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid quote ID' });
    }

    const deleted = await storage.deleteCustomerQuote(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ message: 'Failed to delete quote' });
  }
});

// Line item management (admin only)

// Add line item to quote
quoteRoutes.post('/admin/quotes/:quoteId/line-items', requireAdmin, async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      return res.status(400).json({ message: 'Invalid quote ID' });
    }

    const lineItemData = insertQuoteLineItemSchema.parse({
      ...req.body,
      quoteId
    });
    
    const lineItem = await storage.createQuoteLineItem(lineItemData);
    res.status(201).json(lineItem);
  } catch (error) {
    console.error('Error creating line item:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid line item data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to create line item' });
  }
});

// Update line item
quoteRoutes.put('/admin/quotes/:quoteId/line-items/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid line item ID' });
    }

    const updateSchema = insertQuoteLineItemSchema.partial();
    const lineItemData = updateSchema.parse(req.body);
    
    const updatedLineItem = await storage.updateQuoteLineItem(id, lineItemData);
    if (!updatedLineItem) {
      return res.status(404).json({ message: 'Line item not found' });
    }

    res.json(updatedLineItem);
  } catch (error) {
    console.error('Error updating line item:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid line item data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to update line item' });
  }
});

// Delete line item
quoteRoutes.delete('/admin/quotes/:quoteId/line-items/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid line item ID' });
    }

    const deleted = await storage.deleteQuoteLineItem(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Line item not found' });
    }

    res.json({ message: 'Line item deleted successfully' });
  } catch (error) {
    console.error('Error deleting line item:', error);
    res.status(500).json({ message: 'Failed to delete line item' });
  }
});

// Image management (admin only)

// Add image to quote
quoteRoutes.post('/admin/quotes/:quoteId/images', requireAdmin, async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      return res.status(400).json({ message: 'Invalid quote ID' });
    }

    const imageData = insertQuoteImageSchema.parse({
      ...req.body,
      quoteId
    });
    
    const image = await storage.createQuoteImage(imageData);
    res.status(201).json(image);
  } catch (error) {
    console.error('Error creating image:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid image data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to create image' });
  }
});

// Delete image
quoteRoutes.delete('/admin/quotes/:quoteId/images/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid image ID' });
    }

    const deleted = await storage.deleteQuoteImage(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

// Public endpoints (for customer viewing)

// Get quote by magic token
quoteRoutes.get('/quotes/:token', async (req, res) => {
  try {
    const token = req.params.token;
    
    const quote = await storage.getCustomerQuoteByToken(token);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Update viewed timestamp if not already viewed
    if (!quote.viewedAt) {
      await storage.updateCustomerQuote(quote.id, {
        viewedAt: new Date(),
        status: 'viewed'
      });
    }

    // Get line items and images
    const [lineItems, images] = await Promise.all([
      storage.getQuoteLineItems(quote.id),
      storage.getQuoteImages(quote.id)
    ]);

    res.json({
      ...quote,
      lineItems,
      images
    });
  } catch (error) {
    console.error('Error fetching quote by token:', error);
    res.status(500).json({ message: 'Failed to fetch quote' });
  }
});

// Submit customer response to quote
quoteRoutes.post('/quotes/:token/respond', async (req, res) => {
  try {
    const token = req.params.token;
    
    const responseSchema = z.object({
      response: z.enum(['accepted', 'declined']),
      notes: z.string().optional()
    });
    
    const { response, notes } = responseSchema.parse(req.body);
    
    const quote = await storage.getCustomerQuoteByToken(token);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Update quote with customer response
    const updatedQuote = await storage.updateCustomerQuote(quote.id, {
      customerResponse: response,
      customerNotes: notes || null,
      respondedAt: new Date(),
      status: response
    });

    res.json({ message: 'Response recorded successfully', quote: updatedQuote });
  } catch (error) {
    console.error('Error recording quote response:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid response data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to record response' });
  }
});

// Save customer color selections
quoteRoutes.post('/quotes/:token/colors', async (req, res) => {
  try {
    const token = req.params.token;
    
    const colorSchema = z.object({
      paintColors: z.record(z.string(), z.string())
    });
    
    const { paintColors } = colorSchema.parse(req.body);
    
    const quote = await storage.getCustomerQuoteByToken(token);
    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Update quote with color selections
    const updatedQuote = await storage.updateCustomerQuote(quote.id, {
      paintColors: paintColors
    });

    res.json({ message: 'Color selections saved successfully', quote: updatedQuote });
  } catch (error) {
    console.error('Error saving color selections:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid color data', 
        errors: error.errors 
      });
    }
    res.status(500).json({ message: 'Failed to save color selections' });
  }
});