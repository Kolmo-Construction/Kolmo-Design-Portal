-- Add labor cost field to time_entries table
-- This field stores the calculated labor cost based on duration and hourly rate

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(10, 2);

-- Add comment
COMMENT ON COLUMN time_entries.labor_cost IS 'Calculated labor cost (durationMinutes / 60 * hourlyRate)';
