// Apply generated migrations
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './shared/schema';
import fs from 'fs';
import path from 'path';

neonConfig.webSocketConstructor = ws;

async function main() {
  console.log('Starting database migration');
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set, ensure the database is provisioned");
  }
  
  // Create the migrations folder if it doesn't exist to avoid migrator errors
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const journalPath = path.join(migrationsDir, 'meta');
  
  if (!fs.existsSync(journalPath)) {
    fs.mkdirSync(journalPath, { recursive: true });
  }
  
  const journalFile = path.join(journalPath, '_journal.json');
  if (!fs.existsSync(journalFile)) {
    fs.writeFileSync(journalFile, JSON.stringify({ entries: [] }));
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  
  try {
    console.log('Applying migrations...');
    
    // Apply migrations
    await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('Migrations applied successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();