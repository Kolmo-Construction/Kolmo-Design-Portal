// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http"; // Import createServer
import cors from "cors";
import { registerRoutes } from "@server/routes";
import { setupVite, serveStatic, log } from "@server/vite";
import chatRoutes from "./routes/chat";

const app = express();

// --- CORS Configuration ---
// Allow requests from Replit and other mobile app origins
const allowedOrigins = [
  'https://bcf5d4f5-2d23-4f8c-85e1-bc408d039841-00-22w626y67ebqj.worf.replit.dev',
  /\.replit\.dev$/,  // Allow all Replit domains
  /\.replit\.app$/,  // Allow Replit app domains
  'http://localhost:3000',
  'http://localhost:5000',
  'https://api.kolmo.design',
  'https://kolmo.design',
  'https://www.kolmo.design',            // Main website with www
  'https://kolmo-design.up.railway.app', // Railway deployment URL
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list or matches regex patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else {
        return allowed.test(origin);
      }
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies/session
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// --- Basic Middleware ---
// For Stripe webhooks, we need raw body parsing
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
// For all other routes, use JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Custom Request Logger ---
// (Keep this near the top if you want it to log most requests)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Capture JSON responses for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Log only API requests or adjust as needed
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Avoid overly long log lines
        const jsonString = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonString.length > 100 ? jsonString.substring(0, 97) + '...' : jsonString}`;
      }
      // Limit overall log line length too
      if (logLine.length > 200) {
          logLine = logLine.slice(0, 197) + "...";
      }
      log(logLine); // Use the imported log function
    }
  });

  next();
});


// --- Main Async Setup Function ---
(async () => {
  // Create the HTTP server instance *before* potentially passing it to setupVite
  const httpServer = createServer(app);

  // --- Register Core Application Routes (API, Auth, etc.) ---
  // This function should now primarily set up routes and middleware
  // applied *before* the Vite/Static or final error handlers.
  // It no longer needs to return the server instance.
  await registerRoutes(app);

  // --- Register Chat Routes ---
  app.use('/api/chat', chatRoutes);

  // --- Setup Vite Dev Server OR Static File Serving ---
  // IMPORTANT: This now runs *before* the final application error handler.
  if (process.env.NODE_ENV === "development") {
    // Pass the httpServer instance for HMR
    await setupVite(app, httpServer);
    log("Vite Dev Server configured.", "server-setup");
  } else {
    serveStatic(app); // Ensure this serves index.html as a fallback for non-API routes
    log("Static file serving configured.", "server-setup");
  }

  // --- Final Application JSON Error Handler ---
  // This catches errors propagated from your API routes/middleware.
  // It should be the LAST middleware added via `app.use`.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Log the error for debugging
    console.error("Error caught by final handler:", err);

    const statusCode = err.status || err.statusCode || 500;
    // Safely get the message
    const message = err.message || "Internal Server Error";
    // Include details if available (like from Zod validation)
    const details = err.details;

    // Prevent sending response if headers already sent
    if (res.headersSent) {
      console.error("Headers already sent, cannot send JSON error response.");
      // In Express 4, the request might just hang or terminate.
      // In Express 5, you might call next(err) to let Express handle it.
      return;
    }

    // Send JSON response
    res.status(statusCode).json({ message, ...(details && { details }) });
    // Do NOT re-throw the error here synchronously.
  });

  // --- Start the Server ---
  const port = process.env.PORT || 5000;
  httpServer.listen({ // Use the httpServer instance created earlier
    port,
    host: "0.0.0.0",
    // reusePort: true, // Consider removing if it causes issues
  }, () => {
    log(`Server listening on port ${port}`, "server-setup");
  });

})().catch(error => {
  // Catch potential errors during async setup
  console.error("Failed to start server:", error);
  process.exit(1);
});

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});
