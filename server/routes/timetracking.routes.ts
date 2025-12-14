// server/routes/timetracking.routes.ts

/**
 * Time Tracking Routes
 * Endpoints for mobile time tracking with geofencing
 */

import { Router } from 'express';
import { timeTrackingController } from '../controllers/timetracking.controller';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/time/clock-in
 * Clock in to a project with GPS coordinates
 * Requires: projectId, latitude, longitude
 * Optional: notes
 */
router.post('/clock-in', isAuthenticated, timeTrackingController.clockIn);

/**
 * POST /api/time/clock-out
 * Clock out from active time entry with GPS coordinates
 * Requires: latitude, longitude
 * Optional: notes
 */
router.post('/clock-out', isAuthenticated, timeTrackingController.clockOut);

/**
 * GET /api/time/active
 * Get the current user's active time entry
 */
router.get('/active', isAuthenticated, timeTrackingController.getActiveEntry);

/**
 * GET /api/time/entries
 * Get time entries with optional filters
 * Query params: projectId, userId, startDate, endDate, includeActive
 * - Regular users: can only fetch their own entries
 * - Admins/PMs: can fetch any user's entries or project entries
 */
router.get('/entries', isAuthenticated, timeTrackingController.getEntries);

/**
 * POST /api/time/manual-entry
 * Create a manual time entry (Admin/PM only)
 * Requires: userId, projectId, startTime, endTime
 * Optional: notes
 */
router.post('/manual-entry', isAuthenticated, timeTrackingController.createManualEntry);

/**
 * PATCH /api/time/entries/:id
 * Update a time entry (Admin/PM only)
 */
router.patch('/entries/:id', isAuthenticated, timeTrackingController.updateEntry);

/**
 * DELETE /api/time/entries/:id
 * Delete a time entry (Admin/PM only)
 */
router.delete('/entries/:id', isAuthenticated, timeTrackingController.deleteEntry);

/**
 * GET /api/time/project/:projectId/labor-costs
 * Get total labor costs for a project
 * Returns: totalLaborCost, totalHours, entryCount
 */
router.get('/project/:projectId/labor-costs', isAuthenticated, timeTrackingController.getProjectLaborCosts);

export default router;
