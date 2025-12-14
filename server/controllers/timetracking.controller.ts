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
    this.createManualEntry = this.createManualEntry.bind(this);
    this.updateEntry = this.updateEntry.bind(this);
    this.deleteEntry = this.deleteEntry.bind(this);
    this.getProjectLaborCosts = this.getProjectLaborCosts.bind(this);
  }

  /**
   * POST /api/time/clock-in
   * Clock in a user for a project
   */
  async clockIn(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      console.log('[TimeTracking] Clock-in request received:', {
        userId: user?.id,
        body: req.body,
        timestamp: new Date().toISOString()
      });

      if (!user) {
        console.log('[TimeTracking] Clock-in FAILED: No user authenticated');
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Validate request body
      const validationResult = clockInSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log('[TimeTracking] Clock-in FAILED: Validation error:', validationResult.error.errors);
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors,
        });
        return;
      }

      const { projectId, latitude, longitude, notes } = validationResult.data;
      console.log('[TimeTracking] Clock-in validated data:', { userId: user.id, projectId, latitude, longitude });

      // Call service
      const result = await timeTrackingService.clockIn({
        userId: user.id,
        projectId,
        latitude,
        longitude,
        notes,
      });

      if (!result.success) {
        console.log('[TimeTracking] Clock-in FAILED:', result.error);
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to clock in',
          timeEntry: result.timeEntry,
        });
        return;
      }

      console.log('[TimeTracking] Clock-in SUCCESS:', {
        timeEntryId: result.timeEntry?.id,
        withinGeofence: result.geofenceValidation?.withinGeofence,
        distance: result.geofenceValidation?.distanceMeters
      });

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
      console.error('[TimeTracking] Clock-in EXCEPTION:', error);
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

  /**
   * POST /api/time/manual-entry
   * Create a manual time entry (Admin/PM only)
   */
  async createManualEntry(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Only admins and PMs can create manual entries
      if (user.role !== 'admin' && user.role !== 'projectManager') {
        res.status(403).json({ success: false, message: 'Forbidden: Admin or PM access required' });
        return;
      }

      const { userId, projectId, startTime, endTime, notes } = req.body;

      if (!userId || !projectId || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, projectId, startTime, endTime',
        });
        return;
      }

      const result = await timeTrackingService.createManualEntry({
        userId: parseInt(userId),
        projectId: parseInt(projectId),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        notes,
        createdBy: user.id,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to create manual entry',
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Manual entry created successfully',
        timeEntry: result.timeEntry,
      });
    } catch (error) {
      console.error('Error in createManualEntry controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while creating manual entry',
      });
    }
  }

  /**
   * PATCH /api/time/entries/:id
   * Update a time entry (Admin/PM only)
   */
  async updateEntry(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Only admins and PMs can update entries
      if (user.role !== 'admin' && user.role !== 'projectManager') {
        res.status(403).json({ success: false, message: 'Forbidden: Admin or PM access required' });
        return;
      }

      const entryId = parseInt(req.params.id);
      if (isNaN(entryId)) {
        res.status(400).json({ success: false, message: 'Invalid entry ID' });
        return;
      }

      const { startTime, endTime, notes, userId, projectId } = req.body;

      const result = await timeTrackingService.updateTimeEntry(entryId, {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        notes,
        userId: userId ? parseInt(userId) : undefined,
        projectId: projectId ? parseInt(projectId) : undefined,
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to update entry',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Entry updated successfully',
        timeEntry: result.timeEntry,
      });
    } catch (error) {
      console.error('Error in updateEntry controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while updating entry',
      });
    }
  }

  /**
   * DELETE /api/time/entries/:id
   * Delete a time entry (Admin/PM only)
   */
  async deleteEntry(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      // Only admins and PMs can delete entries
      if (user.role !== 'admin' && user.role !== 'projectManager') {
        res.status(403).json({ success: false, message: 'Forbidden: Admin or PM access required' });
        return;
      }

      const entryId = parseInt(req.params.id);
      if (isNaN(entryId)) {
        res.status(400).json({ success: false, message: 'Invalid entry ID' });
        return;
      }

      const result = await timeTrackingService.deleteTimeEntry(entryId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to delete entry',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Entry deleted successfully',
      });
    } catch (error) {
      console.error('Error in deleteEntry controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while deleting entry',
      });
    }
  }

  /**
   * GET /api/time/project/:projectId/labor-costs
   * Get total labor costs for a project
   */
  async getProjectLaborCosts(req: Request, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, message: 'Invalid project ID' });
        return;
      }

      const laborCosts = await timeTrackingService.getProjectLaborCosts(projectId);

      res.status(200).json({
        success: true,
        laborCosts,
      });
    } catch (error) {
      console.error('Error in getProjectLaborCosts controller:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching labor costs',
      });
    }
  }
}

// Export singleton instance
export const timeTrackingController = new TimeTrackingController();
