// server/services/timetracking.service.ts

/**
 * Time Tracking Service
 * Handles clock in/out logic, geofence validation, and duration calculations
 */

import { timeEntryRepository } from '../storage/repositories/timeentry.repository';
import { projectRepository } from '../storage/repositories/project.repository';
import { isWithinGeofence, areValidCoordinates, GeofenceValidationResult } from './geofencing.service';
import * as schema from '../../shared/schema';

export interface ClockInParams {
  userId: number;
  projectId: number;
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface ClockOutParams {
  userId: number;
  latitude: number;
  longitude: number;
  notes?: string;
}

export interface TimeTrackingResult {
  success: boolean;
  timeEntry?: schema.TimeEntry;
  error?: string;
  geofenceValidation?: GeofenceValidationResult;
}

/**
 * Time Tracking Service
 * Singleton class for managing time entry operations
 */
class TimeTrackingService {
  private initialized: boolean = false;

  constructor() {
    this.initialized = true;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clock in a user for a project
   * Creates a new time entry with geofence validation
   */
  async clockIn(params: ClockInParams): Promise<TimeTrackingResult> {
    try {
      const { userId, projectId, latitude, longitude, notes } = params;

      // Validate coordinates
      if (!areValidCoordinates(latitude, longitude)) {
        return {
          success: false,
          error: 'Invalid GPS coordinates provided',
        };
      }

      // Check for existing active time entry
      const activeEntry = await timeEntryRepository.findActiveByUserId(userId);
      if (activeEntry) {
        return {
          success: false,
          error: `You are already clocked in to ${activeEntry.project?.name || 'a project'}. Please clock out first.`,
          timeEntry: activeEntry,
        };
      }

      // Fetch project details for geofencing
      const project = await projectRepository.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Validate geofence if project has coordinates
      let geofenceResult: GeofenceValidationResult | undefined;
      let withinGeofence = false;
      let distanceMeters: number | undefined;

      if (project.latitude && project.longitude) {
        geofenceResult = isWithinGeofence(
          latitude,
          longitude,
          Number(project.latitude),
          Number(project.longitude),
          100 // Default threshold: 100 meters
        );
        withinGeofence = geofenceResult.withinGeofence;
        distanceMeters = geofenceResult.distanceMeters;
      } else {
        // Project has no coordinates - can't validate geofence
        withinGeofence = false;
      }

      // Create time entry
      const newEntry = await timeEntryRepository.create({
        userId,
        projectId,
        startTime: new Date(),
        endTime: null,
        durationMinutes: null,
        clockInLatitude: latitude.toString(),
        clockInLongitude: longitude.toString(),
        clockOutLatitude: null,
        clockOutLongitude: null,
        clockInWithinGeofence: withinGeofence,
        clockInDistanceMeters: distanceMeters?.toFixed(2) || null,
        clockOutWithinGeofence: null,
        clockOutDistanceMeters: null,
        notes: notes || null,
      });

      // Fetch the complete entry with relations
      const completeEntry = await timeEntryRepository.findById(newEntry.id);

      return {
        success: true,
        timeEntry: completeEntry!,
        geofenceValidation: geofenceResult,
      };
    } catch (error) {
      console.error('Error in clockIn:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clock in',
      };
    }
  }

  /**
   * Clock out a user from their active time entry
   * Updates the entry with end time, coordinates, and calculates duration
   */
  async clockOut(params: ClockOutParams): Promise<TimeTrackingResult> {
    try {
      const { userId, latitude, longitude, notes } = params;

      // Validate coordinates
      if (!areValidCoordinates(latitude, longitude)) {
        return {
          success: false,
          error: 'Invalid GPS coordinates provided',
        };
      }

      // Find active time entry
      const activeEntry = await timeEntryRepository.findActiveByUserId(userId);
      if (!activeEntry) {
        return {
          success: false,
          error: 'No active time entry found. You must clock in first.',
        };
      }

      // Fetch project for geofencing
      const project = await projectRepository.getProjectById(activeEntry.projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Validate geofence for clock out if project has coordinates
      let geofenceResult: GeofenceValidationResult | undefined;
      let withinGeofence = false;
      let distanceMeters: number | undefined;

      if (project.latitude && project.longitude) {
        geofenceResult = isWithinGeofence(
          latitude,
          longitude,
          Number(project.latitude),
          Number(project.longitude),
          100 // Default threshold: 100 meters
        );
        withinGeofence = geofenceResult.withinGeofence;
        distanceMeters = geofenceResult.distanceMeters;
      } else {
        withinGeofence = false;
      }

      // Calculate duration in minutes
      const endTime = new Date();
      const startTime = new Date(activeEntry.startTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      // Calculate labor cost if user has hourly rate
      let laborCost: string | null = null;
      if (activeEntry.user?.hourlyRate) {
        const durationHours = durationMinutes / 60;
        const hourlyRate = Number(activeEntry.user.hourlyRate);
        laborCost = (durationHours * hourlyRate).toFixed(2);
        console.log(`[TimeTracking] Calculated labor cost: ${durationHours}h × $${hourlyRate}/h = $${laborCost}`);
      } else {
        console.log('[TimeTracking] No hourly rate set for user, labor cost not calculated');
      }

      // Update time entry with clock out data
      const updatedEntry = await timeEntryRepository.update(activeEntry.id, {
        endTime,
        durationMinutes,
        laborCost,
        clockOutLatitude: latitude.toString(),
        clockOutLongitude: longitude.toString(),
        clockOutWithinGeofence: withinGeofence,
        clockOutDistanceMeters: distanceMeters?.toFixed(2) || null,
        notes: notes || activeEntry.notes || null,
      });

      if (!updatedEntry) {
        return {
          success: false,
          error: 'Failed to update time entry',
        };
      }

      // Fetch the complete entry with relations
      const completeEntry = await timeEntryRepository.findById(updatedEntry.id);

      return {
        success: true,
        timeEntry: completeEntry!,
        geofenceValidation: geofenceResult,
      };
    } catch (error) {
      console.error('Error in clockOut:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clock out',
      };
    }
  }

  /**
   * Get active time entry for a user
   */
  async getActiveEntry(userId: number): Promise<schema.TimeEntry | null> {
    try {
      return await timeEntryRepository.findActiveByUserId(userId);
    } catch (error) {
      console.error('Error getting active entry:', error);
      return null;
    }
  }

  /**
   * Get time entries for a user with optional filters
   */
  async getUserEntries(
    userId: number,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      includeActive?: boolean;
    }
  ): Promise<schema.TimeEntry[]> {
    try {
      return await timeEntryRepository.findByUserId(userId, filters);
    } catch (error) {
      console.error('Error getting user entries:', error);
      return [];
    }
  }

  /**
   * Get time entries for a project with optional filters
   */
  async getProjectEntries(
    projectId: number,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      includeActive?: boolean;
    }
  ): Promise<schema.TimeEntry[]> {
    try {
      return await timeEntryRepository.findByProjectId(projectId, filters);
    } catch (error) {
      console.error('Error getting project entries:', error);
      return [];
    }
  }

  /**
   * Calculate total hours for time entries
   */
  calculateTotalHours(entries: schema.TimeEntry[]): number {
    const totalMinutes = entries.reduce((sum, entry) => {
      return sum + (entry.durationMinutes || 0);
    }, 0);
    return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
  }
}

// Export singleton instance
export const timeTrackingService = new TimeTrackingService();
