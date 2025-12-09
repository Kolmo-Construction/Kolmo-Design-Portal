CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_minutes" integer,
	"clock_in_latitude" numeric(10, 7) NOT NULL,
	"clock_in_longitude" numeric(10, 7) NOT NULL,
	"clock_out_latitude" numeric(10, 7),
	"clock_out_longitude" numeric(10, 7),
	"clock_in_within_geofence" boolean NOT NULL,
	"clock_in_distance_meters" numeric(10, 2),
	"clock_out_within_geofence" boolean,
	"clock_out_distance_meters" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;