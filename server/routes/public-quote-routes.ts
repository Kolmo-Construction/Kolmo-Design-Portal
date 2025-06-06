import { Router } from "express";
import { quoteStorage } from "../storage/quote-storage";

export const publicQuoteRoutes = Router();

// Get quote by magic token (customer view) - NO AUTHENTICATION REQUIRED
publicQuoteRoutes.get("/:token", async (req, res) => {
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

// Customer response to quote (accept/decline) - NO AUTHENTICATION REQUIRED
publicQuoteRoutes.post("/:token/respond", async (req, res) => {
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
      return res.status(400).json({ error: "You have already responded to this quote" });
    }

    // Update quote with customer response
    const updatedQuote = await quoteStorage.updateQuote(quote.id, {
      customerResponse: response,
      customerNotes: notes || undefined,
      respondedAt: new Date(),
      status: response
    });

    res.json(updatedQuote);
  } catch (error) {
    console.error("Error responding to quote:", error);
    res.status(500).json({ error: "Failed to respond to quote" });
  }
});