-- Migration: Add access_scope column to users table
-- This controls whether users can access web portal, mobile app, or both

-- Add access_scope column with default 'both' for backward compatibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_scope TEXT DEFAULT 'both';

-- Add check constraint to ensure valid values
ALTER TABLE users ADD CONSTRAINT access_scope_check
  CHECK (access_scope IN ('web', 'mobile', 'both'));

-- Add comment for documentation
COMMENT ON COLUMN users.access_scope IS 'Platform access control: web (portal only), mobile (app only), or both';

-- Update existing users based on role (optional - you can customize this)
-- Field workers are typically mobile-only
UPDATE users SET access_scope = 'mobile'
WHERE role = 'contractor' AND access_scope = 'both';

-- Admins and project managers need web access
UPDATE users SET access_scope = 'web'
WHERE role IN ('admin', 'projectManager') AND access_scope = 'both';

-- Clients typically use web portal
UPDATE users SET access_scope = 'web'
WHERE role = 'client' AND access_scope = 'both';
