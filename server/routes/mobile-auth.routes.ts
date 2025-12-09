/**
 * Mobile Authentication Routes
 * Handles mobile app login with API key generation
 */

import { Router } from 'express';
import { mobileLogin, mobileLogout, getCurrentUser } from '../controllers/mobile-auth.controller';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/auth/login
 * Mobile login endpoint - returns user info and API key
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "id": 1,
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "email": "user@example.com",
 *     "role": "contractor"
 *   },
 *   "apiKey": "kolmo_2d2eda840655d10a532d76447e954785a011c13654a733dc73e203296208bb04"
 * }
 */
router.post('/login', mobileLogin);

/**
 * POST /api/auth/mobile/logout
 * Mobile logout endpoint - revokes API key
 * Requires authentication
 */
router.post('/mobile/logout', isAuthenticated, mobileLogout);

/**
 * GET /api/auth/me
 * Get current authenticated user
 * Requires authentication (API key or session)
 */
router.get('/me', isAuthenticated, getCurrentUser);

export default router;
