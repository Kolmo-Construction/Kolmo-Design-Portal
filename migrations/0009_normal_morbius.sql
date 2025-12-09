CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"vendor_name" text,
	"total_amount" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"receipt_date" timestamp,
	"category" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"notes" text,
	"image_url" text NOT NULL,
	"image_key" text NOT NULL,
	"ocr_data" jsonb,
	"ocr_confidence" numeric(5, 2),
	"ocr_processed_at" timestamp,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" integer,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;