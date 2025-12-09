/**
 * User Management Controller
 * Handles user data and hourly rate management
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage/index';
import { HttpError } from '../errors';

// Validation schema for hourly rate update
const hourlyRateSchema = z.object({
  hourlyRate: z.number().min(0).max(999.99).nullable(),
});

/**
 * Get all users (admin only)
 * GET /api/users
 */
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser) {
      throw new HttpError(401, 'Unauthorized');
    }

    // Only admins can view all users
    if (currentUser.role !== 'admin') {
      throw new HttpError(403, 'Forbidden: Admin access required');
    }

    // Fetch all users with their hourly rates
    const users = await storage.users.getAllUsers();

    // Map to safe user data (exclude sensitive fields)
    const safeUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      hourlyRate: user.hourlyRate,
      createdAt: user.createdAt,
    }));

    res.status(200).json(safeUsers);
  } catch (error) {
    console.error('[GetAllUsers] Error:', error);
    next(error);
  }
};

/**
 * Update user hourly rate (admin only)
 * PATCH /api/users/:userId/hourly-rate
 */
export const updateHourlyRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser) {
      throw new HttpError(401, 'Unauthorized');
    }

    // Only admins can update hourly rates
    if (currentUser.role !== 'admin') {
      throw new HttpError(403, 'Forbidden: Admin access required');
    }

    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      throw new HttpError(400, 'Invalid user ID');
    }

    // Validate request body
    const validationResult = hourlyRateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid hourly rate', validationResult.error.flatten());
    }

    const { hourlyRate } = validationResult.data;

    // Update user's hourly rate
    const updatedUser = await storage.users.updateUser(userId, {
      hourlyRate: hourlyRate?.toString() || null,
    });

    if (!updatedUser) {
      throw new HttpError(404, 'User not found');
    }

    console.log(`[UpdateHourlyRate] Updated hourly rate for user ${userId} to $${hourlyRate || 0}/hr`);

    res.status(200).json({
      success: true,
      message: 'Hourly rate updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        hourlyRate: updatedUser.hourlyRate,
      },
    });
  } catch (error) {
    console.error('[UpdateHourlyRate] Error:', error);
    next(error);
  }
};
