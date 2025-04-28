import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { randomBytes } from 'crypto';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import specific types from the new types file
import { UserProfile } from '../storage/types';
import { User, insertUserSchema } from '../../shared/schema'; // Keep User type for req.user casting
import { HttpError } from '../errors';
// Assuming helper functions are exported from auth.ts or similar
// IMPORTANT: These helpers in ../auth.ts must also be updated to use storage.users internally!
import { createAndSendMagicLink, verifyMagicTokenAndGetUser, hashPassword } from '../auth';

// --- Zod Schemas for API Input Validation (Unchanged) ---

const loginSchema = z.object({
  email: z.string().email("Invalid email format."),
  password: z.string().min(1, "Password is required."),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email("Invalid email format."),
});

const magicLinkVerifySchema = z.object({
  token: z.string().uuid("Invalid token format."),
});

const profileSetupSchema = insertUserSchema.pick({
    firstName: true,
    lastName: true,
}).extend({
    password: z.string().min(8, "Password must be at least 8 characters long."),
});

// Password reset schemas
const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email format.")
});

const resetTokenVerifySchema = z.object({
  token: z.string().min(32, "Invalid token format.")
});

const passwordResetSchema = z.object({
  token: z.string().min(32, "Invalid token format."),
  password: z.string().min(8, "Password must be at least 8 characters long.")
});

// --- Controller Functions ---

/**
 * Handles response after successful Passport local authentication.
 * Authentication middleware (configured in auth.ts) uses storage.users.findUserByEmail implicitly.
 */
export const loginUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new HttpError(500, 'Login successful but user data unavailable in request.'));
  }
  // Return user profile fetched during authentication/deserialization
  // Ensure deserializeUser in auth.ts fetches the profile correctly using storage.users
  res.status(200).json(req.user as UserProfile);
};

/**
 * Logs the current user out.
 */
export const logoutUser = (req: Request, res: Response, next: NextFunction): void => {
  req.logout((logoutErr) => {
    if (logoutErr) { console.error('Error during req.logout:', logoutErr); }
    req.session.destroy((destroyErr) => {
      if (destroyErr) { console.error('Error destroying session:', destroyErr); }
      res.clearCookie('connect.sid'); // Use appropriate cookie name & options
      res.status(200).json({ message: 'Logout successful' });
    });
  });
};

/**
 * Checks session status and returns user profile if logged in.
 */
export const getAuthStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.isAuthenticated() && req.user) {
       // Use the nested repository: storage.users
       const userProfile = await storage.users.getUserProfileById(req.user.id);

       if (userProfile) {
            res.status(200).json({ isAuthenticated: true, user: userProfile });
       } else {
           console.warn(`User ID ${req.user.id} found in session but not in DB.`);
            req.logout(() => { /* ignore */ });
            req.session.destroy(() => { /* ignore */ });
            res.clearCookie('connect.sid');
            res.status(200).json({ isAuthenticated: false, user: null });
       }
    } else {
      res.status(200).json({ isAuthenticated: false, user: null });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Initiates the magic link login process.
 * Relies on createAndSendMagicLink helper in auth.ts, which must use storage.users.
 */
export const requestMagicLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validationResult = magicLinkRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid email format.', validationResult.error.flatten());
    }
    const { email } = validationResult.data;

    // Call helper (ensure it uses storage.users internally for findUserByEmail, storeMagicLinkToken)
    await createAndSendMagicLink(email);

    res.status(200).json({ message: 'If an account exists for this email, a magic link has been sent.' });
  } catch (error) {
     console.error("Error requesting magic link:", error);
     res.status(200).json({ message: 'If an account exists for this email, a magic link has been sent.' });
  }
};


/**
 * Verifies a magic link token, logs user in, checks profile status.
 * Relies on verifyMagicTokenAndGetUser helper in auth.ts, which must use storage.users.
 */
export const verifyMagicLink = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const tokenValidation = magicLinkVerifySchema.safeParse(req.query);
        if (!tokenValidation.success) {
            throw new HttpError(400, 'Invalid or missing magic link token.');
        }
        const { token } = tokenValidation.data;

        // Call helper (ensure it uses storage.users for find/verify/delete token, getUserById)
        const user = await verifyMagicTokenAndGetUser(token);

        if (!user) { throw new HttpError(401, 'Invalid or expired magic link token.'); }

        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Failed to login user after magic link verification:', loginErr);
                return next(new HttpError(500, 'Failed to establish session after verification.'));
            }
            // Fetch profile using the correct type from storage/types
            const userProfile: UserProfile = {
                 id: user.id,
                 firstName: user.firstName,
                 lastName: user.lastName,
                 email: user.email,
                 role: user.role,
                 createdAt: user.createdAt,
                 updatedAt: user.updatedAt,
                 profileComplete: user.profileComplete,
            };

            res.status(200).json({
                message: 'Magic link verified successfully.',
                user: userProfile, // Return profile data
                needsProfileSetup: !user.profileComplete,
            });
        });

    } catch(error) {
        next(error);
    }
};

/**
 * Sets up user profile (name, password) after magic link login.
 */
export const setupProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
     try {
        const user = req.user as User;
        if (!user?.id) {
            throw new HttpError(401, 'Authentication required. Please log in again.');
        }

        const validationResult = profileSetupSchema.safeParse(req.body);
        if (!validationResult.success) {
            throw new HttpError(400, 'Invalid profile data.', validationResult.error.flatten());
        }
        const { firstName, lastName, password } = validationResult.data;

        // Use the nested repository: storage.users
        const updatedUserProfile = await storage.users.setupUserProfile(user.id, firstName, lastName, password);

        if (!updatedUserProfile) {
             throw new HttpError(500, 'Failed to update profile.');
        }

        // The user object in the session might be stale after this.
        // Passport's behavior depends on serialize/deserializeUser.
        // Client might need to refetch auth status.
        res.status(200).json(updatedUserProfile);

     } catch(error) {
        next(error);
     }
};

/**
 * Request a password reset link
 */
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validationResult = passwordResetRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid email format.', validationResult.error.flatten());
    }
    
    const { email } = validationResult.data;
    
    // Generate a reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token valid for 1 hour
    
    // Find the user and update with reset token
    const user = await storage.getUserByEmail(email);
    
    // Don't reveal if user exists for security reasons
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.status(200).json({ 
        message: 'If an account exists with that email, a password reset link has been sent.' 
      });
    }
    
    // Store the reset token in the user record
    await storage.updateUser(user.id, {
      resetToken,
      resetTokenExpiry
    });
    
    // TODO: In a real implementation, send an email with the reset link
    // For development, just return the token
    if (process.env.NODE_ENV === 'development') {
      return res.status(200).json({
        message: 'Password reset link generated',
        resetToken,
        resetLink: `/reset-password?token=${resetToken}`
      });
    }
    
    res.status(200).json({ 
      message: 'If an account exists with that email, a password reset link has been sent.' 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify a password reset token
 */
export const verifyResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;
    
    if (!token || token.length < 32) {
      throw new HttpError(400, 'Invalid reset token');
    }
    
    // Find user with this reset token
    const user = await storage.getUserByResetToken(token);
    
    if (!user) {
      throw new HttpError(400, 'Invalid or expired reset token');
    }
    
    // Check if token is expired
    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
      throw new HttpError(400, 'Reset token has expired');
    }
    
    res.status(200).json({ 
      message: 'Reset token is valid',
      email: user.email
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validationResult = passwordResetSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid reset data', validationResult.error.flatten());
    }
    
    const { token, password } = validationResult.data;
    
    // Find user with this reset token
    const user = await storage.getUserByResetToken(token);
    
    if (!user) {
      throw new HttpError(400, 'Invalid or expired reset token');
    }
    
    // Check if token is expired
    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
      throw new HttpError(400, 'Reset token has expired');
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(password);
    
    // Update the user with new password and clear the reset token
    await storage.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    });
    
    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};