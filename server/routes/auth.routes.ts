// server/routes/auth.routes.ts
import { Router } from "express";
import * as authController from "@server/controllers/auth.controller"; // Updated import
import { setupAuth } from "@server/auth"; // Updated import - Note: May need refactoring in auth.ts if it expects 'app'

const router = Router();

// Password reset routes would go here
// We'll add a placeholder handler to avoid errors
const placeholderHandler = (req, res) => {
  res.status(200).json({ message: "This feature is not yet implemented" });
};

// --- Password Reset Routes ---
// Request a password reset link
router.post("/password-reset-request", placeholderHandler);

// Verify a password reset token
router.get("/verify-reset-token/:token", placeholderHandler);

// Reset password with token
router.post("/reset-password", placeholderHandler);

// --- Core Auth Routes (Login, Logout, Register, Magic Link) ---
// We call setupAuth here to attach its routes (/login, /logout, etc.) to this router
// Ensure setupAuth is modified or designed to work with an Express Router instance
// instead of the main 'app' instance if necessary.
// If setupAuth directly adds routes to the 'app' passed to registerRoutes,
// it might need adjustments, or those routes could be redefined here using controllers.
// For now, assuming setupAuth can be called on the main app instance in registerRoutes.
// setupAuth(router); // <-- Ideal place if setupAuth accepts a Router

export default router;