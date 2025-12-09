-- Add longitude and latitude columns to projects table for geofencing
ALTER TABLE "projects" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "latitude" numeric(10, 7);
