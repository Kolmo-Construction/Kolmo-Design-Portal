// server/controllers/timetracking.controller.ts

/**
 * Time Tracking Controller
 * Handles HTTP requests for time tracking operations
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { timeTrackingService } from '../services/timetracking.service';

// Validation schemas
const clockInSchema = z.object({
  projectId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().optional(),
});

const clockOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().optional(),
});

const getEntriesSchema = z.object({
  projectId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  userId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  includeActive: z.string().optional().transform(val => val === 'true'),
});

/**
 * Time Tracking Controller Class
 */
export class TimeTrackingController {
  constructor() {
    // Bind methods to ensure proper 'this' context
    this.clockIn = this.clockIn.bind(this);
    this.clockOut = this.clockOut.bind(this);
    this.getActiveEntry = this.getActiveEntry.bind(this);
    this.getEntries = this.getEntries.bind(this);
  }

  /**
   * POST /api/time/clock-in
   * Clock in a user for a project
   */
  async clockIn(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Validate request body
      const validationResult = clockInSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors,
        });
        return;
      }

      const { projectId, latitude, longitude, notes } = validationResult.data;

      // Call service
      const result = await timeTrackingService.clockIn({
        userId: user.id,
        projectId,
        latitude,
        longitude,
        notes,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to clock in',
          timeEntry: result.timeEntry,
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Clocked in successfully',
        timeEntry: result.timeEntry,
        geofence: result.geofenceValidation
          ? {
              withinGeofence: result.geofenceValidation.withinGeofence,
              distanceMeters: Math.round(result.geofenceValidation.distanceMeters),
            }
          : undefined,
      });
    } catch (error) {
      console.error('Error in clockIn controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while clocking in',
      });
    }
  }

  /**
   * POST /api/time/clock-out
   * Clock out a user from their active time entry
   */
  async clockOut(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Validate request body
      const validationResult = clockOutSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors,
        });
        return;
      }

      const { latitude, longitude, notes } = validationResult.data;

      // Call service
      const result = await timeTrackingService.clockOut({
        userId: user.id,
        latitude,
        longitude,
        notes,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to clock out',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Clocked out successfully',
        timeEntry: result.timeEntry,
        geofence: result.geofenceValidation
          ? {
              withinGeofence: result.geofenceValidation.withinGeofence,
              distanceMeters: Math.round(result.geofenceValidation.distanceMeters),
            }
          : undefined,
      });
    } catch (error) {
      console.error('Error in clockOut controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while clocking out',
      });
    }
  }

  /**
   * GET /api/time/active
   * Get the current user's active time entry
   */
  async getActiveEntry(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const activeEntry = await timeTrackingService.getActiveEntry(user.id);

      if (!activeEntry) {
        res.status(200).json({
          success: true,
          message: 'No active time entry',
          timeEntry: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        timeEntry: activeEntry,
      });
    } catch (error) {
      console.error('Error in getActiveEntry controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching active entry',
      });
    }
  }

  /**
   * GET /api/time/entries
   * Get time entries with optional filters
   * Query params: projectId, userId, startDate, endDate, includeActive
   */
  async getEntries(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Validate query parameters
      const validationResult = getEntriesSchema.safeParse(req.query);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: validationResult.error.errors,
        });
        return;
      }

      const { projectId, userId, startDate, endDate, includeActive } = validationResult.data;

      // Determine which entries to fetch
      let entries;
      if (projectId) {
        // Fetch by project
        entries = await timeTrackingService.getProjectEntries(projectId, {
          startDate,
          endDate,
          includeActive,
        });
      } else if (userId && (user.role === 'admin' || user.role === 'projectManager')) {
        // Admins and PMs can fetch any user's entries
        entries = await timeTrackingService.getUserEntries(userId, {
          startDate,
          endDate,
          includeActive,
        });
      } else {
        // Regular users can only fetch their own entries
        entries = await timeTrackingService.getUserEntries(user.id, {
          startDate,
          endDate,
          includeActive,
        });
      }

      // Calculate totals
      const totalHours = timeTrackingService.calculateTotalHours(entries);
      const totalEntries = entries.length;

      res.status(200).json({
        success: true,
        entries,
        summary: {
          totalEntries,
          totalHours,
        },
      });
    } catch (error) {
      console.error('Error in getEntries controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching entries',
      });
    }
  }
}

// Export singleton instance
export const timeTrackingController = new TimeTrackingController();
