import { Request, Response } from "express";
import { QuoteAnalyticsRepository } from "../storage/repositories/quote-analytics.repository";
import { z } from "zod";

const trackEventSchema = z.object({
  event: z.string(),
  eventData: z.any().optional(),
  sessionId: z.string().optional(),
  deviceType: z.string().optional(),
  browser: z.string().optional(),
  operatingSystem: z.string().optional(),
  screenResolution: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  timeOnPage: z.number().optional(),
  scrollDepth: z.number().optional(),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

const sessionSchema = z.object({
  sessionId: z.string(),
  deviceFingerprint: z.string().optional(),
  sectionsViewed: z.array(z.string()).optional(),
  actionsPerformed: z.array(z.any()).optional(),
  customerEmail: z.string().optional(),
  customerName: z.string().optional(),
});

export class QuoteAnalyticsController {
  private analyticsRepository: QuoteAnalyticsRepository;

  constructor() {
    this.analyticsRepository = new QuoteAnalyticsRepository();
  }

  // Track analytics event (public endpoint - no auth required)
  async trackEvent(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.quoteId);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const validatedData = trackEventSchema.parse(req.body);
      
      // Extract device info from user agent
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      const event = await this.analyticsRepository.trackEvent({
        quoteId,
        ...validatedData,
        userAgent,
        ipAddress,
      });

      res.status(201).json({ success: true, eventId: event.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error tracking event:", error);
      res.status(500).json({ error: "Failed to track event" });
    }
  }

  // Create or update view session (public endpoint)
  async createOrUpdateSession(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.quoteId);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const validatedData = sessionSchema.parse(req.body);
      
      const session = await this.analyticsRepository.createOrUpdateSession({
        quoteId,
        ...validatedData,
      });

      res.status(200).json({ success: true, sessionId: session.sessionId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error managing session:", error);
      res.status(500).json({ error: "Failed to manage session" });
    }
  }

  // Get analytics summary for a quote (admin only)
  async getAnalyticsSummary(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.quoteId);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const summary = await this.analyticsRepository.getQuoteAnalyticsSummary(quoteId);
      const sessions = await this.analyticsRepository.getQuoteViewSessions(quoteId);
      const deviceStats = await this.analyticsRepository.getDeviceAnalytics(quoteId);
      const geoStats = await this.analyticsRepository.getGeographicAnalytics(quoteId);

      res.json({
        summary,
        sessions,
        deviceStats,
        geoStats,
      });
    } catch (error) {
      console.error("Error getting analytics summary:", error);
      res.status(500).json({ error: "Failed to get analytics summary" });
    }
  }

  // Get detailed analytics for a quote (admin only)
  async getAnalyticsDetails(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.quoteId);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const events = await this.analyticsRepository.getQuoteAnalyticsDetails(quoteId, limit);

      res.json(events);
    } catch (error) {
      console.error("Error getting analytics details:", error);
      res.status(500).json({ error: "Failed to get analytics details" });
    }
  }

  // Update session duration (public endpoint)
  async updateSessionDuration(req: Request, res: Response) {
    try {
      const { sessionId, duration } = req.body;
      
      if (!sessionId || typeof duration !== 'number') {
        return res.status(400).json({ error: "Session ID and duration are required" });
      }

      await this.analyticsRepository.updateSessionDuration(sessionId, duration);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating session duration:", error);
      res.status(500).json({ error: "Failed to update session duration" });
    }
  }

  // Update scroll depth (public endpoint)
  async updateScrollDepth(req: Request, res: Response) {
    try {
      const { sessionId, scrollDepth } = req.body;
      
      if (!sessionId || typeof scrollDepth !== 'number') {
        return res.status(400).json({ error: "Session ID and scroll depth are required" });
      }

      await this.analyticsRepository.updateMaxScrollDepth(sessionId, scrollDepth);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating scroll depth:", error);
      res.status(500).json({ error: "Failed to update scroll depth" });
    }
  }
}