CREATE TYPE "public"."feedback_type" AS ENUM('edit', 'approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'finalized', 'archived');--> statement-breakpoint
CREATE TABLE "generation_prompts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"project_version_id" uuid NOT NULL,
	"input_text" text NOT NULL,
	"raw_prompt" text NOT NULL,
	"used_embedding_ids" jsonb,
	"llm_output" jsonb,
	"model_used" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"project_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_tasks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"project_version_id" uuid NOT NULL,
	"task_name" text NOT NULL,
	"trade" text NOT NULL,
	"phase" text NOT NULL,
	"description" text NOT NULL,
	"duration_days" numeric(5, 2) NOT NULL,
	"required_materials" jsonb,
	"required_inspections" jsonb,
	"notes" text,
	"is_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_chunks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"task_text" text NOT NULL,
	"trade" text NOT NULL,
	"phase" text NOT NULL,
	"project_type" text NOT NULL,
	"embedding" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_feedback" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"feedback_type" "feedback_type" NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "update_media" ALTER COLUMN "update_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "update_media" ADD COLUMN "punch_list_item_id" integer;--> statement-breakpoint
ALTER TABLE "generation_prompts" ADD CONSTRAINT "generation_prompts_project_version_id_project_versions_id_fk" FOREIGN KEY ("project_version_id") REFERENCES "public"."project_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_task_dependencies" ADD CONSTRAINT "rag_task_dependencies_task_id_rag_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."rag_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_task_dependencies" ADD CONSTRAINT "rag_task_dependencies_depends_on_task_id_rag_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."rag_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_tasks" ADD CONSTRAINT "rag_tasks_project_version_id_project_versions_id_fk" FOREIGN KEY ("project_version_id") REFERENCES "public"."project_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_feedback" ADD CONSTRAINT "task_feedback_task_id_rag_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."rag_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_feedback" ADD CONSTRAINT "task_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_media" ADD CONSTRAINT "update_media_punch_list_item_id_punch_list_items_id_fk" FOREIGN KEY ("punch_list_item_id") REFERENCES "public"."punch_list_items"("id") ON DELETE no action ON UPDATE no action;