import { performance } from 'perf_hooks';
import express from 'express';
import { registerRoutes } from './server/routes';

console.log('Start measuring routes registration time');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const startTime = performance.now();

// Only register routes
async function registerRoutesOnly() {
  try {
    console.log('Starting routes registration...');
    await registerRoutes(app);
    const endTime = performance.now();
    console.log(`Routes registration time: ${(endTime - startTime).toFixed(2)}ms`);
    // Immediately exit after measuring
    process.exit(0);
  } catch (error) {
    console.error('Error registering routes:', error);
    process.exit(1);
  }
}

registerRoutesOnly();