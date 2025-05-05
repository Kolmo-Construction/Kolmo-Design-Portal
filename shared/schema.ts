// shared/schema.ts

import { pgTable, text, serial, integer, decimal, timestamp, boolean, jsonb, foreignKey, pgEnum, uuid as pgUuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Define project statuses enum
export const projectStatusEnum = pgEnum('project_status', ['draft', 'finalized', 'archived']);

// Define feedback types enum
export const feedbackTypeEnum = pgEnum('feedback_type', ['edit', 'approve', 'reject']);

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
  role: text("role").notNull().default("client"), // client, admin, projectManager
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  magicLinkToken: text("magic_link_token").unique(),
  magicLinkExpiry: timestamp("magic_link_expiry"),
  isActivated: boolean("is_activated").default(false).notNull(),
});

// Projects table for storing project details
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  startDate: timestamp("start_date"),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  status: text("status").notNull().default("planning"), // planning, in_progress, on_hold, completed
  totalBudget: decimal("total_budget", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  progress: integer("progress").default(0), // Percentage complete (0-100)
  projectManagerId: integer("project_manager_id").references(() => users.id),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Invoices table for financial tracking
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  invoiceNumber: text("invoice_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("pending"), // pending, paid, overdue
  documentId: integer("document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payments table for tracking payments against invoices
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  updateType: text("update_type").notNull(), // milestone, photo, issue, general
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Update media (photos/videos) connected to progress updates OR punch list items
export const updateMedia = pgTable("update_media", {
  id: serial("id").primaryKey(),
  updateId: integer("update_id").references(() => progressUpdates.id),
  punchListItemId: integer("punch_list_item_id").references(() => punchListItems.id),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(), // image, video
  caption: text("caption"),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Milestones for project timeline
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  plannedDate: timestamp("planned_date").notNull(),
  actualDate: timestamp("actual_date"),
  status: text("status").notNull().default("pending"), // pending, completed, delayed
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  // progress field was removed since it doesn't exist in the database
  publishedAt: timestamp("published_at"), // When the task was published to clients (null = not published)
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
});

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


// --- Insert Schemas (with Zod validations) ---

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
  createdAt: true
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true
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
  createdAt: true
});

export const insertSelectionSchema = createInsertSchema(selections).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// --- MODIFIED Task Insert Schema ---
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
    // Ensure progress is within 0-100
    progress: z.number().int().min(0).max(100).default(0).optional(), // Adding optional if you don't always provide it
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

// --- Export Types ---
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertClientProject = z.infer<typeof insertClientProjectSchema>;
export type ClientProject = typeof clientProjects.$inferSelect;

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

// RAG System Types
export type ProjectVersion = typeof projectVersions.$inferSelect;
export type RagTask = typeof ragTasks.$inferSelect;
export type RagTaskDependency = typeof ragTaskDependencies.$inferSelect;
export type TaskChunk = typeof taskChunks.$inferSelect;
export type GenerationPrompt = typeof generationPrompts.$inferSelect;
export type TaskFeedback = typeof taskFeedback.$inferSelect;

// Create insert schemas for the RAG system
export const insertProjectVersionSchema = createInsertSchema(projectVersions).omit({
  id: true,
  createdAt: true,
});

export const insertRagTaskSchema = createInsertSchema(ragTasks).omit({
  id: true,
  createdAt: true,
});

export const insertRagTaskDependencySchema = createInsertSchema(ragTaskDependencies).omit({
  id: true,
});

export const insertTaskChunkSchema = createInsertSchema(taskChunks).omit({
  id: true,
  createdAt: true,
});

export const insertGenerationPromptSchema = createInsertSchema(generationPrompts).omit({
  id: true,
  createdAt: true,
});

export const insertTaskFeedbackSchema = createInsertSchema(taskFeedback).omit({
  id: true,
  createdAt: true,
});

export type InsertProjectVersion = z.infer<typeof insertProjectVersionSchema>;
export type InsertRagTask = z.infer<typeof insertRagTaskSchema>;
export type InsertRagTaskDependency = z.infer<typeof insertRagTaskDependencySchema>;
export type InsertTaskChunk = z.infer<typeof insertTaskChunkSchema>;
export type InsertGenerationPrompt = z.infer<typeof insertGenerationPromptSchema>;
export type InsertTaskFeedback = z.infer<typeof insertTaskFeedbackSchema>;

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