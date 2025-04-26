import { performance } from 'perf_hooks';
import express from 'express';
import { setupVite } from './server/vite';
import { createServer } from 'http';

console.log('Start measuring Vite server initialization time');
const app = express();
const server = createServer(app);

const startTime = performance.now();

// Only setup Vite
async function setupViteOnly() {
  try {
    console.log('Starting Vite initialization...');
    await setupVite(app, server);
    const endTime = performance.now();
    console.log(`Vite initialization time: ${(endTime - startTime).toFixed(2)}ms`);
    // Immediately exit after measuring
    process.exit(0);
  } catch (error) {
    console.error('Error setting up Vite:', error);
    process.exit(1);
  }
}

setupViteOnly();