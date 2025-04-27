import { pgTable, text, serial, integer, decimal, timestamp, boolean, jsonb, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";


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

// Update media (photos/videos) connected to progress updates
export const updateMedia = pgTable("update_media", {
  id: serial("id").primaryKey(),
  updateId: integer("update_id").notNull().references(() => progressUpdates.id),
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
  estimatedHours: decimal("estimated_hours", { precision: 5, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 5, scale: 2 }),
  progress: integer("progress").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Task dependencies table (many-to-many relationship on tasks)
export const taskDependencies = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  predecessorId: integer("predecessor_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  successorId: integer("successor_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  type: text("type").default("FS"), // FS (Finish-to-Start), SS, FF, SF
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily Logs table for field reporting
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

// Daily Log Photos (one-to-many relationship with dailyLogs)
export const dailyLogPhotos = pgTable("daily_log_photos", {
  id: serial("id").primaryKey(),
  dailyLogId: integer("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: 'cascade' }),
  photoUrl: text("photo_url").notNull(), // URL from R2
  caption: text("caption"),
  uploadedById: integer("uploaded_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Punch List Items table
export const punchListItems = pgTable("punch_list_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  location: text("location"), // e.g., "Kitchen", "Master Bath"
  status: text("status").notNull().default("open"), // open, in_progress, resolved, verified
  priority: text("priority").default("medium"), // low, medium, high
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp("due_date"),
  photoUrl: text("photo_url"), // Optional photo URL from R2
  createdById: integer("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
export const projectRelations = relations(projects, ({ many, one }) => ({
  tasks: many(tasks),
  dailyLogs: many(dailyLogs),
  punchListItems: many(punchListItems),
  projectManager: one(users, {
      fields: [projects.projectManagerId],
      references: [users.id],
      relationName: 'ProjectManager', // Added relation name if needed
  }),
  clientProjects: many(clientProjects),
  documents: many(documents),
  invoices: many(invoices),
  messages: many(messages),
  progressUpdates: many(progressUpdates),
  milestones: many(milestones),
  selections: many(selections),
}));

export const userRelations = relations(users, ({ many }) => ({
  assignedTasks: many(tasks, { relationName: 'Assignee' }),
  createdTasks: many(tasks, { relationName: 'Creator' }), // Need creatorId in tasks if tracking
  createdDailyLogs: many(dailyLogs),
  uploadedDailyLogPhotos: many(dailyLogPhotos),
  createdPunchListItems: many(punchListItems),
  assignedPunchListItems: many(punchListItems, { relationName: 'PunchListAssignee' }),
  clientProjects: many(clientProjects), // Added relation for clients' projects
  managedProjects: many(projects, { relationName: 'ProjectManager' }), // Added relation for PMs' projects
  uploadedDocuments: many(documents),
  sentMessages: many(messages, { relationName: 'Sender' }),
  receivedMessages: many(messages, { relationName: 'Recipient' }),
  createdProgressUpdates: many(progressUpdates),
  uploadedUpdateMedia: many(updateMedia),
}));

// Add missing relation for progress updates
export const progressUpdateRelations = relations(progressUpdates, ({ one, many }) => ({
  project: one(projects, { fields: [progressUpdates.projectId], references: [projects.id] }),
  creator: one(users, { fields: [progressUpdates.createdById], references: [users.id] }),
  media: many(updateMedia),
}));

// Add missing relation for update media
export const updateMediaRelations = relations(updateMedia, ({ one }) => ({
  update: one(progressUpdates, { fields: [updateMedia.updateId], references: [progressUpdates.id] }),
  uploader: one(users, { fields: [updateMedia.uploadedById], references: [users.id] }),
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

export const punchListItemRelations = relations(punchListItems, ({ one }) => ({
  project: one(projects, { fields: [punchListItems.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [punchListItems.assigneeId], references: [users.id], relationName: 'PunchListAssignee' }),
  creator: one(users, { fields: [punchListItems.createdById], references: [users.id] }),
}));

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
    // Allow strings for ISO dates to be converted to Date objects
    startDate: z.union([z.string().datetime(), z.date()]).optional().nullable(), // Allow nullable for optional dates
    estimatedCompletionDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    actualCompletionDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    // Allow numbers or strings for budget to handle different formats
    totalBudget: z.union([
      z.string().transform(val => parseFloat(val.replace(/[^0-9.]/g, ''))).refine(n => !isNaN(n) && n > 0, { message: "Budget must be a positive number" }),
      z.number().min(1, "Budget must be a positive number")
    ]),
    // --- NEW: Add clientIds for frontend validation ---
    clientIds: z.array(z.number()).optional(),
    // --- END NEW ---
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


// Export types for use in the application
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
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
    // Allow strings for ISO dates
    startDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
    dueDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type TaskDependency = typeof taskDependencies.$inferSelect;

export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({
  id: true,
  createdAt: true,
}).extend({
    // Allow strings for ISO dates
    logDate: z.union([z.string().datetime(), z.date()]), // Make required
    temperature: z.union([z.number(), z.string(), z.null()]).optional().transform(val => 
      val === null || val === undefined || val === '' ? null :
      typeof val === 'string' ? parseFloat(val) : val
    ),
});
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

export const insertDailyLogPhotoSchema = createInsertSchema(dailyLogPhotos).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyLogPhoto = z.infer<typeof insertDailyLogPhotoSchema>;
export type DailyLogPhoto = typeof dailyLogPhotos.$inferSelect;

export const insertPunchListItemSchema = createInsertSchema(punchListItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true, // Usually set when status changes
}).extend({
  // Allow strings for ISO dates
  dueDate: z.union([z.string().datetime(), z.date()]).optional().nullable(),
});
export type InsertPunchListItem = z.infer<typeof insertPunchListItemSchema>;
export type PunchListItem = typeof punchListItems.$inferSelect;

// You might want to export combined types too, e.g.,
export type DailyLogWithPhotos = DailyLog & { photos: DailyLogPhoto[] };
export type TaskWithAssignee = Task & { assignee: User | null }; // Assuming User type exists
export type PunchListItemWithAssignee = PunchListItem & { assignee: User | null };