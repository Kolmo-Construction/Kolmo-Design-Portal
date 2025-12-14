-- Add lead status enum
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'archived');

-- Add lead source enum
CREATE TYPE "public"."lead_source" AS ENUM('manual', 'web_search', 'social_media', 'thumbtack', 'homedepot', 'nextdoor', 'referral');

-- Create leads table
CREATE TABLE "leads" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT DEFAULT 'Unknown User' NOT NULL,
  "contact_info" TEXT,
  "source" "lead_source" DEFAULT 'manual' NOT NULL,
  "source_url" TEXT,
  "content_snippet" TEXT,
  "interest_tags" TEXT[],
  "status" "lead_status" DEFAULT 'new' NOT NULL,
  "draft_response" TEXT,
  "confidence_score" INTEGER,
  "location" TEXT,
  "detected_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "contacted_at" TIMESTAMP,
  "converted_to_quote_id" INTEGER REFERENCES "quotes"("id"),
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX "leads_status_idx" ON "leads" ("status");
CREATE INDEX "leads_source_idx" ON "leads" ("source");
CREATE INDEX "leads_detected_at_idx" ON "leads" ("detected_at" DESC);
CREATE INDEX "leads_confidence_idx" ON "leads" ("confidence_score" DESC);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at_trigger
BEFORE UPDATE ON "leads"
FOR EACH ROW
EXECUTE FUNCTION update_leads_updated_at();

-- Add comment
COMMENT ON TABLE "leads" IS 'Raw sales leads from various sources before conversion to quotes';
