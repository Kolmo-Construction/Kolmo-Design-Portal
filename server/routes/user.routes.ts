/**
 * User Management Routes
 * Handles user data and hourly rate management
 */

import { Router } from 'express';
import { getAllUsers, updateHourlyRate } from '../controllers/user.controller';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', isAuthenticated, isAdmin, getAllUsers);

/**
 * PATCH /api/users/:userId/hourly-rate
 * Update user's hourly rate (admin only)
 */
router.patch('/:userId/hourly-rate', isAuthenticated, isAdmin, updateHourlyRate);

export default router;
