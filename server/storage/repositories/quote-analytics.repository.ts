import { db } from "../../db";
import { quoteAnalytics, quoteViewSessions } from "@shared/schema";
import { eq, desc, and, gte, lte, count, sql } from "drizzle-orm";

export interface AnalyticsEvent {
  quoteId: number;
  event: string;
  eventData?: any;
  sessionId?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
  screenResolution?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  timezone?: string;
  timeOnPage?: number;
  scrollDepth?: number;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ViewSession {
  quoteId: number;
  sessionId: string;
  deviceFingerprint?: string;
  customerEmail?: string;
  customerName?: string;
  sectionsViewed?: string[];
  actionsPerformed?: any[];
}

export class QuoteAnalyticsRepository {
  // Track a new analytics event
  async trackEvent(eventData: AnalyticsEvent) {
    try {
      const [event] = await db.insert(quoteAnalytics).values({
        quoteId: eventData.quoteId,
        event: eventData.event,
        eventData: eventData.eventData,
        sessionId: eventData.sessionId,
        userAgent: eventData.userAgent,
        deviceType: eventData.deviceType,
        browser: eventData.browser,
        operatingSystem: eventData.operatingSystem,
        screenResolution: eventData.screenResolution,
        ipAddress: eventData.ipAddress,
        country: eventData.country,
        city: eventData.city,
        timezone: eventData.timezone,
        timeOnPage: eventData.timeOnPage,
        scrollDepth: eventData.scrollDepth,
        referrer: eventData.referrer,
        utmSource: eventData.utmSource,
        utmMedium: eventData.utmMedium,
        utmCampaign: eventData.utmCampaign,
      }).returning();

      return event;
    } catch (error) {
      console.error("Error tracking analytics event:", error);
      throw error;
    }
  }

  // Create or update a view session
  async createOrUpdateSession(sessionData: ViewSession) {
    try {
      // Check if session exists
      const existingSession = await db
        .select()
        .from(quoteViewSessions)
        .where(
          and(
            eq(quoteViewSessions.quoteId, sessionData.quoteId),
            eq(quoteViewSessions.sessionId, sessionData.sessionId)
          )
        )
        .limit(1);

      if (existingSession.length > 0) {
        // Update existing session
        const [updatedSession] = await db
          .update(quoteViewSessions)
          .set({
            lastActivity: new Date(),
            pageViews: sql`${quoteViewSessions.pageViews} + 1`,
            sectionsViewed: sessionData.sectionsViewed,
            actionsPerformed: sessionData.actionsPerformed,
            customerEmail: sessionData.customerEmail || existingSession[0].customerEmail,
            customerName: sessionData.customerName || existingSession[0].customerName,
            updatedAt: new Date(),
          })
          .where(eq(quoteViewSessions.id, existingSession[0].id))
          .returning();

        return updatedSession;
      } else {
        // Create new session
        const [newSession] = await db
          .insert(quoteViewSessions)
          .values({
            quoteId: sessionData.quoteId,
            sessionId: sessionData.sessionId,
            deviceFingerprint: sessionData.deviceFingerprint,
            sectionsViewed: sessionData.sectionsViewed || [],
            actionsPerformed: sessionData.actionsPerformed || [],
            customerEmail: sessionData.customerEmail,
            customerName: sessionData.customerName,
          })
          .returning();

        return newSession;
      }
    } catch (error) {
      console.error("Error creating/updating view session:", error);
      throw error;
    }
  }

  // Get analytics summary for a quote
  async getQuoteAnalyticsSummary(quoteId: number) {
    try {
      const [summary] = await db
        .select({
          totalViews: count(),
          uniqueSessions: sql<number>`COUNT(DISTINCT ${quoteAnalytics.sessionId})`.as('uniqueSessions'),
          totalTimeOnPage: sql<number>`SUM(${quoteAnalytics.timeOnPage})`.as('totalTimeOnPage'),
          avgScrollDepth: sql<number>`AVG(${quoteAnalytics.scrollDepth})`.as('avgScrollDepth'),
        })
        .from(quoteAnalytics)
        .where(eq(quoteAnalytics.quoteId, quoteId));

      return summary;
    } catch (error) {
      console.error("Error getting analytics summary:", error);
      throw error;
    }
  }

  // Get detailed analytics for a quote
  async getQuoteAnalyticsDetails(quoteId: number, limit = 100) {
    try {
      const events = await db
        .select()
        .from(quoteAnalytics)
        .where(eq(quoteAnalytics.quoteId, quoteId))
        .orderBy(desc(quoteAnalytics.createdAt))
        .limit(limit);

      return events;
    } catch (error) {
      console.error("Error getting analytics details:", error);
      throw error;
    }
  }

  // Get view sessions for a quote
  async getQuoteViewSessions(quoteId: number) {
    try {
      const sessions = await db
        .select()
        .from(quoteViewSessions)
        .where(eq(quoteViewSessions.quoteId, quoteId))
        .orderBy(desc(quoteViewSessions.lastActivity));

      return sessions;
    } catch (error) {
      console.error("Error getting view sessions:", error);
      throw error;
    }
  }

  // Get analytics for a date range
  async getAnalyticsForDateRange(quoteId: number, startDate: Date, endDate: Date) {
    try {
      const events = await db
        .select()
        .from(quoteAnalytics)
        .where(
          and(
            eq(quoteAnalytics.quoteId, quoteId),
            gte(quoteAnalytics.createdAt, startDate),
            lte(quoteAnalytics.createdAt, endDate)
          )
        )
        .orderBy(desc(quoteAnalytics.createdAt));

      return events;
    } catch (error) {
      console.error("Error getting analytics for date range:", error);
      throw error;
    }
  }

  // Get device analytics
  async getDeviceAnalytics(quoteId: number) {
    try {
      const deviceStats = await db
        .select({
          deviceType: quoteAnalytics.deviceType,
          browser: quoteAnalytics.browser,
          operatingSystem: quoteAnalytics.operatingSystem,
          count: count(),
        })
        .from(quoteAnalytics)
        .where(eq(quoteAnalytics.quoteId, quoteId))
        .groupBy(quoteAnalytics.deviceType, quoteAnalytics.browser, quoteAnalytics.operatingSystem);

      return deviceStats;
    } catch (error) {
      console.error("Error getting device analytics:", error);
      throw error;
    }
  }

  // Get geographic analytics
  async getGeographicAnalytics(quoteId: number) {
    try {
      const geoStats = await db
        .select({
          country: quoteAnalytics.country,
          city: quoteAnalytics.city,
          count: count(),
        })
        .from(quoteAnalytics)
        .where(eq(quoteAnalytics.quoteId, quoteId))
        .groupBy(quoteAnalytics.country, quoteAnalytics.city);

      return geoStats;
    } catch (error) {
      console.error("Error getting geographic analytics:", error);
      throw error;
    }
  }

  // Update session duration
  async updateSessionDuration(sessionId: string, duration: number) {
    try {
      await db
        .update(quoteViewSessions)
        .set({
          totalDuration: duration,
          lastActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quoteViewSessions.sessionId, sessionId));
    } catch (error) {
      console.error("Error updating session duration:", error);
      throw error;
    }
  }

  // Update max scroll depth for session
  async updateMaxScrollDepth(sessionId: string, scrollDepth: number) {
    try {
      await db
        .update(quoteViewSessions)
        .set({
          maxScrollDepth: sql`GREATEST(${quoteViewSessions.maxScrollDepth}, ${scrollDepth})`,
          lastActivity: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quoteViewSessions.sessionId, sessionId));
    } catch (error) {
      console.error("Error updating scroll depth:", error);
      throw error;
    }
  }
}