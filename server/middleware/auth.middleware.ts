// server/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from "express";
// No need to import User type if we rely on Passport augmenting the Request type

/**
 * Express middleware to check if a user is authenticated via Passport.
 * Sends a 401 Unauthorized response if not authenticated.
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: "Unauthorized" });
}

/**
 * Express middleware to check if the authenticated user has the 'admin' role.
 * Assumes previous authentication check (e.g., isAuthenticated middleware).
 * Sends a 403 Forbidden response if the user is not an admin.
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
    // Relies on req.user being populated by Passport and having a 'role' property
    // Ensure isAuthenticated runs *before* this middleware
    if (req.user && (req.user as any).role === "admin") {
        return next();
    }
    res.status(403).json({ message: "Forbidden: Admin access required" });
}