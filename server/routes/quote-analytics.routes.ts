import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { QuoteAnalyticsController } from "../controllers/quote-analytics.controller";

const router = Router();
const analyticsController = new QuoteAnalyticsController();

// Public routes (no authentication required) - for customer tracking
router.post("/quotes/:quoteId/analytics/track", analyticsController.trackEvent.bind(analyticsController));
router.post("/quotes/:quoteId/analytics/session", analyticsController.createOrUpdateSession.bind(analyticsController));
router.patch("/analytics/session/duration", analyticsController.updateSessionDuration.bind(analyticsController));
router.patch("/analytics/session/scroll", analyticsController.updateScrollDepth.bind(analyticsController));

// Protected admin routes
router.get("/quotes/:quoteId/analytics/summary", isAuthenticated, analyticsController.getAnalyticsSummary.bind(analyticsController));
router.get("/quotes/:quoteId/analytics/details", isAuthenticated, analyticsController.getAnalyticsDetails.bind(analyticsController));

export default router;