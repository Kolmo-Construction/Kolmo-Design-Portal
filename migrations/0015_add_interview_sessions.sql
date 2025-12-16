-- Create interview status enum
CREATE TYPE "public"."interview_status" AS ENUM('active', 'completed', 'abandoned');

-- Create interview_sessions table
CREATE TABLE IF NOT EXISTS "interview_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lead_id" integer,
	"status" "interview_status" DEFAULT 'active' NOT NULL,
	"current_field" text,
	"quote_draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_user_id" ON "interview_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_status" ON "interview_sessions" ("status");
CREATE INDEX IF NOT EXISTS "idx_interview_sessions_created_at" ON "interview_sessions" ("created_at" DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_interview_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_interview_sessions_updated_at_trigger
BEFORE UPDATE ON "interview_sessions"
FOR EACH ROW
EXECUTE FUNCTION update_interview_sessions_updated_at();
