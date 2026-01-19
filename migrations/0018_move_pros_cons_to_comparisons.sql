-- Migration: Move pros/cons from design_proposals to before_after_comparisons
-- This allows each comparison to have its own pros/cons instead of global ones

-- Add pros and cons columns to before_after_comparisons table
ALTER TABLE "before_after_comparisons"
ADD COLUMN "pros" text[],
ADD COLUMN "cons" text[];

-- Remove pros, cons, and show_pros_cons columns from design_proposals table
ALTER TABLE "design_proposals"
DROP COLUMN IF EXISTS "pros",
DROP COLUMN IF EXISTS "cons",
DROP COLUMN IF EXISTS "show_pros_cons";
