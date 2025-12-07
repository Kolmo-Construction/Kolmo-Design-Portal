// Direct schema push using SQL
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './shared/schema';
import { sql } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;

async function main() {
  console.log('Starting direct schema push');
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set, ensure the database is provisioned");
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  
  try {
    console.log('Pushing schema to database...');
    
    // First, enable the vector extension if not exists
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Vector extension enabled');
    
    // Generate the SQL for schema. We're using the Drizzle feature to push without migrations
    await db.dialect.migrate(async (sql) => {
      return db.execute(sql);
    }, schema);
    
    console.log('Schema push completed successfully');
  } catch (error) {
    console.error('Error pushing schema:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
