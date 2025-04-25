import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendMagicLinkEmail, isEmailServiceConfigured } from "./email";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generate a unique token for magic links
function generateMagicLinkToken(): string {
  return randomBytes(32).toString("hex");
}

// Calculate expiry time (default: 24 hours from now)
function getMagicLinkExpiry(hours = 24): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + hours);
  return expiryDate;
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    console.warn("WARNING: SESSION_SECRET not set, using a default value for development");
  }
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "buildportal-dev-secret",
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Magic link authentication
  app.get("/api/auth/magic-link/:token", async (req, res, next) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: "Invalid token" });
      }
      
      const user = await storage.getUserByMagicLinkToken(token);
      
      if (!user) {
        return res.status(404).json({ message: "Invalid or expired link" });
      }
      
      // Check if the token has expired
      if (user.magicLinkExpiry && new Date(user.magicLinkExpiry) < new Date()) {
        return res.status(401).json({ message: "Magic link has expired" });
      }
      
      // Log the user in
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Mark the token as used by removing it
        await storage.updateUserMagicLinkToken(user.id, null, null);
        
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
        return res.status(200).json({ user: userWithoutSensitiveData });
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
      
      const { email, firstName, lastName, role = "client", projectIds = [] } = req.body;
      
      if (!email || !firstName || !lastName) {
        return res.status(400).json({ message: "Email, first name, and last name are required" });
      }

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      const token = generateMagicLinkToken();
      const expiry = getMagicLinkExpiry();
      
      if (user) {
        // Update existing user with new magic link token
        user = await storage.updateUserMagicLinkToken(user.id, token, expiry);
      } else {
        // Create a temporary password - user will set real password during activation
        const temporaryPassword = await hashPassword(randomBytes(16).toString("hex"));
        
        // Generate a username based on email (this can be changed by user during activation)
        const username = email.split('@')[0] + '_' + randomBytes(4).toString('hex');
        
        // Create new user with magic link token
        user = await storage.createUser({
          email,
          firstName,
          lastName,
          username,
          password: temporaryPassword,
          role,
          magicLinkToken: token,
          magicLinkExpiry: expiry,
          isActivated: false
        });
      }
      
      // If this is a client user and there are project IDs, associate them with projects
      if (role === "client" && projectIds.length > 0 && Array.isArray(projectIds)) {
        try {
          // Create client-project associations
          for (const projectId of projectIds) {
            await storage.assignClientToProject(user.id, projectId);
          }
          console.log(`Assigned client ${user.id} to ${projectIds.length} projects`);
        } catch (error) {
          console.error("Error assigning client to projects:", error);
          // Continue with the response even if project assignment fails
        }
      }
      
      // Create the magic link URL
      const host = process.env.NODE_ENV === 'production' 
        ? req.get('host') 
        : 'localhost:5000';
        
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const magicLink = `${protocol}://${host}/auth/magic-link/${token}`;
      
      // Send the magic link email
      const isNewUser = !user.isActivated;
      let emailSent = false;
      
      if (isEmailServiceConfigured()) {
        emailSent = await sendMagicLinkEmail(
          email,
          firstName,
          magicLink,
          isNewUser
        );
      } else {
        console.warn('Email service not configured. Magic link will not be sent.');
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
      
      // Check if username is already taken by another user
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Update the user's profile
      const hashedPassword = await hashPassword(password);
      const updatedUser = await storage.updateUser(req.user.id, {
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
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Remove password and magic link data from response
        const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = user as SelectUser;
        res.status(200).json(userWithoutSensitiveData);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Remove sensitive data from response
    const { password, magicLinkToken, magicLinkExpiry, ...userWithoutSensitiveData } = req.user as SelectUser;
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
      
      const users = await storage.getAllUsers();
      
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
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create new admin user
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
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
