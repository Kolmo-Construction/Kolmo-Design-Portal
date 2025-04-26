import { performance } from 'perf_hooks';

console.log('Start measuring DB connection time');
const startTime = performance.now();

import { pool } from './server/db';

const endTime = performance.now();
console.log(`DB connection time: ${(endTime - startTime).toFixed(2)}ms`);

// Test a query
const queryStart = performance.now();
pool.query('SELECT NOW()').then(() => {
  const queryEnd = performance.now();
  console.log(`DB query time: ${(queryEnd - queryStart).toFixed(2)}ms`);
  process.exit(0);
}).catch(err => {
  console.error('Query error:', err);
  process.exit(1);
});