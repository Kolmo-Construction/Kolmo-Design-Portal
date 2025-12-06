CREATE TABLE "drive_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"drive_created_time" timestamp NOT NULL,
	"drive_modified_time" timestamp NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"capture_date" timestamp,
	"device" text,
	"r2_url" text,
	"r2_key" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_images_file_id_unique" UNIQUE("file_id")
);
