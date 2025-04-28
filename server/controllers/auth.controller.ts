import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { storage } from '../storage';
import { User, insertUserSchema } from '../../shared/schema';
import { HttpError } from '../errors';
// Assuming helper functions are exported from auth.ts or similar
import { createAndSendMagicLink, verifyMagicTokenAndGetUser } from '../auth';

// --- Zod Schemas for API Input Validation ---

const loginSchema = z.object({
  // Allow either email or username, depending on your Passport strategy config
  email: z.string().email("Invalid email format."),
  // username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email("Invalid email format."),
});

const magicLinkVerifySchema = z.object({
  token: z.string().uuid("Invalid token format."),
});

// Schema for setting up profile after magic link login
const profileSetupSchema = insertUserSchema.pick({
    firstName: true,
    lastName: true,
}).extend({
    // Require password during profile setup
    password: z.string().min(8, "Password must be at least 8 characters long."), // Add more complexity rules if needed
});

// --- Controller Functions ---

/**
 * Handles response after successful Passport local authentication.
 * The actual authentication is done by passport.authenticate('local') middleware before this.
 */
export const loginUser = (req: Request, res: Response, next: NextFunction): void => {
  // If this function is reached, authentication was successful.
  // req.user should be populated by passport.authenticate middleware via req.login.
  // We simply return the user information.
  if (!req.user) {
    // This shouldn't happen if middleware succeeded, but handle defensively
    return next(new HttpError(500, 'Login successful but user data unavailable in request.'));
  }
  res.status(200).json(req.user);
};

/**
 * Logs the current user out, destroys the session, and clears the cookie.
 * Assumes isAuthenticated middleware runs before this.
 */
export const logoutUser = (req: Request, res: Response, next: NextFunction): void => {
  req.logout((logoutErr) => {
    if (logoutErr) {
      console.error('Error during req.logout:', logoutErr);
      // Decide if error is critical. Usually okay to proceed to session destroy.
      // return next(new HttpError(500, 'Logout failed.'));
    }

    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Error destroying session:', destroyErr);
        // Even if destroy fails, clearing cookie might help.
        // return next(new HttpError(500, 'Failed to destroy session during logout.'));
      }

      // Clear the session cookie
      // Cookie name depends on session middleware config (default 'connect.sid')
      res.clearCookie('connect.sid', {
          // Ensure cookie options match session middleware (path, domain, httpOnly, secure, etc.)
          // path: '/', // Example
          // httpOnly: true, // Example
          // secure: process.env.NODE_ENV === 'production', // Example
          // sameSite: 'lax', // Example
      });
      res.status(200).json({ message: 'Logout successful' }); // Send 200 OK for client handling
    });
  });
};

/**
 * Checks if a user session exists and returns user data if logged in.
 */
export const getAuthStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.isAuthenticated() && req.user) {
       // req.user might only contain the ID depending on deserializeUser.
       // Fetch full, up-to-date user details.
       // Ensure sensitive data (like password hash) is not included.
       const user = await storage.getUserProfileById(req.user.id); // Assumes storage.getUserProfileById excludes sensitive fields

       if (user) {
            res.status(200).json({ isAuthenticated: true, user: user });
       } else {
           // User existed in session but not in DB? Log out.
           console.warn(`User ID ${req.user.id} found in session but not in DB.`);
            req.logout(() => { /* ignore error */ });
            req.session.destroy(() => { /* ignore error */ });
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
 * Initiates the magic link login process for a given email.
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

    // Call the helper function from auth.ts (or similar)
    await createAndSendMagicLink(email); // This function handles user lookup, token creation/storage, email sending

    // Always return OK to prevent email enumeration attacks
    res.status(200).json({ message: 'If an account exists for this email, a magic link has been sent.' });
  } catch (error) {
     // Log the actual error on the server, but don't reveal details to client
     console.error("Error requesting magic link:", error);
     // Still return a generic success message
     res.status(200).json({ message: 'If an account exists for this email, a magic link has been sent.' });
     // Or if you want to signal server error without details:
     // next(new HttpError(500, 'Could not process magic link request.'));
  }
};


/**
 * Verifies a magic link token, logs the user in, and checks profile status.
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

        // Call helper from auth.ts (or similar) to verify and get user
        const user = await verifyMagicTokenAndGetUser(token); // Throws HttpError on failure

        if (!user) {
            // Should be handled by verifyMagicTokenAndGetUser throwing, but belts-and-suspenders
             throw new HttpError(401, 'Invalid or expired magic link token.');
        }

        // Log the user in using req.login provided by Passport
        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Failed to login user after magic link verification:', loginErr);
                return next(new HttpError(500, 'Failed to establish session after verification.'));
            }

            // Check if profile setup is needed
            const needsProfileSetup = !user.profileComplete; // Check the flag from the user object

            // Successfully logged in
            res.status(200).json({
                message: 'Magic link verified successfully.',
                user: user, // Send user data back
                needsProfileSetup: needsProfileSetup, // Signal to client if next step is needed
            });
        });

    } catch(error) {
        next(error); // Pass HttpErrors (400/401 from verify) or other errors
    }
};

/**
 * Sets up user profile (name, password) after magic link login.
 * Assumes isAuthenticated middleware runs before this.
 */
export const setupProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
     try {
        const user = req.user as User; // Authenticated user (via magic link)
        if (!user?.id) {
            throw new HttpError(401, 'Authentication required. Please log in again.');
        }

        // If profile is already complete, prevent re-setup?
        // const currentUser = await storage.getUserProfileById(user.id);
        // if (currentUser?.profileComplete) {
        //     throw new HttpError(400, 'Profile already set up.');
        // }


        const validationResult = profileSetupSchema.safeParse(req.body);
        if (!validationResult.success) {
            throw new HttpError(400, 'Invalid profile data.', validationResult.error.flatten());
        }
        const { firstName, lastName, password } = validationResult.data;

        // Call storage method to update name, hash password, and mark complete
        const updatedUser = await storage.setupUserProfile(user.id, firstName, lastName, password); // Assumes this hashes the password

        if (!updatedUser) {
             throw new HttpError(500, 'Failed to update profile.');
        }

        // Update the session user? req.login might do this automatically if serialize/deserialize handles it.
        // Or manually update `req.user` if necessary. For now, assume client refetches or session is updated.

        res.status(200).json(updatedUser); // Return updated profile (excluding sensitive data)

     } catch(error) {
        next(error);
     }
};