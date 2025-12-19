-- Migration: Add progress tracking to tasks
-- This enables weighted project progress calculation based on task completion

-- Add progress column to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 NOT NULL;

-- Add check constraint to ensure progress is between 0 and 100
ALTER TABLE tasks
ADD CONSTRAINT tasks_progress_check CHECK (progress >= 0 AND progress <= 100);

-- Set progress to 100 for completed tasks
UPDATE tasks
SET progress = 100
WHERE status IN ('done', 'completed');

-- Set progress to 0 for todo and cancelled tasks
UPDATE tasks
SET progress = 0
WHERE status IN ('todo', 'cancelled');

-- Set progress to 50 for in_progress tasks (reasonable default)
UPDATE tasks
SET progress = 50
WHERE status = 'in_progress';

-- Create index for efficient progress queries
CREATE INDEX IF NOT EXISTS idx_tasks_progress ON tasks(progress);
CREATE INDEX IF NOT EXISTS idx_tasks_project_progress ON tasks(project_id, progress);
