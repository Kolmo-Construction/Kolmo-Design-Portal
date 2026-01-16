// shared/schema.ts

import { pgTable, text, serial, integer, decimal, timestamp, boolean, jsonb, foreignKey, pgEnum, uuid as pgUuid, uuid } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Define project statuses enum
export const projectStatusEnum = pgEnum('project_status', ['draft', 'finalized', 'archived']);

// Define feedback types enum
export const feedbackTypeEnum = pgEnum('feedback_type', ['edit', 'approve', 'reject']);

// Define invoice status enum
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled']);

// Define invoice type enum
export const invoiceTypeEnum = pgEnum('invoice_type', ['down_payment', 'milestone', 'final', 'change_order', 'regular', 'task_completion', 'additional_work', 'expense']);

// Define progress update status enum (for LLM-generated reports workflow)
export const progressUpdateStatusEnum = pgEnum('progress_update_status', ['draft', 'pending_review', 'approved', 'rejected']);

// Define progress update visibility enum
export const progressUpdateVisibilityEnum = pgEnum('progress_update_visibility', ['admin_only', 'published']);

// Lead management enums
export const leadStatusEnum = pgEnum('lead_status', [
  'new',        // Just discovered, not yet contacted
  'contacted',  // Initial contact made
  'qualified',  // Meets criteria, worth pursuing
  'converted',  // Became a quote or project
  'archived'    // Not interested or invalid
]);

export const leadSourceEnum = pgEnum('lead_source', [
  'manual',       // Manually entered
  'web_search',   // Reddit, Houzz, Public Web (Tavily)
  'social_media', // Facebook, Instagram, Twitter
  'thumbtack',    // Email ingestion from Thumbtack
  'homedepot',    // Email ingestion from Home Depot Pro Referral
  'nextdoor',     // Email or search
  'referral'      // Word of mouth
]);

// Interview session status enum
export const interviewStatusEnum = pgEnum('interview_status', ['active', 'completed', 'abandoned']);

// Zoho tokens table for OAuth persistence
export const zohoTokens = pgTable("zoho_tokens", {
  id: serial("id").primaryKey(),
  service: text("service").notNull().default("expense"), // expense, books, etc.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  organizationId: text("organization_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});





// Define RAG Tables

// Project versions table for immutable versioning of task bundles
export const projectVersions = pgTable("project_versions", {
  id: pgUuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Advanced Tasks table for the RAG system
export const ragTasks = pgTable("rag_tasks", {
  id: pgUuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  projectVersionId: pgUuid("project_version_id").notNull().references(() => projectVersions.id, { onDelete: 'cascade' }),
  taskName: text("task_name").notNull(),
  trade: text("trade").notNull(), // e.g., 'plumber', 'tile setter'
  phase: text("phase").notNull(), // e.g., 'Rough-In', 'Finish'
  description: text("description").notNull(),
  durationDays: decimal("duration_days", { precision: 5, scale: 2 }).notNull(),
  requiredMaterials: jsonb("required_materials"), // Array of materials
  requiredInspections: jsonb("required_inspections"), // Array of inspections
  notes: text("notes"),
  isGenerated: boolean("is_generated").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task dependencies for RAG tasks
export const ragTaskDependencies = pgTable("rag_task_dependencies", {
  id: pgUuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  taskId: pgUuid("task_id").notNull().references(() => ragTasks.id, { onDelete: 'cascade' }),
  dependsOnTaskId: pgUuid("depends_on_task_id").notNull().references(() => ragTasks.id, { onDelete: 'cascade' }),
});

// Task chunks for the RAG corpus
export const taskChunks = pgTable("task_chunks", {
  id: pgUuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  taskText: text("task_text").notNull(), // canonical description
  trade: text("trade").notNull(),
  phase: text("phase").notNull(),
  projectType: text("project_type").notNull(),
  embedding: text("embedding"), // Will store vector data as text for now, will update when pgvector is integrated
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Generation prompts for storing the input spec and prompt
export const generationPrompts = pgTable("generation_prompts", {
  id: pgUuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  projectVersionId: pgUuid("project_version_id").notNull().references(() => projectVersions.id, { onDelete: 'cascade' }),
  inputText: text("input_text").notNull(), // what the user typed
  rawPrompt: text("raw_prompt").notNull(),
  usedEmbeddingIds: jsonb("used_embedding_ids"), // Array of UUIDs
  llmOutput: jsonb("llm_output"),
  modelUsed: text("model_used").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task feedback for refining generations
export const taskFeedback = pgTable("task_feedback", {
  id: pgUuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  taskId: pgUuid("task_id").notNull().references(() => ragTasks.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  feedbackType: feedbackTypeEnum("feedback_type").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// Users table for authentication and profile information
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("client"), // client, admin, projectManager, contractor
  accessScope: text("access_scope").notNull().default("both"), // Platform access: 'web', 'mobile', or 'both'

  // Labor cost tracking
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }), // Hourly wage for labor cost calculations

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  magicLinkToken: text("magic_link_token").unique(),
  magicLinkExpiry: timestamp("magic_link_expiry"),
  isActivated: boolean("is_activated").default(false).notNull(),

  // Stripe customer integration for payment processing
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
});

// Interview sessions table - AI-powered conversational quote collection
export const interviewSessions = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: 'set null' }),

  status: interviewStatusEnum("status").notNull().default("active"),
  currentField: text("current_field"),

  // Quote draft data collected during interview
  quoteDraft: jsonb("quote_draft").$type<{
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress?: string;
    projectType?: string;
    location?: string;
    scopeDescription?: string;
    estimatedBudget?: string;
    downPaymentPercentage?: number;
    estimatedStartDate?: string;
    estimatedCompletionDate?: string;
    validUntil?: string;
    lineItems?: Array<{
      category: string;
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
    }>;
  }>().notNull().default(sql`'{}'::jsonb`),

  // Conversation transcript
  transcript: jsonb("transcript").$type<Array<{
    role: 'assistant' | 'user';
    content: string;
    timestamp: string;
    audioUri?: string;
    extractedData?: Record<string, any>;
  }>>().notNull().default(sql`'[]'::jsonb`),

  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InterviewSession = typeof interviewSessions.$inferSelect;
export type NewInterviewSession = typeof interviewSessions.$inferInsert;

// API Keys table for mobile and external API authentication
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Security: Store hashed key, display prefix only
  keyHash: text("key_hash").notNull().unique(), // bcrypt hash of full key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (e.g., "kolmo_ab")

  // Metadata
  name: text("name").notNull(), // User-friendly name like "Mobile App - iPhone"
  description: text("description"),

  // Lifecycle management
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"), // Nullable for permanent keys
  lastUsedAt: timestamp("last_used_at"),

  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types for API keys
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// Time Entries table for time tracking with geofencing
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Time tracking
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"), // Nullable for active entries
  durationMinutes: integer("duration_minutes"), // Calculated on clock-out

  // Labor cost calculation
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }), // Calculated on clock-out (durationMinutes / 60 * hourlyRate)

  // Geolocation
  clockInLatitude: decimal("clock_in_latitude", { precision: 10, scale: 7 }).notNull(),
  clockInLongitude: decimal("clock_in_longitude", { precision: 10, scale: 7 }).notNull(),
  clockOutLatitude: decimal("clock_out_latitude", { precision: 10, scale: 7 }),
  clockOutLongitude: decimal("clock_out_longitude", { precision: 10, scale: 7 }),

  // Geofencing validation
  clockInWithinGeofence: boolean("clock_in_within_geofence").notNull(),
  clockInDistanceMeters: decimal("clock_in_distance_meters", { precision: 10, scale: 2 }),
  clockOutWithinGeofence: boolean("clock_out_within_geofence"),
  clockOutDistanceMeters: decimal("clock_out_distance_meters", { precision: 10, scale: 2 }),

  // Optional context
  notes: text("notes"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types for time entries
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;

// Receipts table for storing scanned receipts with OCR data
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  vendorName: text("vendor_name"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD").notNull(),
  receiptDate: timestamp("receipt_date"),
  category: text("category"), // materials, labor, equipment, other
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  imageUrl: text("image_url").notNull(),
  imageKey: text("image_key").notNull(),
  ocrData: jsonb("ocr_data"), // Full Taggun response
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 2 }),
  ocrProcessedAt: timestamp("ocr_processed_at"),
  isVerified: boolean("is_verified").default(false).notNull(),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types for receipts
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

// Projects table for storing project details
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  startDate: timestamp("start_date"),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  status: text("status").notNull().default("planning"), // planning, in_progress, on_hold, completed
  totalBudget: decimal("total_budget", { precision: 10, scale: 2 }).notNull().$type<string>(),
  imageUrl: text("image_url"),
  progress: integer("progress").default(0), // Percentage complete (0-100)
  projectManagerId: integer("project_manager_id").references(() => users.id),
  
  // Quote integration - track originating quote
  originQuoteId: integer("origin_quote_id").references(() => quotes.id),
  
  // Customer information for project management
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client project relationship (many-to-many)
export const clientProjects = pgTable("client_projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => users.id),
  projectId: integer("project_id").notNull().references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents table for storing project-related files
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  category: text("category").notNull(), // contracts, plans, permits, invoices, etc.
  uploadedById: integer("uploaded_by_id").references(() => users.id),

  // Approval workflow
  status: text("status").default("approved").notNull().$type<'draft' | 'pending_review' | 'approved' | 'rejected'>(),
  visibility: text("visibility").default("admin_only").notNull().$type<'admin_only' | 'published'>(),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Invoice enums (moved to top of file to avoid duplicates)

// Invoices table for financial tracking
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id),
  quoteId: integer("quote_id").references(() => quotes.id), // Link to originating quote
  milestoneId: integer("milestone_id"), // Link to milestone that generated this invoice
  taskId: integer("task_id"), // Link to task that generated this invoice (for billable tasks)
  invoiceNumber: text("invoice_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  invoiceType: invoiceTypeEnum("invoice_type").notNull().default("regular"), // Track payment type
  documentId: integer("document_id").references(() => documents.id),
  
  // Stripe integration fields
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  paymentLink: text("payment_link"), // Secure payment link for customers
  
  // Customer information
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  billingAddress: jsonb("billing_address"), // Store billing address as JSON
  
  // Payment terms
  lateFeePercentage: decimal("late_fee_percentage", { precision: 5, scale: 2 }).default("0.00"),
  gracePeriodDays: integer("grace_period_days").default(5),

  // Visibility control
  visibility: text("visibility").default("admin_only").notNull().$type<'admin_only' | 'published'>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payments table for tracking payments against invoices
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  reference: text("reference"),
  
  // Stripe integration fields
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  stripeTransactionId: text("stripe_transaction_id"),
  
  // Payment status tracking
  status: text("status").notNull().default("pending"), // pending, processing, succeeded, failed, cancelled
  failureReason: text("failure_reason"),
  
  // Recorded by (admin user who recorded manual payment)
  recordedById: integer("recorded_by_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages table for communication log
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  recipientId: integer("recipient_id").references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Progress updates table
export const progressUpdates = pgTable("progress_updates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  updateType: text("update_type").notNull(), // milestone, photo, issue, general, ai_analysis
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // LLM-powered progress report fields
  generatedByAI: boolean("generated_by_ai").default(false).notNull(),
  status: progressUpdateStatusEnum("status").default('draft'),
  visibility: progressUpdateVisibilityEnum("visibility").default('admin_only'),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),

  // AI analysis metadata for auditability and debugging
  aiAnalysisMetadata: jsonb("ai_analysis_metadata").$type<{
    confidence?: number;
    tokensUsed?: { input: number; output: number };
    cost?: { total: number };
    model?: string;
    imageIds?: number[];
    previousSummaryUsed?: boolean;
  }>(),

  // Store raw LLM response for audit trail
  rawLLMResponse: jsonb("raw_llm_response").$type<{
    executiveSummary?: string;
    keyObservations?: string[];
    progressEstimate?: Record<string, number>;
    concernsOrIssues?: string[];
    recommendedActions?: string[];
    rawText?: string;
  }>(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Progress report summaries - stores incremental summaries for LLM context
// This allows us to provide previous context without sending full history
export const progressReportSummaries = pgTable("progress_report_summaries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  progressUpdateId: integer("progress_update_id").references(() => progressUpdates.id, { onDelete: 'set null' }),

  // Summary text for LLM context (compressed version of the full report)
  summaryText: text("summary_text").notNull(),

  // Date range this summary covers
  dateFrom: timestamp("date_from").notNull(),
  dateTo: timestamp("date_to").notNull(),

  // Progress snapshot at this point
  progressSnapshot: jsonb("progress_snapshot").$type<{
    overallProgress?: number;
    phaseProgress?: Record<string, number>;
    completedMilestones?: string[];
  }>(),

  // Metadata
  imageCount: integer("image_count").default(0),
  generatedById: integer("generated_by_id").notNull().references(() => users.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Progress update views - tracks which updates clients have seen
export const progressUpdateViews = pgTable("progress_update_views", {
  id: serial("id").primaryKey(),
  progressUpdateId: integer("progress_update_id").notNull().references(() => progressUpdates.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

// Update media (photos/videos) connected to progress updates OR punch list items
export const updateMedia = pgTable("update_media", {
  id: serial("id").primaryKey(),
  updateId: integer("update_id").references(() => progressUpdates.id, { onDelete: 'cascade' }),
  punchListItemId: integer("punch_list_item_id").references(() => punchListItems.id, { onDelete: 'cascade' }),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(), // image, video
  caption: text("caption"),
  uploadedById: integer("uploaded_by_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin image gallery for project photos with tagging
export const adminImages = pgTable("admin_images", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id), // Optional project association
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  
  // Image metadata preservation
  metadata: jsonb("metadata"), // EXIF data, camera info, GPS, etc.
  
  // Tagging system
  tags: text("tags").array(), // Array of tag strings
  category: text("category").default("general"), // general, progress, materials, before_after, etc.
  
  uploadedById: integer("uploaded_by_id").notNull().references(() => users.id),
  // Approval workflow
  status: text("status").default("approved").notNull().$type<'draft' | 'pending_review' | 'approved' | 'rejected'>(),
  visibility: text("visibility").default("admin_only").notNull().$type<'admin_only' | 'published'>(),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Google Drive images ingestion with EXIF metadata
export const driveImages = pgTable("drive_images", {
  id: serial("id").primaryKey(),
  fileId: text("file_id").notNull().unique(), // Google Drive file ID
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // in bytes

  // Drive timestamps
  driveCreatedTime: timestamp("drive_created_time").notNull(),
  driveModifiedTime: timestamp("drive_modified_time").notNull(),

  // EXIF GPS coordinates (decimal degrees)
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),

  // EXIF capture date (DateTimeOriginal or fallback to driveCreatedTime)
  captureDate: timestamp("capture_date"),

  // Device information from EXIF
  device: text("device"), // e.g., "Apple iPhone 12 Pro"

  // R2 storage information
  r2Url: text("r2_url"),
  r2Key: text("r2_key"),

  // Processing metadata
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  migrated: boolean("migrated").default(false).notNull(), // Has this been migrated to admin_images?
});

// Design proposals for before/after comparisons
export const designProposals = pgTable("design_proposals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  projectId: integer("project_id").references(() => projects.id), // Optional link to existing project
  accessToken: text("access_token").notNull().unique(), // Public shareable token
  
  // Pros and cons section
  pros: text("pros").array(), // Array of pros
  cons: text("cons").array(), // Array of cons
  showProsCons: boolean("show_pros_cons").default(false).notNull(), // Toggle to show/hide pros/cons
  
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Before/after comparison pairs within a design proposal
export const beforeAfterComparisons = pgTable("before_after_comparisons", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => designProposals.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  beforeImageUrl: text("before_image_url").notNull(),
  afterImageUrl: text("after_image_url").notNull(),
  orderIndex: integer("order_index").default(0).notNull(), // For sorting comparisons
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Proposal gallery images - for current state/progress photos
export const proposalGalleryImages = pgTable("proposal_gallery_images", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => designProposals.id, { onDelete: 'cascade' }),
  imageUrl: text("image_url").notNull(),
  imageKey: text("image_key").notNull(), // R2 storage key for deletion
  caption: text("caption"),
  description: text("description"),

  // Upload metadata
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id), // If uploaded by authenticated user
  uploaderName: text("uploader_name"), // Optional name if uploaded by customer
  uploaderEmail: text("uploader_email"), // Optional email if uploaded by customer

  // Image metadata
  originalFilename: text("original_filename").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),

  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Comments on proposal gallery images
export const proposalImageComments = pgTable("proposal_image_comments", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").notNull().references(() => proposalGalleryImages.id, { onDelete: 'cascade' }),
  parentCommentId: integer("parent_comment_id").references((): any => proposalImageComments.id, { onDelete: 'cascade' }), // For threaded replies

  // Comment content
  comment: text("comment").notNull(),

  // Commenter info (optional identification)
  commentedByUserId: integer("commented_by_user_id").references(() => users.id), // If authenticated user
  commenterName: text("commenter_name"), // Optional name
  commenterEmail: text("commenter_email"), // Optional email

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Favorites/important markers on images
export const proposalImageFavorites = pgTable("proposal_image_favorites", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").notNull().references(() => proposalGalleryImages.id, { onDelete: 'cascade' }),

  // Who marked it as favorite
  markedByUserId: integer("marked_by_user_id").references(() => users.id), // If authenticated user
  markerName: text("marker_name"), // Optional name
  markerEmail: text("marker_email"), // Optional email

  note: text("note"), // Optional note about why it's important
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Milestones for project timeline with billing support
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  plannedDate: timestamp("planned_date").notNull(),
  actualDate: timestamp("actual_date"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, delayed
  
  // Billing configuration
  isBillable: boolean("is_billable").default(false).notNull(),
  billingPercentage: decimal("billing_percentage", { precision: 5, scale: 2 }).default("0"), // Percentage of total project budget
  
  // Order and categorization
  orderIndex: integer("order_index").default(0).notNull(), // For sorting milestones
  category: text("category").default("delivery"), // delivery, billing, approval, inspection
  
  // Completion tracking
  completedById: integer("completed_by_id").references(() => users.id),
  completedAt: timestamp("completed_at"),
  
  // Billing tracking
  invoiceId: integer("invoice_id"), // Link to generated invoice when billed
  billedAt: timestamp("billed_at"),

  // Visibility control
  visibility: text("visibility").default("admin_only").notNull().$type<'admin_only' | 'published'>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Material selections for client approval
export const selections = pgTable("selections", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  category: text("category").notNull(), // flooring, lighting, hardware, etc.
  title: text("title").notNull(),
  description: text("description"),
  options: jsonb("options"), // Array of selection options with details
  selectionDeadline: timestamp("selection_deadline"),
  selectedOption: text("selected_option"),
  status: text("status").notNull().default("pending"), // pending, selected, approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Tasks Table ---
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }), // Cascade delete tasks if project is deleted
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo, in_progress, blocked, done, cancelled
  priority: text("priority").default("medium"), // low, medium, high
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: 'set null' }), // Set assignee to null if user deleted
  estimatedHours: decimal("estimated_hours", { precision: 5, scale: 2 }), // DECIMAL column
  actualHours: decimal("actual_hours", { precision: 5, scale: 2 }), // DECIMAL column
  progress: integer("progress").default(0).notNull(), // Task completion percentage (0-100)
  publishedAt: timestamp("published_at"), // When the task was published to clients (null = not published)
  
  // Billing configuration
  isBillable: boolean("is_billable").default(false).notNull(),
  billableAmount: decimal("billable_amount", { precision: 10, scale: 2 }).default("0"), // Fixed amount for this task
  billingRate: decimal("billing_rate", { precision: 8, scale: 2 }), // Hourly rate if time-based billing
  billingType: text("billing_type").default("fixed"), // fixed, hourly, percentage
  billingPercentage: decimal("billing_percentage", { precision: 5, scale: 2 }).default("0"), // Percentage of total project budget
  
  // Completion and billing tracking
  completedAt: timestamp("completed_at"),
  invoiceId: integer("invoice_id").references(() => invoices.id), // Link to generated invoice when billed
  billedAt: timestamp("billed_at"),
  milestoneId: integer("milestone_id").references(() => milestones.id, { onDelete: 'set null' }), // Link to milestone for billing
  notes: text("notes"), // Additional notes and system messages
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Task dependencies table ---
export const taskDependencies = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  predecessorId: integer("predecessor_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  successorId: integer("successor_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  type: text("type").default("FS"), // FS (Finish-to-Start), SS, FF, SF
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Daily Logs table ---
export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  logDate: timestamp("log_date").notNull(),
  weather: text("weather"),
  temperature: decimal("temperature", { precision: 5, scale: 2 }), // Optional temp tracking
  crewOnSite: text("crew_on_site"), // Simple text for now, could be relational
  workPerformed: text("work_performed").notNull(),
  issuesEncountered: text("issues_encountered"),
  safetyObservations: text("safety_observations"),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  // Approval workflow
  status: text("status").default("approved").notNull().$type<'draft' | 'pending_review' | 'approved' | 'rejected'>(),
  visibility: text("visibility").default("admin_only").notNull().$type<'admin_only' | 'published'>(),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Daily Log Photos table ---
export const dailyLogPhotos = pgTable("daily_log_photos", {
  id: serial("id").primaryKey(),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: 'cascade' }),
  photoUrl: text("photo_url").notNull(), // URL from R2
  caption: text("caption"),
  uploadedById: integer("uploaded_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Punch List Items table ---
export const punchListItems = pgTable("punch_list_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  location: text("location"), // e.g., "Kitchen", "Master Bath"
  status: text("status").notNull().default("open"), // open, in_progress, resolved, verified
  priority: text("priority").default("medium"), // low, medium, high
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp("due_date"),
  photoUrl: text("photo_url"), // Keep photoUrl as it exists in the database
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  // Visibility control
  visibility: text("visibility").default("admin_only").notNull().$type<'admin_only' | 'published'>(),
});

// --- Quotes System Tables ---

// Quotes table
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteNumber: text("quote_number").notNull().unique(), // QUO-1749156350551
  title: text("title").notNull(),
  description: text("description"),
  
  // Customer information
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  
  // Quote details
  projectType: text("project_type").notNull(), // e.g., "Landscape Design"
  location: text("location"), // e.g., "Outside backyard"
  
  // Financial
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0'),
  
  // Quote-level discounts
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default('0'),
  discountedSubtotal: decimal("discounted_subtotal", { precision: 10, scale: 2 }).notNull().default('0'),
  
  // Tax handling - can be rate-based or manual amount
  taxRate: decimal("tax_rate", { precision: 6, scale: 2 }).default('10.60'), // 10.60%
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  isManualTax: boolean("is_manual_tax").default(false), // true if tax amount is manually entered
  
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default('0'),
  
  // Payment schedule
  downPaymentPercentage: decimal("down_payment_percentage", { precision: 5, scale: 2 }).default('40.00'),
  milestonePaymentPercentage: decimal("milestone_payment_percentage", { precision: 5, scale: 2 }).default('40.00'),
  finalPaymentPercentage: decimal("final_payment_percentage", { precision: 5, scale: 2 }).default('20.00'),
  milestoneDescription: text("milestone_description"),
  
  // Dates
  estimatedStartDate: timestamp("estimated_start_date"),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  validUntil: timestamp("valid_until").notNull(),
  
  // Status and workflow
  status: text("status").notNull().default("draft"), // draft, sent, pending, accepted, declined, expired
  
  // Before/after images
  beforeImageUrl: text("before_image_url"),
  afterImageUrl: text("after_image_url"),
  beforeImageCaption: text("before_image_caption").default("Before"),
  afterImageCaption: text("after_image_caption").default("After"),
  
  // Magic link for customer access
  accessToken: text("access_token").notNull().unique(),
  
  // Notes and scope
  projectNotes: text("project_notes"),
  scopeDescription: text("scope_description"),
  
  // Tracking
  createdById: integer("created_by_id").notNull().references(() => users.id),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Leads table - Raw prospects before they become quotes
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").default("Unknown User").notNull(),
  contactInfo: text("contact_info"), // Email, phone, or profile URL
  source: leadSourceEnum("source").notNull().default("manual"),
  sourceUrl: text("source_url"), // Original post/page URL
  contentSnippet: text("content_snippet"), // Original message/post text
  interestTags: text("interest_tags").array(), // ["remodel", "seattle", "deck"]
  status: leadStatusEnum("status").default("new").notNull(),
  draftResponse: text("draft_response"), // AI's suggested reply
  confidenceScore: integer("confidence_score"), // 0-100 lead quality score
  location: text("location"), // City, state, or neighborhood
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  contactedAt: timestamp("contacted_at"),
  convertedToQuoteId: integer("converted_to_quote_id").references(() => quotes.id),
  notes: text("notes"), // Internal notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// Quote line items table
export const quoteLineItems = pgTable("quote_line_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  
  // Item details
  category: text("category").notNull(), // "Labor", "Materials", "Equipment"
  description: text("description").notNull(),
  
  // Pricing
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default('1'),
  unit: text("unit").default("each"), // each, sq ft, linear ft, hours
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  
  // Discount fields
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default('0'),
  
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  
  // Display order
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quote media table for additional images
export const quoteMedia = pgTable("quote_media", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull().default("image"), // image, video
  caption: text("caption"),
  category: text("category"), // "before", "after", "reference", "scope"
  sortOrder: integer("sort_order").default(0),
  
  uploadedById: integer("uploaded_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quote responses/actions table
export const quoteResponses = pgTable("quote_responses", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  
  action: text("action").notNull(), // "accepted", "declined", "requested_changes"
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  message: text("message"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quote access tokens table for secure customer access
export const quoteAccessTokens = pgTable("quote_access_tokens", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quote analytics table for tracking customer interactions
export const quoteAnalytics = pgTable("quote_analytics", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  
  // Event tracking
  event: text("event").notNull(), // "view", "section_view", "download", "response_click", "email_open"
  eventData: jsonb("event_data"), // Additional data specific to the event
  
  // Session tracking
  sessionId: text("session_id"), // Track user sessions
  
  // Device and browser info
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // "desktop", "mobile", "tablet"
  browser: text("browser"),
  operatingSystem: text("operating_system"),
  screenResolution: text("screen_resolution"),
  
  // Location and network
  ipAddress: text("ip_address"),
  country: text("country"),
  city: text("city"),
  timezone: text("timezone"),
  
  // Engagement metrics
  timeOnPage: integer("time_on_page"), // seconds
  scrollDepth: integer("scroll_depth"), // percentage
  
  // Referrer information
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quote view sessions for tracking quote access patterns
export const quoteViewSessions = pgTable("quote_view_sessions", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  sessionId: text("session_id").notNull(),
  
  // Session details
  startTime: timestamp("start_time").defaultNow().notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  totalDuration: integer("total_duration").default(0), // seconds
  pageViews: integer("page_views").default(1),
  
  // Device fingerprint
  deviceFingerprint: text("device_fingerprint"),
  
  // Engagement metrics
  maxScrollDepth: integer("max_scroll_depth").default(0),
  sectionsViewed: jsonb("sections_viewed"), // Array of section names viewed
  actionsPerformed: jsonb("actions_performed"), // Array of actions like clicks, downloads
  
  // Customer identification
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chat messages table for saving conversations
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

// Chat attachments table for file uploads in chat
export const chatAttachments = pgTable('chat_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(), // Size in bytes
  mimeType: text('mime_type').notNull(),
  storageKey: text('storage_key').notNull(), // R2 storage key
  url: text('url').notNull(), // Proxy URL to access the file
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

export type ChatAttachment = typeof chatAttachments.$inferSelect;
export type NewChatAttachment = typeof chatAttachments.$inferInsert;

// Conversation facts table for semantic memory with embeddings
export const conversationFacts = pgTable('conversation_facts', {
  // Primary Identity
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Fact Content
  factType: text('fact_type').notNull(), // 'task', 'decision', 'milestone', 'financial', 'schedule', 'material', 'risk', 'constraint'
  factContent: jsonb('fact_content').notNull(), // Structured data about the fact
  factSummary: text('fact_summary').notNull(), // Human-readable summary for semantic search

  // Embedding for semantic search
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI ada-002 dimensions

  // 1. LIFECYCLE & VERSIONING (Handling Change)
  isActive: boolean('is_active').notNull().default(true),
  supersededBy: integer('superseded_by').references((): any => conversationFacts.id, { onDelete: 'set null' }),
  validUntil: timestamp('valid_until', { withTimezone: true }), // For time-bound facts
  version: integer('version').notNull().default(1),

  // 2. TRUST & ATTRIBUTION (Quality Control)
  authorRole: text('author_role').notNull().$type<'user' | 'assistant' | 'system'>(), // user, assistant, system
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }), // 0.00 to 1.00
  verificationStatus: text('verification_status').notNull().default('pending_approval')
    .$type<'pending_approval' | 'verified' | 'rejected' | 'needs_review'>(),
  verifiedBy: integer('verified_by').references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  // 3. FINANCIAL METADATA (First-Class Citizen)
  financialAmount: decimal('financial_amount', { precision: 12, scale: 2 }), // Null if not a financial fact
  currency: text('currency').default('USD'),
  financialCategory: text('financial_category'), // Cost codes: 'Materials', 'Labor', '03-Concrete', '16-Electrical'
  financialType: text('financial_type').$type<'estimate' | 'quote' | 'change_order' | 'hard_cost' | 'invoice' | 'payment' | 'budget' | null>(),

  // 4. PRIORITY & ATTENTION
  priority: text('priority').notNull().default('normal').$type<'critical' | 'high' | 'normal' | 'low'>(),
  requiresAction: boolean('requires_action').notNull().default(false),
  actionDeadline: timestamp('action_deadline', { withTimezone: true }),

  // Metadata & Audit Trail
  sourceMessageId: text('source_message_id'), // Reference to original chat message
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ConversationFact = typeof conversationFacts.$inferSelect;
export type NewConversationFact = typeof conversationFacts.$inferInsert;

// --- RAG Relations ---
export const projectVersionRelations = relations(projectVersions, ({ one, many }) => ({
  project: one(projects, { fields: [projectVersions.projectId], references: [projects.id] }),
  ragTasks: many(ragTasks),
  generationPrompts: many(generationPrompts),
}));

export const ragTaskRelations = relations(ragTasks, ({ one, many }) => ({
  projectVersion: one(projectVersions, { fields: [ragTasks.projectVersionId], references: [projectVersions.id] }),
  predecessorDependencies: many(ragTaskDependencies, { relationName: 'Successor' }),
  successorDependencies: many(ragTaskDependencies, { relationName: 'Predecessor' }),
  feedback: many(taskFeedback),
}));

export const ragTaskDependencyRelations = relations(ragTaskDependencies, ({ one }) => ({
  task: one(ragTasks, { fields: [ragTaskDependencies.taskId], references: [ragTasks.id] }),
  dependsOnTask: one(ragTasks, { fields: [ragTaskDependencies.dependsOnTaskId], references: [ragTasks.id] }),
}));

export const generationPromptRelations = relations(generationPrompts, ({ one }) => ({
  projectVersion: one(projectVersions, { fields: [generationPrompts.projectVersionId], references: [projectVersions.id] }),
}));

export const taskFeedbackRelations = relations(taskFeedback, ({ one }) => ({
  task: one(ragTasks, { fields: [taskFeedback.taskId], references: [ragTasks.id] }),
  user: one(users, { fields: [taskFeedback.userId], references: [users.id] }),
}));

// --- Original Relations ---
export const projectRelations = relations(projects, ({ many, one }) => ({
  tasks: many(tasks),
  dailyLogs: many(dailyLogs),
  punchListItems: many(punchListItems),
  timeEntries: many(timeEntries),
  projectManager: one(users, {
      fields: [projects.projectManagerId],
      references: [users.id],
      relationName: 'ProjectManager',
  }),
  clientProjects: many(clientProjects),
  documents: many(documents),
  invoices: many(invoices),
  messages: many(messages),
  progressUpdates: many(progressUpdates),
  milestones: many(milestones),
  selections: many(selections),
  projectVersions: many(projectVersions),
  receipts: many(receipts),
}));

export const userRelations = relations(users, ({ many }) => ({
  assignedTasks: many(tasks, { relationName: 'Assignee' }),
  // createdTasks: many(tasks, { relationName: 'Creator' }), // Need creatorId in tasks if tracking
  createdDailyLogs: many(dailyLogs),
  uploadedDailyLogPhotos: many(dailyLogPhotos),
  createdPunchListItems: many(punchListItems),
  assignedPunchListItems: many(punchListItems, { relationName: 'PunchListAssignee' }),
  clientProjects: many(clientProjects),
  managedProjects: many(projects, { relationName: 'ProjectManager' }),
  uploadedDocuments: many(documents),
  sentMessages: many(messages, { relationName: 'Sender' }),
  receivedMessages: many(messages, { relationName: 'Recipient' }),
  createdProgressUpdates: many(progressUpdates),
  uploadedUpdateMedia: many(updateMedia),
  taskFeedback: many(taskFeedback),
  createdQuotes: many(quotes),
  uploadedQuoteMedia: many(quoteMedia),
  timeEntries: many(timeEntries),
  uploadedReceipts: many(receipts, { relationName: 'Uploader' }),
  verifiedReceipts: many(receipts, { relationName: 'Verifier' }),
  interviewSessions: many(interviewSessions),
}));

export const clientProjectRelations = relations(clientProjects, ({ one }) => ({
    client: one(users, { fields: [clientProjects.clientId], references: [users.id] }),
    project: one(projects, { fields: [clientProjects.projectId], references: [projects.id] }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
    project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
    uploader: one(users, { fields: [documents.uploadedById], references: [users.id] }),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
    project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
    document: one(documents, { fields: [invoices.documentId], references: [documents.id] }),
    payments: many(payments),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
    invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const messageRelations = relations(messages, ({ one }) => ({
    project: one(projects, { fields: [messages.projectId], references: [projects.id] }),
    sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: 'Sender' }),
    recipient: one(users, { fields: [messages.recipientId], references: [users.id], relationName: 'Recipient' }),
}));

export const progressUpdateRelations = relations(progressUpdates, ({ one, many }) => ({
  project: one(projects, { fields: [progressUpdates.projectId], references: [projects.id] }),
  creator: one(users, { fields: [progressUpdates.createdById], references: [users.id] }),
  media: many(updateMedia),
}));

export const updateMediaRelations = relations(updateMedia, ({ one }) => ({
  update: one(progressUpdates, { fields: [updateMedia.updateId], references: [progressUpdates.id] }),
  punchListItem: one(punchListItems, { fields: [updateMedia.punchListItemId], references: [punchListItems.id] }),
  uploader: one(users, { fields: [updateMedia.uploadedById], references: [users.id] }),
}));

export const milestoneRelations = relations(milestones, ({ one }) => ({
    project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
    completedBy: one(users, { fields: [milestones.completedById], references: [users.id] }),
    invoice: one(invoices, { fields: [milestones.invoiceId], references: [invoices.id] }),
}));

export const selectionRelations = relations(selections, ({ one }) => ({
    project: one(projects, { fields: [selections.projectId], references: [projects.id] }),
}));

export const taskRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id], relationName: 'Assignee' }),
  predecessorDependencies: many(taskDependencies, { relationName: 'Successor' }),
  successorDependencies: many(taskDependencies, { relationName: 'Predecessor' }),
}));

export const taskDependencyRelations = relations(taskDependencies, ({ one }) => ({
  predecessor: one(tasks, { fields: [taskDependencies.predecessorId], references: [tasks.id], relationName: 'Predecessor' }),
  successor: one(tasks, { fields: [taskDependencies.successorId], references: [tasks.id], relationName: 'Successor' }),
}));

export const dailyLogRelations = relations(dailyLogs, ({ one, many }) => ({
  project: one(projects, { fields: [dailyLogs.projectId], references: [projects.id] }),
  creator: one(users, { fields: [dailyLogs.createdById], references: [users.id] }),
  photos: many(dailyLogPhotos),
}));

export const dailyLogPhotoRelations = relations(dailyLogPhotos, ({ one }) => ({
  dailyLog: one(dailyLogs, { fields: [dailyLogPhotos.dailyLogId], references: [dailyLogs.id] }),
  uploader: one(users, { fields: [dailyLogPhotos.uploadedById], references: [users.id] }),
}));

export const punchListItemRelations = relations(punchListItems, ({ one, many }) => ({
  project: one(projects, { fields: [punchListItems.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [punchListItems.assigneeId], references: [users.id], relationName: 'PunchListAssignee' }),
  creator: one(users, { fields: [punchListItems.createdById], references: [users.id] }),
  media: many(updateMedia),
}));

// Quote relations
export const quoteRelations = relations(quotes, ({ many }) => ({
  lineItems: many(quoteLineItems),
  media: many(quoteMedia),
  responses: many(quoteResponses),
  accessTokens: many(quoteAccessTokens),
  analytics: many(quoteAnalytics),
  viewSessions: many(quoteViewSessions),
}));

export const quoteLineItemRelations = relations(quoteLineItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLineItems.quoteId], references: [quotes.id] }),
}));

export const quoteMediaRelations = relations(quoteMedia, ({ one }) => ({
  quote: one(quotes, { fields: [quoteMedia.quoteId], references: [quotes.id] }),
  uploader: one(users, { fields: [quoteMedia.uploadedById], references: [users.id] }),
}));

export const quoteResponseRelations = relations(quoteResponses, ({ one }) => ({
  quote: one(quotes, { fields: [quoteResponses.quoteId], references: [quotes.id] }),
}));

export const quoteAccessTokenRelations = relations(quoteAccessTokens, ({ one }) => ({
  quote: one(quotes, { fields: [quoteAccessTokens.quoteId], references: [quotes.id] }),
}));

export const quoteAnalyticsRelations = relations(quoteAnalytics, ({ one }) => ({
  quote: one(quotes, { fields: [quoteAnalytics.quoteId], references: [quotes.id] }),
}));

export const quoteViewSessionRelations = relations(quoteViewSessions, ({ one }) => ({
  quote: one(quotes, { fields: [quoteViewSessions.quoteId], references: [quotes.id] }),
}));

// Time Entry relations
export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
  project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] }),
}));

// Receipt relations
export const receiptsRelations = relations(receipts, ({ one }) => ({
  project: one(projects, { fields: [receipts.projectId], references: [projects.id] }),
  uploader: one(users, { fields: [receipts.uploadedBy], references: [users.id], relationName: 'Uploader' }),
  verifier: one(users, { fields: [receipts.verifiedBy], references: [users.id], relationName: 'Verifier' }),
}));

// Lead relations
export const leadsRelations = relations(leads, ({ one }) => ({
  convertedToQuote: one(quotes, {
    fields: [leads.convertedToQuoteId],
    references: [quotes.id],
  }),
}));

// Interview sessions relations
export const interviewSessionRelations = relations(interviewSessions, ({ one }) => ({
  user: one(users, {
    fields: [interviewSessions.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [interviewSessions.leadId],
    references: [leads.id],
  }),
}));

// --- Insert Schemas (with Zod validations) ---

// Chat messages insert schema
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  embedding: true,
});

// Interview sessions insert schema
export const insertInterviewSessionSchema = createInsertSchema(interviewSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

// Create insert schemas for each table
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertProjectSchema = createInsertSchema(projects)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true
  })
  .extend({
    startDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    estimatedCompletionDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    actualCompletionDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    totalBudget: z.union([
      z.string().transform(val => parseFloat(val.replace(/[^0-9.]/g, ''))).refine(n => !isNaN(n) && n > 0, { message: "Budget must be a positive number" }),
      z.number().min(1, "Budget must be a positive number")
    ]),
    longitude: z.string().optional().nullable().refine(
      val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= -180 && parseFloat(val) <= 180),
      { message: "Longitude must be between -180 and 180" }
    ),
    latitude: z.string().optional().nullable().refine(
      val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= -90 && parseFloat(val) <= 90),
      { message: "Latitude must be between -90 and 90" }
    ),
    clientIds: z.array(z.number()).optional(),
  });

export const insertClientProjectSchema = createInsertSchema(clientProjects).omit({
  id: true,
  createdAt: true
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true
});

export const insertProgressUpdateSchema = createInsertSchema(progressUpdates).omit({
  id: true,
  createdAt: true
});

export const insertUpdateMediaSchema = createInsertSchema(updateMedia).omit({
  id: true,
  createdAt: true
}).extend({
  updateId: z.number().optional().nullable(),
  punchListItemId: z.number().optional().nullable(),
});


export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  billedAt: true
}).extend({
  plannedDate: z.union([z.string().datetime(), z.date()]),
  billingPercentage: z.union([
    z.string().transform(val => parseFloat(val.replace(/[^0-9.]/g, ''))).refine(n => !isNaN(n) && n >= 0 && n <= 100, { message: "Billing percentage must be between 0 and 100" }),
    z.number().min(0).max(100, "Billing percentage must be between 0 and 100")
  ]).optional(),
});

// Update schema for milestones with completion and billing fields
export const updateMilestoneSchema = insertMilestoneSchema.partial().extend({
  completedAt: z.date().optional(),
  billedAt: z.date().optional(),
  invoiceId: z.number().optional(),
  completedById: z.number().optional(),
});

export const insertSelectionSchema = createInsertSchema(selections).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// --- MODIFIED Task Insert Schema ---
const baseTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  billedAt: true,
  milestoneId: true, // This will be set programmatically
}).extend({
    // Allow strings for ISO dates
    startDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    dueDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    // Allow estimatedHours and actualHours to be either number or string
    estimatedHours: z.union([
        z.number().positive("Estimated hours must be positive").optional().nullable(),
        // Allow string, attempt parse, check if result is number
        z.string().refine((val) => val === "" || val === null || !isNaN(parseFloat(val)), {
            message: "Estimated hours must be a valid number"
        }).transform(val => val === "" || val === null ? null : parseFloat(val)).optional().nullable() // transform valid string to number
    ]),
    actualHours: z.union([
        z.number().positive("Actual hours must be positive").optional().nullable(),
        // Allow string, attempt parse, check if result is number
        z.string().refine((val) => val === "" || val === null || !isNaN(parseFloat(val)), {
            message: "Actual hours must be a valid number"
        }).transform(val => val === "" || val === null ? null : parseFloat(val)).optional().nullable() // transform valid string to number
    ]),
    // Billing fields
    billableAmount: z.union([
        z.string().transform(val => parseFloat(val.replace(/[^0-9.]/g, ''))).refine(n => !isNaN(n) && n >= 0, { message: "Billable amount must be a positive number" }),
        z.number().min(0, "Billable amount must be a positive number")
    ]).optional(),
    billingRate: z.union([
        z.string().transform(val => parseFloat(val.replace(/[^0-9.]/g, ''))).refine(n => !isNaN(n) && n >= 0, { message: "Billing rate must be a positive number" }),
        z.number().min(0, "Billing rate must be a positive number")
    ]).optional(),
    billingPercentage: z.union([
        z.string().transform(val => parseFloat(val.replace(/[^0-9.]/g, ''))).refine(n => !isNaN(n) && n >= 0 && n <= 100, { message: "Billing percentage must be between 0 and 100" }),
        z.number().min(0).max(100, "Billing percentage must be between 0 and 100")
    ]).optional(),
    // Ensure progress is within 0-100
    progress: z.number().int().min(0).max(100).default(0).optional(), // Adding optional if you don't always provide it
});

export const insertTaskSchema = baseTaskSchema.refine((data) => {
    // Custom validation: start date should not be after due date
    if (data.startDate && data.dueDate) {
        const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
        const dueDate = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
        return startDate <= dueDate;
    }
    return true; // If either date is missing, skip validation
}, {
    message: "Start date cannot be after due date",
    path: ["startDate"], // Show error on startDate field
});

// Update schema for tasks with completion and billing fields
export const updateTaskSchema = baseTaskSchema.partial().extend({
  completedAt: z.date().optional(),
  billedAt: z.date().optional(),
  milestoneId: z.number().optional(),
  notes: z.string().optional(),
});
// --- END MODIFIED Task Insert Schema ---

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});

export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({
  id: true,
  createdAt: true,
}).extend({
    logDate: z.union([z.string().datetime(), z.date()]), // Make required
    // Allow temperature to be number or string, transform string to number
    temperature: z.union([
        z.number().optional().nullable(),
        z.string().refine((val) => val === "" || val === null || !isNaN(parseFloat(val)), {
             message: "Temperature must be a valid number"
        }).transform(val => val === "" || val === null ? null : parseFloat(val)).optional().nullable()
    ]),
});

// Admin images schemas
export const insertAdminImageSchema = createInsertSchema(adminImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAdminImageSchema = insertAdminImageSchema.partial();

// Types for admin images
export type AdminImage = typeof adminImages.$inferSelect;
export type InsertAdminImage = z.infer<typeof insertAdminImageSchema>;
export type UpdateAdminImage = z.infer<typeof updateAdminImageSchema>;

// Design proposals schemas
export const insertDesignProposalSchema = createInsertSchema(designProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  accessToken: true, // Generated automatically
  createdById: true, // Set from authenticated user
});

export const insertBeforeAfterComparisonSchema = createInsertSchema(beforeAfterComparisons).omit({
  id: true,
  createdAt: true,
});

// Gallery image schemas
export const insertProposalGalleryImageSchema = createInsertSchema(proposalGalleryImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalImageCommentSchema = createInsertSchema(proposalImageComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalImageFavoriteSchema = createInsertSchema(proposalImageFavorites).omit({
  id: true,
  createdAt: true,
});

// Types for design proposals
export type DesignProposal = typeof designProposals.$inferSelect;
export type InsertDesignProposal = z.infer<typeof insertDesignProposalSchema>;
export type BeforeAfterComparison = typeof beforeAfterComparisons.$inferSelect;
export type InsertBeforeAfterComparison = z.infer<typeof insertBeforeAfterComparisonSchema>;

// Gallery types
export type ProposalGalleryImage = typeof proposalGalleryImages.$inferSelect;
export type InsertProposalGalleryImage = z.infer<typeof insertProposalGalleryImageSchema>;
export type ProposalImageComment = typeof proposalImageComments.$inferSelect;
export type InsertProposalImageComment = z.infer<typeof insertProposalImageCommentSchema>;
export type ProposalImageFavorite = typeof proposalImageFavorites.$inferSelect;
export type InsertProposalImageFavorite = z.infer<typeof insertProposalImageFavoriteSchema>;

// Gallery image with comments and favorites
export type ProposalGalleryImageWithDetails = ProposalGalleryImage & {
  comments: ProposalImageComment[];
  favorites: ProposalImageFavorite[];
  isFavorite?: boolean;
  commentCount?: number;
  favoriteCount?: number;
};

export type DesignProposalWithComparisons = DesignProposal & {
  comparisons: BeforeAfterComparison[];
};

export type DesignProposalWithGallery = DesignProposalWithComparisons & {
  galleryImages: ProposalGalleryImageWithDetails[];
};

export const insertDailyLogPhotoSchema = createInsertSchema(dailyLogPhotos).omit({
  id: true,
  createdAt: true,
});

export const insertPunchListItemSchema = createInsertSchema(punchListItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true, // Usually set when status changes
}).extend({
  dueDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
});

// --- RAG Insert Schemas ---
export const insertProjectVersionSchema = createInsertSchema(projectVersions).omit({
  id: true,
  createdAt: true,
});

export const insertGenerationPromptSchema = createInsertSchema(generationPrompts).omit({
  id: true,
  createdAt: true,
});

export const insertRagTaskSchema = createInsertSchema(ragTasks).omit({
  id: true,
  createdAt: true,
  isGenerated: true, // This has a default value
});

export const insertRagTaskDependencySchema = createInsertSchema(ragTaskDependencies).omit({
  id: true,
});

export const insertTaskFeedbackSchema = createInsertSchema(taskFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertTaskChunkSchema = createInsertSchema(taskChunks).omit({
  id: true,
  createdAt: true,
});



// --- Export Types ---
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertClientProject = z.infer<typeof insertClientProjectSchema>;
export type ClientProject = typeof clientProjects.$inferSelect;

// --- RAG Export Types ---
export type InsertProjectVersion = z.infer<typeof insertProjectVersionSchema>;
export type ProjectVersion = typeof projectVersions.$inferSelect;

export type InsertGenerationPrompt = z.infer<typeof insertGenerationPromptSchema>;
export type GenerationPrompt = typeof generationPrompts.$inferSelect;

export type InsertRagTask = z.infer<typeof insertRagTaskSchema>;
export type RagTask = typeof ragTasks.$inferSelect;

export type InsertRagTaskDependency = z.infer<typeof insertRagTaskDependencySchema>;
export type RagTaskDependency = typeof ragTaskDependencies.$inferSelect;

export type InsertTaskFeedback = z.infer<typeof insertTaskFeedbackSchema>;
export type TaskFeedback = typeof taskFeedback.$inferSelect;

export type InsertTaskChunk = z.infer<typeof insertTaskChunkSchema>;
export type TaskChunk = typeof taskChunks.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertProgressUpdate = z.infer<typeof insertProgressUpdateSchema>;
export type ProgressUpdate = typeof progressUpdates.$inferSelect;

export type InsertUpdateMedia = z.infer<typeof insertUpdateMediaSchema>;
export type UpdateMedia = typeof updateMedia.$inferSelect;

export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type UpdateMilestone = z.infer<typeof updateMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

export type InsertSelection = z.infer<typeof insertSelectionSchema>;
export type Selection = typeof selections.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

export type InsertDailyLogPhoto = z.infer<typeof insertDailyLogPhotoSchema>;
export type DailyLogPhoto = typeof dailyLogPhotos.$inferSelect;

export type InsertPunchListItem = z.infer<typeof insertPunchListItemSchema>;
export type PunchListItem = typeof punchListItems.$inferSelect;

// --- Quote Insert Schemas ---
export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  accessToken: true, // Generated automatically
}).extend({
  validUntil: z.union([z.string().datetime(), z.date()]),
  estimatedStartDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  estimatedCompletionDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
});

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  quantity: z.union([z.number(), z.string().transform(val => parseFloat(val))]).default(1),
  unitPrice: z.union([z.string(), z.number().transform(val => val.toString())]),
  totalPrice: z.union([z.string(), z.number().transform(val => val.toString())]),
  discountPercentage: z.union([z.number(), z.string().transform(val => parseFloat(val))]).default(0).optional(),
  discountAmount: z.union([z.string(), z.number().transform(val => val.toString())]).default('0').optional(),
});

export const insertQuoteMediaSchema = createInsertSchema(quoteMedia).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteResponseSchema = createInsertSchema(quoteResponses).omit({
  id: true,
  createdAt: true,
});

// --- Quote Types ---
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;

export type InsertQuoteMedia = z.infer<typeof insertQuoteMediaSchema>;
export type QuoteMedia = typeof quoteMedia.$inferSelect;

export type InsertQuoteResponse = z.infer<typeof insertQuoteResponseSchema>;
export type QuoteResponse = typeof quoteResponses.$inferSelect;

// --- Export Combined Types ---
export type DailyLogWithDetails = DailyLog & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    photos?: DailyLogPhoto[];
};
export type TaskWithAssignee = Task & { assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null };
export type PunchListItemWithDetails = PunchListItem & {
    assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    media?: UpdateMedia[];
};
export type ProjectWithDetails = Project & {
    projectManager?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    clients?: Pick<User, 'id' | 'firstName' | 'lastName'>[]; // Assuming clients are fetched separately and merged
};
export type DocumentWithUploader = Document & {
    uploader?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

// --- Quote Combined Types ---
export type QuoteWithDetails = Quote & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    lineItems?: QuoteLineItem[];
    media?: QuoteMedia[];
    responses?: QuoteResponse[];
};

export type QuoteLineItemWithDetails = QuoteLineItem & {
    quote?: Pick<Quote, 'id' | 'quoteNumber' | 'title'> | null;
};
