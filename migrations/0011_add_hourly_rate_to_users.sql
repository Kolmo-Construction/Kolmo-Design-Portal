-- Add hourly rate field to users table for labor cost tracking
-- This field stores the hourly wage/rate for each user to calculate labor costs from time entries

ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

-- Add comment
COMMENT ON COLUMN users.hourly_rate IS 'Hourly wage/rate for labor cost calculations (e.g., 35.50 = $35.50/hour)';
