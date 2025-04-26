import { performance } from 'perf_hooks';

// Start timing
const startTime = performance.now();

// Import all major dependencies used in the project
import express from 'express';
import { createServer } from 'http';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import session from 'express-session';
import passport from 'passport';
import { z } from 'zod';
import multer from 'multer';
import * as schema from './shared/schema';
import { createLogger } from 'vite';

// End timing
const endTime = performance.now();
console.log(`Time to import dependencies: ${(endTime - startTime).toFixed(2)}ms`);
process.exit(0);