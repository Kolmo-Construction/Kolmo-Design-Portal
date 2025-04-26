import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './shared/schema.js';

// Configure Neon to use WebSockets
const neonConfig = { webSocketConstructor: ws };

async function main() {
  console.log('Starting database schema setup');
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Please set DATABASE_URL environment variable.");
  }
  
  try {
    // Create a connection pool
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    
    // Create schemas using direct SQL
    console.log('Creating database tables...');
    
    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'client',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        magic_link_token TEXT UNIQUE,
        magic_link_expiry TIMESTAMP,
        is_activated BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
    console.log('Users table created');
    
    // Create projects table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        start_date TIMESTAMP,
        estimated_completion_date TIMESTAMP,
        actual_completion_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'planning',
        total_budget DECIMAL(10, 2) NOT NULL,
        image_url TEXT,
        progress INTEGER DEFAULT 0,
        project_manager_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Projects table created');
    
    // Create client_projects table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS client_projects (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES users(id),
        project_id INTEGER NOT NULL REFERENCES projects(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Client Projects table created');
    
    // Create documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        category TEXT NOT NULL,
        uploaded_by_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Documents table created');
    
    // Create invoices table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        invoice_number TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        issue_date TIMESTAMP NOT NULL,
        due_date TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        document_id INTEGER REFERENCES documents(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Invoices table created');
    
    // Create payments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        amount DECIMAL(10, 2) NOT NULL,
        payment_date TIMESTAMP NOT NULL,
        payment_method TEXT NOT NULL,
        reference TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Payments table created');
    
    // Create messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        recipient_id INTEGER REFERENCES users(id),
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Messages table created');
    
    // Create progress_updates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS progress_updates (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        update_type TEXT NOT NULL,
        created_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Progress Updates table created');
    
    // Create update_media table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS update_media (
        id SERIAL PRIMARY KEY,
        update_id INTEGER NOT NULL REFERENCES progress_updates(id),
        media_url TEXT NOT NULL,
        media_type TEXT NOT NULL,
        caption TEXT,
        uploaded_by_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Update Media table created');
    
    // Create milestones table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS milestones (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL,
        description TEXT,
        planned_date TIMESTAMP NOT NULL,
        actual_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Milestones table created');
    
    // Create selections table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS selections (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        options JSONB,
        selection_deadline TIMESTAMP,
        selected_option TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Selections table created');
    
    // Create tasks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        start_date TIMESTAMP,
        due_date TIMESTAMP,
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        estimated_hours DECIMAL(5, 2),
        actual_hours DECIMAL(5, 2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tasks table created');
    
    // Create task_dependencies table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id SERIAL PRIMARY KEY,
        predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        successor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        type TEXT DEFAULT 'FS',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Task Dependencies table created');
    
    // Create daily_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        log_date TIMESTAMP NOT NULL,
        weather TEXT,
        temperature DECIMAL(5, 2),
        crew_on_site TEXT,
        work_performed TEXT NOT NULL,
        issues_encountered TEXT,
        safety_observations TEXT,
        created_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Daily Logs table created');
    
    // Create daily_log_photos table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS daily_log_photos (
        id SERIAL PRIMARY KEY,
        daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
        photo_url TEXT NOT NULL,
        caption TEXT,
        uploaded_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Daily Log Photos table created');
    
    // Create punch_list_items table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS punch_list_items (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        location TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT DEFAULT 'medium',
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        due_date TIMESTAMP,
        photo_url TEXT,
        created_by_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP
      );
    `);
    console.log('Punch List Items table created');
    
    console.log('Database setup completed successfully!');
    
    // Close the pool
    await pool.end();
    
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

main();