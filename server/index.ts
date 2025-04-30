// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http"; // Import createServer
import { registerRoutes } from "@server/routes";
import { setupVite, serveStatic, log } from "@server/vite";

const app = express();

// --- Basic Middleware ---
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
  const port = 5000;
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
