-- Migration: Add invoice types and task tracking
-- Adds new invoice types and taskId field for better invoice source tracking

-- Add new invoice types to the enum
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'task_completion';
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'additional_work';
ALTER TYPE invoice_type ADD VALUE IF NOT EXISTS 'expense';

-- Add taskId column to track task-based invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS task_id INTEGER;

-- Add comment to describe the field
COMMENT ON COLUMN invoices.task_id IS 'Links to the task that generated this invoice (for billable task completions)';

-- Create index for efficient task-based invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_task_id ON invoices(task_id);
