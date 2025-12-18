-- Migration: Add unified visibility and status fields to all content types
-- This enables a unified approval workflow across all content (images, invoices, documents, etc.)

-- Add visibility field to invoices (status already exists)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'published'));

-- Add status and visibility to documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'published')),
ADD COLUMN IF NOT EXISTS reviewed_by_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Add visibility to milestones (status already exists)
ALTER TABLE milestones
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'published'));

-- Add status and visibility to daily_logs
ALTER TABLE daily_logs
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'published')),
ADD COLUMN IF NOT EXISTS reviewed_by_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Add visibility to punch_list_items
ALTER TABLE punch_list_items
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'published'));

-- Add status and visibility to admin_images
ALTER TABLE admin_images
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin_only' CHECK (visibility IN ('admin_only', 'published')),
ADD COLUMN IF NOT EXISTS reviewed_by_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

-- Create indexes for performance (visibility filtering will be common)
CREATE INDEX IF NOT EXISTS idx_invoices_visibility ON invoices(visibility);
CREATE INDEX IF NOT EXISTS idx_invoices_project_visibility ON invoices(project_id, visibility);

CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_project_visibility ON documents(project_id, visibility);

CREATE INDEX IF NOT EXISTS idx_milestones_visibility ON milestones(visibility);
CREATE INDEX IF NOT EXISTS idx_milestones_project_visibility ON milestones(project_id, visibility);

CREATE INDEX IF NOT EXISTS idx_daily_logs_visibility ON daily_logs(visibility);
CREATE INDEX IF NOT EXISTS idx_daily_logs_project_visibility ON daily_logs(project_id, visibility);

CREATE INDEX IF NOT EXISTS idx_punch_list_items_visibility ON punch_list_items(visibility);
CREATE INDEX IF NOT EXISTS idx_punch_list_items_project_visibility ON punch_list_items(project_id, visibility);

CREATE INDEX IF NOT EXISTS idx_admin_images_visibility ON admin_images(visibility);
CREATE INDEX IF NOT EXISTS idx_admin_images_project_visibility ON admin_images(project_id, visibility);

-- Backward compatibility: Set existing content as published
-- This ensures existing client-visible content remains visible after migration

-- Invoices: Publish non-draft invoices
UPDATE invoices
SET visibility = 'published'
WHERE visibility IS NULL AND status != 'draft';

UPDATE invoices
SET visibility = 'admin_only'
WHERE visibility IS NULL AND status = 'draft';

-- Documents: Publish all existing documents (they were visible before)
UPDATE documents
SET visibility = 'published', status = 'approved'
WHERE visibility IS NULL;

-- Milestones: Publish completed milestones
UPDATE milestones
SET visibility = 'published'
WHERE visibility IS NULL AND status = 'completed';

UPDATE milestones
SET visibility = 'admin_only'
WHERE visibility IS NULL AND status IN ('pending', 'in_progress', 'delayed');

-- Daily Logs: Publish all existing logs (they were visible before)
UPDATE daily_logs
SET visibility = 'published', status = 'approved'
WHERE visibility IS NULL;

-- Punch List: Publish resolved/verified items
UPDATE punch_list_items
SET visibility = 'published'
WHERE visibility IS NULL AND status IN ('resolved', 'verified');

UPDATE punch_list_items
SET visibility = 'admin_only'
WHERE visibility IS NULL AND status IN ('open', 'in_progress');

-- Admin Images: Publish all existing images (they were visible before)
UPDATE admin_images
SET visibility = 'published', status = 'approved'
WHERE visibility IS NULL;
