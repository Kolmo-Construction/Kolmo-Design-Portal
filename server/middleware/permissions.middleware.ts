// server/middleware/permissions.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { storage } from "@server/storage"; // Updated import
import { User } from "@shared/schema"; // Import User type if needed

// Define a structure for user object attached by Passport (adjust based on your setup)
// interface AuthenticatedUser extends User {
//     id: number;
//     role: 'admin' | 'projectManager' | 'client'; // Add other roles if applicable
// }

/**
 * Express middleware helper function to check if the authenticated user
 * has access to a specific project based on their role.
 * Sends appropriate 401/403/404 responses if access is denied.
 * NOTE: This function is intended to be called *within* route handlers
 * or custom middleware, passing the current req, res, and projectId.
 * It sends responses directly, so the calling handler should return after calling it if it returns false.
 *
 * @param req Express Request object (should have req.user populated)
 * @param res Express Response object
 * @param projectId The ID of the project to check access for
 * @returns Promise<boolean> - True if access is granted, False if denied (response already sent)
 */
export async function checkProjectAccess(req: Request, res: Response, projectId: number): Promise<boolean> {
    // Ensure user is authenticated before checking access
    if (!req.isAuthenticated() || !req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return false;
    }
    // Cast req.user safely, assuming Passport populates it correctly
    const user = req.user as User;

    // Admins can access any project
    if (user.role === "admin") {
        return true;
    }

    // Check if project exists before checking specific roles
    // This prevents leaking information about project existence to unauthorized users
    // You might choose to do this check earlier or handle 404 within storage calls
    // const projectExists = await storage.getProject(projectId); // Example check
    // if (!projectExists) {
    //    res.status(404).json({ message: "Project not found" });
    //    return false;
    // }


    // Project managers can only access projects they're assigned to
    if (user.role === "projectManager") {
        const hasAccess = await storage.projectManagerHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
            res.status(403).json({ message: "Forbidden: You do not have access to this project." });
            return false;
        }
    }
    // Clients can only access projects they're assigned to
    else if (user.role === "client") {
        const hasAccess = await storage.clientHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
            res.status(403).json({ message: "Forbidden: You do not have access to this project." });
            return false;
        }
    }
    // Handle unexpected roles if necessary
    else {
        res.status(403).json({ message: "Forbidden: Insufficient role for project access." });
        return false;
    }

    // If all checks pass for the user's role
    return true;
}

/**
 * Example of how checkProjectAccess could be used as connect-style middleware
 * (Requires modification of checkProjectAccess or a wrapper)
 *
 * This is more complex due to async nature and needing projectId from params.
 * Often easier to call checkProjectAccess() helper within the route handler itself.
 *
 * export function projectAccessMiddleware(req: Request, res: Response, next: NextFunction) {
 * const projectId = parseInt(req.params.projectId); // Assumes projectId is in params
 * if (isNaN(projectId)) {
 * return res.status(400).json({ message: "Invalid project ID" });
 * }
 * checkProjectAccess(req, res, projectId).then(hasAccess => {
 * if (hasAccess) {
 * next();
 * }
 * // If false, checkProjectAccess already sent the response
 * }).catch(error => {
 * console.error("Error in projectAccessMiddleware:", error);
 * res.status(500).json({ message: "Internal server error during permission check." });
 * });
 * }
 */