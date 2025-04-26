import { performance } from 'perf_hooks';
import express from 'express';
import { createServer } from 'http';
import { registerRoutes } from './server/routes';
import { setupVite } from './server/vite';

console.log('Start measuring full server startup time');
const totalStartTime = performance.now();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup stages
async function measureFullStartup() {
  try {
    // 1. Register routes
    console.log('Starting routes registration...');
    let startTime = performance.now();
    const server = await registerRoutes(app);
    let endTime = performance.now();
    console.log(`Routes registration time: ${(endTime - startTime).toFixed(2)}ms`);

    // 2. Setup Vite middleware (dev only)
    console.log('Starting Vite initialization...');
    startTime = performance.now();
    await setupVite(app, server);
    endTime = performance.now();
    console.log(`Vite initialization time: ${(endTime - startTime).toFixed(2)}ms`);

    // Complete
    const totalEndTime = performance.now();
    console.log(`Total startup time: ${(totalEndTime - totalStartTime).toFixed(2)}ms`);
    
    // Immediately exit after measuring
    process.exit(0);
  } catch (error) {
    console.error('Error during server startup:', error);
    process.exit(1);
  }
}

measureFullStartup();