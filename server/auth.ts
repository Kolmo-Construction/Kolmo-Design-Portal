import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "@server/storage/index";
import { User as SelectUser } from "@shared/schema";
import { sendMagicLinkEmail, isEmailServiceConfigured, sendEmail } from "@server/email";
import { UserProfile } from "@server/storage/types"; // Import UserProfile
import { HttpError } from "./errors";
import { generateMagicLinkUrl, getBaseUrl } from "@server/domain.config";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Middleware to check if user is authenticated and has admin role
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// Generate a unique token for magic links using proper UUID v4
function generateMagicLinkToken(): string {
  // Generate a proper UUID v4 format
  const bytes = randomBytes(16);
  
  // Set version (4) and variant bits according to RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  
  // Format as UUID string
  const hex = bytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

// Calculate expiry time (default: 5 months from now)
function getMagicLinkExpiry(months = 5): Date {
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);
  return expiryDate;
}

/**
 * Creates a magic link token for a user and sends an email with the link
 * @param email Email address to send the magic link to
 * @returns Boolean indicating if the email was sent successfully
 */
export async function createAndSendMagicLink(email: string): Promise<boolean> {
  try {
    // Check if the user exists
    const user = await storage.users.getUserByEmail(email);
    if (!user) {
      // Don't reveal that the user doesn't exist (for security)
      console.log(`No user found with email: ${email}`);
      return false;
    }

    // Generate a new magic link token and expiry
    const token = generateMagicLinkToken();
    const expiry = getMagicLinkExpiry();

    // Update the user with the new token
    await storage.users.updateUserMagicLinkToken(user.id, token, expiry);

    // Check if email service is configured
    if (!isEmailServiceConfigured()) {
      console.warn('Email service not configured. Magic link will not be sent.');
      console.log(`[DEV] Magic link token for ${email}: ${token}`);
      return false;
    }

    // Add detailed logging
    console.log(`[createAndSendMagicLink] Email service configured: ${isEmailServiceConfigured()}`);
    console.log(`[createAndSendMagicLink] Base URL: ${getBaseUrl()}`);
    console.log(`[createAndSendMagicLink] Full magic link: ${getBaseUrl()}/api/auth/magic-link/${token}`);

    // Send the magic link email
    console.log(`[createAndSendMagicLink] Attempting to send magic link email to: ${user.email}`);
    console.log(`[createAndSendMagicLink] Token: ${token}`);
    console.log(`[createAndSendMagicLink] User is activated: ${user.isActivated}`);
    
    const emailSent = await sendMagicLinkEmail({
      email: user.email,
      firstName: user.firstName || '',
      token,
      isNewUser: !user.isActivated
    });
    
    console.log(`[createAndSendMagicLink] Email sending result: ${emailSent}`);
    return emailSent;
  } catch (error) {
    console.error('Error creating and sending magic link:', error);
    return false;
  }
}

/**
 * Verifies a magic link token and returns the associated user if valid
 * @param token The magic link token to verify
 * @returns The user associated with the token or null if invalid
 */
export async function verifyMagicTokenAndGetUser(token: string): Promise<SelectUser | null> {
  try {
    // Atomic operation: find user and immediately clear token to prevent race conditions
    const user = await storage.users.getUserByMagicLinkToken(token);
    if (!user) {
      console.log(`No user found with magic link token: ${token}`);
      return null;
    }

    // Check if token is expired
    if (user.magicLinkExpiry && new Date(user.magicLinkExpiry) < new Date()) {
      console.log(`Magic link token expired for user: ${user.id}`);
      return null;
    }

    // Atomically clear the token and return user - prevents multiple uses
    const updatedUser = await storage.users.updateUserMagicLinkToken(user.id, null, null);
    
    // Verify the token was actually cleared (prevents race condition)
    const tokenCheck = await storage.users.getUserByMagicLinkToken(token);
    if (tokenCheck) {
      console.log(`Race condition detected: token still exists after clearing for user: ${user.id}`);
      return null;
    }

    return updatedUser;
  } catch (error) {
    console.error('Error verifying magic link token:', error);
    return null;
  }
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    console.warn("WARNING: SESSION_SECRET not set, using a default value for development");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "buildportal-dev-secret",
    resave: true, // Force session to be saved back to session store
    saveUninitialized: false,
    store: storage.sessionStore, // sessionStore is a property, not a user method
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    },
    rolling: true // Reset expiration on activity
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'username' }, async (username, password, done) => {
      try {
        console.log('[LocalStrategy] Login attempt for username:', username);
        
        // Updated to use storage.users
        const user = await storage.users.getUserByUsername(username);
        console.log('[LocalStrategy] User lookup result:', user ? `Found user ID ${user.id}` : 'No user found');
        
        if (!user) {
          console.log('[LocalStrategy] Authentication failed: User not found');
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        console.log('[LocalStrategy] Password comparison result:', passwordMatch);
        
        if (!passwordMatch) {
          console.log('[LocalStrategy] Authentication failed: Invalid password');
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        console.log('[LocalStrategy] Authentication successful for user:', user.id);
        return done(null, user);
      } catch (err) {
        console.error('[LocalStrategy] Error during authentication:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log('[Passport] Serializing user to session:', user.id);
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('[Passport] Deserializing user from session ID:', id);
      // Updated to use storage.users with getUserById - convert number to string
      const user = await storage.users.getUserById(String(id));
      console.log('[Passport] Deserialization result:', user ? `Found user ${user.id}` : 'User not found');
      done(null, user);
    } catch (err) {
      console.error('[Passport] Error during deserialization:', err);
      done(err, null);
    }
  });

  // Request magic link endpoint
  app.post("/api/auth/magic-link", async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Call the createAndSendMagicLink function
      const success = await createAndSendMagicLink(email);

      if (success) {
        return res.status(200).json({ 
          message: "If an account exists for this email, a magic link has been sent." 
        });
      } else {
        return res.status(200).json({ 
          message: "If an account exists for this email, a magic link has been sent." 
        });
      }
    } catch (error) {
      console.error('Error in magic link request:', error);
      return res.status(200).json({ 
        message: "If an account exists for this email, a magic link has been sent." 
      });
    }
  });

  // Magic link authentication
  app.get("/api/auth/magic-link/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      console.log(`[Magic Link] Processing token: ${token}`);

      if (!token) {
        console.log(`[Magic Link] No token provided`);
        return res.status(400).json({ message: "Invalid token" });
      }

      // Check if user is already authenticated with this session
      if (req.isAuthenticated() && req.user) {
        console.log(`[Magic Link] User already authenticated in session: ${req.user.id}`);
        
        // For authenticated users, return their session data directly
        // This handles the case where the token was already consumed but the user is still logged in
        const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = req.user;
        
        // Handle redirect logic for authenticated users
        if (!req.user.isActivated) {
          console.log(`[Magic Link] Authenticated user needs profile setup`);
          return res.status(200).json({
            redirect: "/setup-profile",
            user: {
              id: req.user.id,
              email: req.user.email,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              role: req.user.role,
              isActivated: req.user.isActivated
            }
          });
        }
        
        console.log(`[Magic Link] Returning authenticated user data`);
        return res.status(200).json({ user: userWithoutSensitiveData });
      }

      // Updated to use storage.users
      console.log(`[Magic Link] Looking up user for token: ${token}`);
      const user = await storage.users.getUserByMagicLinkToken(token);

      if (!user) {
        console.log(`[Magic Link] No user found for token: ${token}`);
        return res.status(404).json({ message: "Invalid or expired link" });
      }

      console.log(`[Magic Link] Found user: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
      console.log(`[Magic Link] Token expiry: ${user.magicLinkExpiry}`);
      console.log(`[Magic Link] Current time: ${new Date()}`);

      // Check if the token has expired
      if (user.magicLinkExpiry && new Date(user.magicLinkExpiry) < new Date()) {
        console.log(`[Magic Link] Token expired for user: ${user.id}`);
        return res.status(401).json({ message: "Magic link has expired" });
      }

      // Log the user in
      req.login(user, async (err) => {
        if (err) return next(err);

        // Mark the token as used by removing it - Updated to use storage.users
        await storage.users.updateUserMagicLinkToken(user.id, null, null);
        console.log(`[Magic Link] Token consumed for user: ${user.id}`);

        // If the user hasn't set up their account yet, redirect to profile setup
        if (!user.isActivated) {
          return res.status(200).json({
            redirect: "/setup-profile",
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              isActivated: user.isActivated
            }
          });
        }

        // Regular login for users who have already set up their account
        const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = user;
        return res.status(200).json({ 
          message: "Magic link verified successfully",
          user: userWithoutSensitiveData 
        });
      });
    } catch (err) {
      next(err);
    }
  });

  // Admin endpoint to create a magic link for a user
  app.post("/api/admin/create-magic-link", async (req, res, next) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { email, firstName, lastName, role = "client", projectIds = [], phoneNumber } = req.body;

      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Check if user already exists - Updated to use storage.users
      let user = await storage.users.getUserByEmail(email);
      const token = generateMagicLinkToken();
      const expiry = getMagicLinkExpiry();

      if (user) {
        // Update existing user with new magic link token - Updated to use storage.users
        user = await storage.users.updateUserMagicLinkToken(user.id, token, expiry);
      } else {
        // Create a temporary password - user will set real password during activation
        const temporaryPassword = await hashPassword(randomBytes(16).toString("hex"));

        // Generate a username based on email (this can be changed by user during activation)
        const username = email.split('@')[0] + '_' + randomBytes(4).toString('hex');

        // Create new user with magic link token - Updated to use storage.users
        user = await storage.users.createUser({
          email,
          firstName,
          lastName,
          username,
          password: temporaryPassword,
          role,
          magicLinkToken: token,
          magicLinkExpiry: expiry,
          isActivated: false,
          phoneNumber: phoneNumber || null
        });
      }

      // If this is a client user and there are project IDs, associate them with projects
      if (role === "client" && projectIds.length > 0 && Array.isArray(projectIds)) {
        try {
          // Create client-project associations - Updated to use storage.projects
          for (const projectId of projectIds) {
            await storage.projects.assignClientToProject(user.id, projectId);
          }
          console.log(`Assigned client ${user.id} to ${projectIds.length} projects`);
        } catch (error) {
          console.error("Error assigning client to projects:", error);
          // Continue with the response even if project assignment fails
        }
      }

      // Create the magic link URL using centralized domain configuration
      const magicLink = generateMagicLinkUrl(token);

      // Send the magic link email
      const isNewUser = !user.isActivated;
      let emailSent = false;

      console.log(`[Admin create magic link] Attempting to send email to: ${email}`);
      console.log(`[Admin create magic link] Token: ${token}`);
      console.log(`[Admin create magic link] User is activated: ${user.isActivated}`);
      
      if (isEmailServiceConfigured()) {
        emailSent = await sendMagicLinkEmail({
          email,
          firstName,
          token,  // Pass the token, not the full magicLink
          isNewUser
        });
        console.log(`[Admin create magic link] Email sending result: ${emailSent}`);
      } else {
        console.warn('Email service not configured. Magic link will not be sent.');
        console.log(`[DEV] Magic link: ${magicLink}`);
      }

      // Always return the magic link in development for testing purposes
      const result: any = {
        message: "Magic link created successfully",
        user: { id: user.id, email: user.email }
      };

      // In development, also return the magic link directly
      if (process.env.NODE_ENV !== 'production') {
        result.magicLink = magicLink;
      }

      if (!emailSent) {
        result.warning = "Magic link email could not be sent. Check server logs for details.";
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Setup profile and password for a user who came in via magic link
  app.post("/api/auth/setup-profile", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { username, password, firstName, lastName, phone } = req.body;

      if (!username || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "Username, password, first name, and last name are required" });
      }

      // Check if username is already taken by another user - Updated to use storage.users
      const existingUser = await storage.users.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Update the user's profile - Updated to use storage.users
      const hashedPassword = await hashPassword(password);
      const updatedUser = await storage.users.updateUser(req.user.id, {
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        isActivated: true
      });

      // Remove sensitive information from response
      const { password: _, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = updatedUser;

      res.status(200).json({
        message: "Profile setup complete",
        user: userWithoutSensitiveData
      });
    } catch (err) {
      next(err);
    }
  });

  // Standard login - will be used primarily by admins
  app.post("/api/login", (req, res, next) => {
    console.log('[Login] Starting login process for:', req.body.username);
    console.log('[Login] Session ID before auth:', req.sessionID);
    console.log('[Login] Session data before auth:', JSON.stringify(req.session, null, 2));
    
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      console.log('[Login] Passport authenticate callback - err:', err, 'user:', user ? `ID ${user.id}` : 'false', 'info:', info);
      
      if (err) {
        console.error('[Login] Authentication error:', err);
        return next(err);
      }

      if (!user) {
        console.log('[Login] Authentication failed - no user returned');
        return res.status(401).json({ message: "Invalid username or password" });
      }

      console.log('[Login] Authentication successful, calling req.login for user:', user.id);
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('[Login] req.login error:', loginErr);
          return next(loginErr);
        }

        console.log('[Login] req.login successful');
        console.log('[Login] Session ID after login:', req.sessionID);
        console.log('[Login] Session data after login:', JSON.stringify(req.session, null, 2));
        console.log('[Login] req.isAuthenticated():', req.isAuthenticated());
        console.log('[Login] req.user:', req.user ? `ID ${req.user.id}` : 'undefined');

        // Force session save to ensure persistence
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[Login] Session save error:', saveErr);
          } else {
            console.log('[Login] Session saved successfully');
          }

          // Remove password and magic link data from response
          const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = user as SelectUser;
          console.log('[Login] Sending response for user:', userWithoutSensitiveData.id);
          res.status(200).json(userWithoutSensitiveData);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(200).json({ message: "Not logged in" });
    }

    req.logout((err) => {
      if (err) return next(err);

      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('[/api/user] Request received');
    console.log('[/api/user] Session ID:', req.sessionID);
    console.log('[/api/user] Session data:', JSON.stringify(req.session, null, 2));
    console.log('[/api/user] req.isAuthenticated():', req.isAuthenticated());
    console.log('[/api/user] req.user:', req.user ? `ID ${req.user.id}` : 'undefined');
    
    if (!req.isAuthenticated()) {
      console.log('[/api/user] User not authenticated, sending 401');
      return res.sendStatus(401);
    }

    // Remove sensitive data from response
    const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = req.user as SelectUser;
    console.log('[/api/user] Sending user data for ID:', userWithoutSensitiveData.id);
    res.json(userWithoutSensitiveData);
  });

  // API endpoint to check if user is authenticated and has admin role
  app.get("/api/admin-check", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    res.status(200).json({ isAdmin: true });
  });

  // Get all users - admin only
  app.get("/api/admin/users", async (req, res) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Updated to use storage.users
      const users = await storage.users.getAllUsers();

      // Remove sensitive information from response
      const sanitizedUsers = users.map(user => {
        const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = user;
        return userWithoutSensitiveData;
      });

      res.status(200).json(sanitizedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Search/Get clients - admin only
  app.get("/api/admin/clients/search", async (req, res) => {
    try {
      console.log("[/api/admin/clients/search] Request received");
      console.log("[/api/admin/clients/search] User:", req.user?.email, "Role:", req.user?.role);
      console.log("[/api/admin/clients/search] Authenticated:", req.isAuthenticated());

      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        console.log("[/api/admin/clients/search] Access denied - not admin");
        return res.status(403).json({ message: "Admin access required" });
      }

      const searchQuery = req.query.q as string;
      console.log("[/api/admin/clients/search] Search query:", searchQuery);

      // Get all users
      const users = await storage.users.getAllUsers();
      console.log("[/api/admin/clients/search] Total users:", users.length);

      // Filter for clients only
      let clients = users.filter(user => user.role === "client");
      console.log("[/api/admin/clients/search] Total clients found:", clients.length);

      // If search query provided, filter by name or email
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        clients = clients.filter(client =>
          client.firstName?.toLowerCase().includes(query) ||
          client.lastName?.toLowerCase().includes(query) ||
          client.email.toLowerCase().includes(query) ||
          `${client.firstName} ${client.lastName}`.toLowerCase().includes(query)
        );
        console.log("[/api/admin/clients/search] Clients after search filter:", clients.length);
      }

      // Remove sensitive information from response
      const sanitizedClients = clients.map(client => {
        const { password, magicLinkToken, magicLinkExpiry, ...clientWithoutSensitiveData } = client;
        return clientWithoutSensitiveData;
      });

      console.log("[/api/admin/clients/search] Returning clients:", sanitizedClients.length);
      res.status(200).json(sanitizedClients);
    } catch (err) {
      console.error("[/api/admin/clients/search] Error:", err);
      res.status(500).json({ message: "Failed to search clients" });
    }
  });

  // Update a user - admin only
  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { email, firstName, lastName, role, projectIds, phoneNumber } = req.body;

      // Check if user exists
      const userToUpdate = await storage.users.getUserById(String(userId));
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent admin from changing their own role
      if (req.user.id === userId && role && role !== req.user.role) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }

      // Update user basic information
      const updatedUser = await storage.users.updateUser(userId, {
        email: email || userToUpdate.email,
        firstName: firstName || userToUpdate.firstName,
        lastName: lastName || userToUpdate.lastName,
        role: role || userToUpdate.role,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : userToUpdate.phoneNumber,
      });

      // Handle project assignments for clients
      if (role === "client" && projectIds !== undefined && Array.isArray(projectIds)) {
        try {
          const { db } = await import("@server/db");
          const { clientProjects } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");

          // Remove all existing project assignments
          await db.delete(clientProjects).where(eq(clientProjects.clientId, userId));

          // Add new project assignments
          for (const projectId of projectIds) {
            await storage.projects.assignClientToProject(userId, projectId);
          }
          console.log(`Updated client ${userId} project assignments to ${projectIds.length} projects`);
        } catch (error) {
          console.error("Error updating project assignments:", error);
          // Continue with response even if project assignment update fails
        }
      }

      // Remove sensitive information from response
      const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = updatedUser;

      res.status(200).json({
        message: "User updated successfully",
        user: userWithoutSensitiveData
      });
    } catch (err) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete a user - admin only
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Prevent admin from deleting themselves
      if (req.user.id === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Check if user exists
      const userToDelete = await storage.users.getUserById(String(userId));
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }

      const { db } = await import("@server/db");
      const { users, projects, clientProjects, documents, messages, dailyLogs, progressUpdates, punchListItems, tasks } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");

      // Start a transaction to handle all deletions safely
      await db.transaction(async (tx) => {
        // Check for critical dependencies that would prevent deletion
        const managedProjects = await tx.select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(eq(projects.projectManagerId, userId));

        if (managedProjects.length > 0) {
          const projectNames = managedProjects.map(p => p.name).join(', ');
          throw new Error(`Cannot delete user: they are the project manager for: ${projectNames}. Please reassign these projects first.`);
        }

        // Check for client-project assignments and provide clear feedback
        const clientProjectCount = await tx.select({ count: sql`count(*)` })
          .from(clientProjects)
          .where(eq(clientProjects.clientId, userId));

        if (clientProjectCount[0] && Number(clientProjectCount[0].count) > 0) {
          // Get the specific projects this user is assigned to
          const assignedProjects = await tx.select({ 
            projectId: clientProjects.projectId,
            projectName: projects.name 
          })
          .from(clientProjects)
          .innerJoin(projects, eq(clientProjects.projectId, projects.id))
          .where(eq(clientProjects.clientId, userId));
          
          const projectNames = assignedProjects.map(p => p.projectName).join(', ');
          throw new Error(`Cannot delete user: they are assigned as a client to ${clientProjectCount[0].count} project(s): ${projectNames}. Please remove these project assignments first or reassign the projects to another client.`);
        }

        // If no critical dependencies, proceed with safe cleanup
        console.log(`Deleting user ${userId} and cleaning up references...`);

        // Remove client-project relationships (if any remain)
        await tx.delete(clientProjects).where(eq(clientProjects.clientId, userId));

        // Update references to set them to NULL where possible (only for nullable fields)
        // Use SQL null for proper type handling
        
        // uploadedById in documents is nullable
        await tx.update(documents)
          .set({ uploadedById: sql`NULL` })
          .where(eq(documents.uploadedById, userId));

        // assigneeId in tasks is nullable  
        await tx.update(tasks)
          .set({ assigneeId: sql`NULL` })
          .where(eq(tasks.assigneeId, userId));

        // assigneeId in punchListItems is nullable (has onDelete: 'set null')
        await tx.update(punchListItems)
          .set({ assigneeId: sql`NULL` })
          .where(eq(punchListItems.assigneeId, userId));

        // recipientId in messages is nullable
        await tx.update(messages)
          .set({ recipientId: sql`NULL` })
          .where(eq(messages.recipientId, userId));

        // Delete records where user is required (not nullable)
        // createdById is NOT NULL in dailyLogs, progressUpdates, messages.senderId
        await tx.delete(dailyLogs).where(eq(dailyLogs.createdById, userId));
        await tx.delete(progressUpdates).where(eq(progressUpdates.createdById, userId));
        await tx.delete(messages).where(eq(messages.senderId, userId));

        // Finally, delete the user
        const result = await tx.delete(users).where(eq(users.id, userId));
        
        if (result.rowCount === 0) {
          throw new Error("User not found or could not be deleted");
        }
      });

      res.status(204).send(); // No content response for successful deletion
    } catch (err) {
      console.error("Error deleting user:", err);
      
      // Handle known error types
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      // Return specific error messages for constraint violations
      if (errorMessage.includes('Cannot delete user:')) {
        return res.status(400).json({ message: errorMessage });
      }
      
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin reset user password endpoint - admin only
  app.post("/api/admin/users/:id/reset-password", async (req, res) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Check if user exists
      const userToUpdate = await storage.users.getUserById(String(userId));
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);

      // Update the user's password
      await storage.users.updateUser(userId, {
        password: hashedPassword
      });

      res.status(200).json({ 
        message: `Password has been reset successfully for ${userToUpdate.email}` 
      });
    } catch (err) {
      console.error("Error resetting user password:", err);
      res.status(500).json({ message: "Failed to reset user password" });
    }
  });

  // Email configuration status endpoint - admin only
  app.get("/api/admin/email-config", async (req, res) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const configured = isEmailServiceConfigured();
      res.status(200).json({ configured });
    } catch (err) {
      console.error("Error checking email configuration:", err);
      res.status(500).json({ message: "Failed to check email configuration" });
    }
  });

  // Test email sending endpoint - admin only
  app.get("/api/test-email", async (req, res) => {
    try {
      // Check if admin
      if (!req.isAuthenticated() || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const configured = isEmailServiceConfigured();
      if (!configured) {
        return res.status(400).json({ 
          configured: false,
          message: "Email service not configured. Check REPLIT_CONNECTORS_HOSTNAME environment variable." 
        });
      }

      // Try to send a test email
      const testEmail = req.user.email || "test@example.com";
      const success = await sendEmail({
        to: testEmail,
        subject: "Test Email from Construction Portal",
        text: "This is a test email to verify email sending is working.",
        html: "<h2>Test Email</h2><p>This is a test email to verify email sending is working.</p>"
      });

      return res.status(200).json({
        configured: true,
        emailSent: success,
        message: success ? "Test email sent successfully" : "Failed to send test email"
      });
    } catch (error: any) {
      console.error("Test email error:", error);
      return res.status(500).json({ 
        configured: false,
        error: error.message,
        details: "Check Gmail connector setup in Replit" 
      });
    }
  });

  // API endpoint to create an admin user (only in development mode)
  app.post("/api/create-admin", async (req, res) => {
    try {
      // Extra security: only allow this in development mode
      if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({ message: "This endpoint is only available in development mode" });
      }

      const { username, password, email, firstName, lastName } = req.body;

      if (!username || !password || !email || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if user already exists - Updated to use storage.users
      const existingUser = await storage.users.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Updated to use storage.users
      const existingEmail = await storage.users.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Create new admin user - Updated to use storage.users
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.users.createUser({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: "admin",
        isActivated: true, // Set as already activated
      });

      // Remove password from response
      const { password: _, ...userResponse } = newUser;

      res.status(201).json({
        message: "Admin user created successfully",
        user: userResponse
      });
    } catch (error) {
      console.error("Error creating admin user:", error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });
}
