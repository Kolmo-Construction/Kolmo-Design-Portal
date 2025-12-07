CREATE TYPE "public"."progress_update_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."progress_update_visibility" AS ENUM('admin_only', 'published');--> statement-breakpoint
CREATE TABLE "progress_report_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"progress_update_id" integer,
	"summary_text" text NOT NULL,
	"date_from" timestamp NOT NULL,
	"date_to" timestamp NOT NULL,
	"progress_snapshot" jsonb,
	"image_count" integer DEFAULT 0,
	"generated_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_update_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"progress_update_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "update_media" DROP CONSTRAINT "update_media_update_id_progress_updates_id_fk";
--> statement-breakpoint
ALTER TABLE "update_media" DROP CONSTRAINT "update_media_punch_list_item_id_punch_list_items_id_fk";
--> statement-breakpoint
ALTER TABLE "update_media" DROP CONSTRAINT "update_media_uploaded_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "drive_images" ADD COLUMN "migrated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "generated_by_ai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "status" "progress_update_status" DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "visibility" "progress_update_visibility" DEFAULT 'admin_only';--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "reviewed_by_id" integer;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "ai_analysis_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "raw_llm_response" jsonb;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "progress_report_summaries" ADD CONSTRAINT "progress_report_summaries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_report_summaries" ADD CONSTRAINT "progress_report_summaries_progress_update_id_progress_updates_id_fk" FOREIGN KEY ("progress_update_id") REFERENCES "public"."progress_updates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_report_summaries" ADD CONSTRAINT "progress_report_summaries_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_update_views" ADD CONSTRAINT "progress_update_views_progress_update_id_progress_updates_id_fk" FOREIGN KEY ("progress_update_id") REFERENCES "public"."progress_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_update_views" ADD CONSTRAINT "progress_update_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_media" ADD CONSTRAINT "update_media_update_id_progress_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."progress_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_media" ADD CONSTRAINT "update_media_punch_list_item_id_punch_list_items_id_fk" FOREIGN KEY ("punch_list_item_id") REFERENCES "public"."punch_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_media" ADD CONSTRAINT "update_media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;