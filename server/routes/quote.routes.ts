import { Router } from "express";
import multer from "multer";
import { isAuthenticated } from "../middleware/auth.middleware";
import { QuoteController } from "../controllers/quote.controller";

const router = Router();
const quoteController = new QuoteController();

// Configure multer for memory storage (for R2 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Protected admin routes
router.get("/", isAuthenticated, quoteController.getAllQuotes.bind(quoteController));
router.post("/", isAuthenticated, quoteController.createQuote.bind(quoteController));
router.get("/:id", isAuthenticated, quoteController.getQuoteById.bind(quoteController));
router.patch("/:id", isAuthenticated, quoteController.updateQuote.bind(quoteController));
router.delete("/:id", isAuthenticated, quoteController.deleteQuote.bind(quoteController));
router.post("/:id/send", isAuthenticated, quoteController.sendQuote.bind(quoteController));
router.patch("/:id/financials", isAuthenticated, quoteController.updateQuoteFinancials.bind(quoteController));

// Line item routes
router.get("/:id/line-items", isAuthenticated, quoteController.getQuoteLineItems.bind(quoteController));
router.post("/:id/line-items", isAuthenticated, quoteController.createLineItem.bind(quoteController));
router.patch("/line-items/:lineItemId", isAuthenticated, quoteController.updateLineItem.bind(quoteController));
router.delete("/line-items/:lineItemId", isAuthenticated, quoteController.deleteLineItem.bind(quoteController));

// Image routes
router.post("/:id/images", isAuthenticated, quoteController.uploadQuoteImage.bind(quoteController));
router.delete("/images/:imageId", isAuthenticated, quoteController.deleteQuoteImage.bind(quoteController));

// Photo management routes
router.get("/:id/media", isAuthenticated, quoteController.getQuoteMedia.bind(quoteController));
router.post("/:id/photos", isAuthenticated, upload.single('photo'), quoteController.uploadQuotePhoto.bind(quoteController));
router.patch("/media/:mediaId", isAuthenticated, quoteController.updateQuoteMedia.bind(quoteController));
router.delete("/media/:mediaId", isAuthenticated, quoteController.deleteQuoteImage.bind(quoteController));

// Before/After image specific routes
router.post("/:id/images/:type", isAuthenticated, upload.single('image'), quoteController.uploadBeforeAfterImage.bind(quoteController));
router.patch("/:id/images/:type/caption", isAuthenticated, quoteController.updateImageCaption.bind(quoteController));
router.delete("/:id/images/:type", isAuthenticated, quoteController.deleteBeforeAfterImage.bind(quoteController));

// Tax rate lookup route
router.post("/lookup/tax-rate", isAuthenticated, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address || address.trim().length < 5) {
      return res.status(400).json({ error: "Address is required and must be at least 5 characters" });
    }

    // Call WA State tax lookup API from backend (avoids CORS issues)
    // The API can work with full address or structured address
    const url = `http://webgis.dor.wa.gov/webapi/AddressRates.aspx?output=xml&addr=${encodeURIComponent(address)}`;
    
    console.log(`[Tax Lookup] Requesting: ${url}`);
    
    const response = await fetch(url);
    const xmlText = await response.text();
    
    console.log(`[Tax Lookup] XML Response length: ${xmlText.length}, First 500 chars: ${xmlText.substring(0, 500)}`);
    
    // Parse XML response to extract tax rate
    // Try multiple possible response formats
    let totalRate = 0;
    
    // Format 1: Combined rate element
    const rateMatch = xmlText.match(/<rate[^>]*>([^<]+)<\/rate>/i);
    if (rateMatch) {
      totalRate = parseFloat(rateMatch[1]);
      console.log(`[Tax Lookup] Found combined rate: ${totalRate}`);
    }
    
    // Format 2: State + Local rates
    if (totalRate === 0) {
      const stateRateMatch = xmlText.match(/<StateSalesUseRate>([^<]+)<\/StateSalesUseRate>/i);
      const localRateMatch = xmlText.match(/<LocalSalesUseRate>([^<]+)<\/LocalSalesUseRate>/i);
      
      if (stateRateMatch) {
        const stateRate = parseFloat(stateRateMatch[1]);
        const localRate = localRateMatch ? parseFloat(localRateMatch[1]) : 0;
        totalRate = stateRate + localRate;
        console.log(`[Tax Lookup] Found state (${stateRate}) + local (${localRate}) = ${totalRate}`);
      }
    }
    
    // Format 3: Total Rate element
    if (totalRate === 0) {
      const totalRateMatch = xmlText.match(/<TotalRate>([^<]+)<\/TotalRate>/i);
      if (totalRateMatch) {
        totalRate = parseFloat(totalRateMatch[1]);
        console.log(`[Tax Lookup] Found total rate: ${totalRate}`);
      }
    }
    
    console.log(`[Tax Lookup] Final rate: ${totalRate}`);

    if (totalRate > 0 && !isNaN(totalRate)) {
      res.json({ taxRate: totalRate });
    } else {
      // Return a default WA state tax rate if lookup fails
      // WA state base rate is 6.5%, but local rates vary
      console.log(`[Tax Lookup] No rate found, returning default`);
      res.json({ taxRate: 8.5 }); // Default WA rate
    }
  } catch (error) {
    console.error("Tax rate lookup error:", error);
    // Return default WA rate on error
    res.json({ taxRate: 8.5 });
  }
});

// Public customer routes (no authentication required)
router.get("/public/:token", quoteController.getQuoteByToken.bind(quoteController));
router.post("/public/:token/respond", quoteController.respondToQuote.bind(quoteController));

export default router;