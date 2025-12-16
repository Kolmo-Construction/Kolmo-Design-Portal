CREATE TYPE "public"."lead_source" AS ENUM('manual', 'web_search', 'social_media', 'thumbtack', 'homedepot', 'nextdoor', 'referral');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'archived');--> statement-breakpoint
CREATE TABLE "conversation_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"project_id" integer,
	"user_id" integer,
	"fact_type" text NOT NULL,
	"fact_content" jsonb NOT NULL,
	"fact_summary" text NOT NULL,
	"embedding" vector(1536),
	"is_active" boolean DEFAULT true NOT NULL,
	"superseded_by" integer,
	"valid_until" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"author_role" text NOT NULL,
	"confidence_score" numeric(3, 2),
	"verification_status" text DEFAULT 'pending_approval' NOT NULL,
	"verified_by" integer,
	"verified_at" timestamp with time zone,
	"financial_amount" numeric(12, 2),
	"currency" text DEFAULT 'USD',
	"financial_category" text,
	"financial_type" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"requires_action" boolean DEFAULT false NOT NULL,
	"action_deadline" timestamp with time zone,
	"source_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Unknown User' NOT NULL,
	"contact_info" text,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"content_snippet" text,
	"interest_tags" text[],
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"draft_response" text,
	"confidence_score" integer,
	"location" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"contacted_at" timestamp,
	"converted_to_quote_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "labor_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_scope" text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hourly_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "conversation_facts" ADD CONSTRAINT "conversation_facts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_facts" ADD CONSTRAINT "conversation_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_facts" ADD CONSTRAINT "conversation_facts_superseded_by_conversation_facts_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."conversation_facts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_facts" ADD CONSTRAINT "conversation_facts_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_to_quote_id_quotes_id_fk" FOREIGN KEY ("converted_to_quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;