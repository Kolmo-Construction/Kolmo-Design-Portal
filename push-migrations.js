// push-migrations.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Need to set WebSocket constructor for Neon serverless driver
neonConfig.webSocketConstructor = ws;

// Convert __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the latest migration file
const migrationsPath = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsPath).filter(file => file.endsWith('.sql'));
const latestMigration = files[files.length - 1];

if (!latestMigration) {
  console.error('No migration files found');
  process.exit(1);
}

console.log(`Applying migration: ${latestMigration}`);

// Read the SQL file
const sqlPath = path.join(migrationsPath, latestMigration);
const sql = fs.readFileSync(sqlPath, 'utf8');

// Execute the SQL using Node-Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Beginning transaction...');
    
    // Split SQL into individual statements
    const statements = sql.split('-->').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      let statement = statements[i];
      // Remove statement-breakpoint comments if present
      statement = statement.replace('statement-breakpoint', '').trim();
      
      if (statement.length > 0) {
        console.log(`Executing statement ${i+1}/${statements.length}...`);
        await client.query(statement);
      }
    }
    
    await client.query('COMMIT');
    console.log('Migration applied successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();