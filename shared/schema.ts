import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    text,
    timestamp,
    boolean,
    uuid,
    primaryKey,
    decimal,
    date,
    integer,
    pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'project_manager', 'client']);
export const projectStatusEnum = pgEnum('project_status', ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled']);
export const taskStatusEnum = pgEnum('task_status', ['To Do', 'In Progress', 'Blocked', 'In Review', 'Done']);
export const documentTypeEnum = pgEnum('document_type', ['Contract', 'Blueprint', 'Permit', 'Invoice', 'Report', 'Change Order', 'Other']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['Draft', 'Sent', 'Paid', 'Overdue', 'Void']);
export const paymentMethodEnum = pgEnum('payment_method', ['Credit Card', 'Bank Transfer', 'Check', 'Cash', 'Other']);
export const messageTypeEnum = pgEnum('message_type', ['General', 'Update', 'Query', 'Alert']);
export const updateTypeEnum = pgEnum('update_type', ['Progress', 'Milestone', 'Selection']);
export const mediaTypeEnum = pgEnum('media_type', ['Image', 'Video', 'Document']);
export const punchListItemStatusEnum = pgEnum('punch_list_item_status', ['Open', 'In Progress', 'Resolved', 'Closed']);


// Users Table
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').unique().notNull(),
    hashedPassword: text('hashed_password'),
    fullName: text('full_name'),
    role: userRoleEnum('role').notNull().default('client'),
    isVerified: boolean('is_verified').default(false).notNull(),
    verificationToken: text('verification_token'),
    verificationTokenExpiresAt: timestamp('verification_token_expires_at', { withTimezone: true }),
    passwordResetToken: text('password_reset_token'),
    passwordResetTokenExpiresAt: timestamp('password_reset_token_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    profileSetupComplete: boolean('profile_setup_complete').default(false).notNull(),
});

// Projects Table
export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    address: text('address'),
    description: text('description'),
    status: projectStatusEnum('status').default('Planning').notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    budget: decimal('budget', { precision: 12, scale: 2 }),
    // --- FOREIGN KEYS / RELATION IDS ---
    projectManagerId: uuid('project_manager_id').references(() => users.id, { onDelete: 'set null' }),
    clientIds: uuid('client_ids').array(), // Array of user IDs with 'client' role
    // --- END FOREIGN KEYS ---
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Documents Table
export const documents = pgTable('documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    fileKey: text('file_key').notNull().unique(), // R2 object key
    fileUrl: text('file_url'), // Optional public URL or use signed URLs
    fileType: text('file_type'), // e.g., 'application/pdf'
    fileSize: integer('file_size'), // size in bytes
    documentType: documentTypeEnum('document_type').default('Other'),
    version: integer('version').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tasks Table
export const tasks = pgTable('tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: taskStatusEnum('status').default('To Do').notNull(),
    priority: integer('priority').default(0), // 0: Low, 1: Medium, 2: High
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    estimatedDuration: integer('estimated_duration'), // In days or hours
    actualDuration: integer('actual_duration'),
    progress: integer('progress').default(0), // Percentage 0-100
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Task Dependencies Table (Many-to-Many)
export const taskDependencies = pgTable('task_dependencies', {
    taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    dependsOnTaskId: uuid('depends_on_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    // type: text('type'), // e.g., 'Finish-to-Start', 'Start-to-Start' - Add if needed
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    };
});

// Invoices Table
export const invoices = pgTable('invoices', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    invoiceNumber: text('invoice_number').unique().notNull(),
    status: invoiceStatusEnum('status').default('Draft').notNull(),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date'),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0.00'),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payments Table
export const payments = pgTable('payments', {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
    paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow().notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method'),
    transactionId: text('transaction_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Messages Table
export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'set null' }), // Can be null for project-wide messages
    content: text('content').notNull(),
    messageType: messageTypeEnum('message_type').default('General'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // parentMessageId: uuid('parent_message_id').references(() => messages.id), // For threading if needed
});

// Progress Updates Table
export const progressUpdates = pgTable('progress_updates', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'set null' }),
    updateDate: timestamp('update_date', { withTimezone: true }).defaultNow().notNull(),
    title: text('title'),
    description: text('description').notNull(),
    updateType: updateTypeEnum('update_type').default('Progress'),
    // relatedTaskId: uuid('related_task_id').references(() => tasks.id), // Optional link to a specific task
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Media Table (for photos, videos, documents attached to updates, logs, punch lists)
export const media = pgTable('media', {
    id: uuid('id').defaultRandom().primaryKey(),
    // Link to parent record (polymorphic - choose one or add separate linking tables)
    progressUpdateId: uuid('progress_update_id').references(() => progressUpdates.id, { onDelete: 'cascade' }),
    dailyLogId: uuid('daily_log_id').references(() => dailyLogs.id, { onDelete: 'cascade' }),
    punchListItemId: uuid('punch_list_item_id').references(() => punchListItems.id, { onDelete: 'cascade' }),
    // ---
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    fileKey: text('file_key').notNull().unique(), // R2 object key
    fileName: text('file_name'),
    fileUrl: text('file_url'),
    fileType: text('file_type'), // e.g., 'image/jpeg'
    fileSize: integer('file_size'), // size in bytes
    mediaType: mediaTypeEnum('media_type').default('Image'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Daily Logs Table
export const dailyLogs = pgTable('daily_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull().default(sql`CURRENT_DATE`),
    createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'set null' }),
    weather: text('weather'),
    temperature: decimal('temperature', { precision: 5, scale: 2 }), // Celsius or Fahrenheit
    personnelCount: integer('personnel_count'),
    workPerformed: text('work_performed').notNull(),
    materialsDelivered: text('materials_delivered'),
    delaysOrIssues: text('delays_or_issues'),
    safetyObservations: text('safety_observations'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Punch List Items Table
export const punchListItems = pgTable('punch_list_items', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    itemNumber: text('item_number'), // Or use sequence/autoincrement if DB supports it easily
    description: text('description').notNull(),
    location: text('location'),
    status: punchListItemStatusEnum('status').default('Open').notNull(),
    priority: integer('priority').default(0), // 0: Low, 1: Medium, 2: High
    createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'set null' }),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    dueDate: date('due_date'),
    dateCompleted: date('date_completed'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Milestones Table (Simplified, could be part of Tasks or Progress Updates)
export const milestones = pgTable('milestones', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    targetDate: date('target_date'),
    completionDate: date('completion_date'),
    status: text('status'), // e.g., 'Upcoming', 'Achieved', 'Delayed'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Selections Table (Client choices, e.g., materials, finishes)
export const selections = pgTable('selections', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g., "Kitchen Countertop"
    description: text('description'),
    status: text('status'), // e.g., 'Pending', 'Approved', 'Ordered'
    category: text('category'), // e.g., 'Finishes', 'Fixtures'
    options: text('options'), // Description of choices offered
    clientChoice: text('client_choice'), // What the client selected
    decisionDeadline: date('decision_deadline'),
    dateApproved: date('date_approved'),
    supplier: text('supplier'),
    costEstimate: decimal('cost_estimate', { precision: 10, scale: 2 }),
    actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});


// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
    managedProjects: many(projects, { relationName: 'projectManager' }), // Projects where user is PM
    clientProjects: many(projects, { relationName: 'clients' }),       // Projects where user is Client (Needs custom query due to array)
    createdTasks: many(tasks, { relationName: 'createdBy' }),
    assignedTasks: many(tasks, { relationName: 'assignedTo' }),
    sentMessages: many(messages, { relationName: 'sender' }),
    receivedMessages: many(messages, { relationName: 'recipient' }),
    uploadedDocuments: many(documents),
    createdProgressUpdates: many(progressUpdates),
    uploadedMedia: many(media),
    createdDailyLogs: many(dailyLogs),
    createdPunchListItems: many(punchListItems, { relationName: 'createdPunchItems' }),
    assignedPunchListItems: many(punchListItems, { relationName: 'assignedPunchItems' }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
    // --- ENSURE THIS RELATION EXISTS ---
    projectManager: one(users, {
        fields: [projects.projectManagerId],
        references: [users.id],
        relationName: 'projectManager' // Optional explicit name matching repo query
    }),
    // --- END RELATION CHECK ---
    // Cannot directly define relation for clientIds array here for Drizzle's 'with'. Handled manually.
    documents: many(documents),
    tasks: many(tasks),
    invoices: many(invoices),
    messages: many(messages),
    progressUpdates: many(progressUpdates),
    dailyLogs: many(dailyLogs),
    punchListItems: many(punchListItems),
    milestones: many(milestones),
    selections: many(selections),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
    project: one(projects, {
        fields: [documents.projectId],
        references: [projects.id],
    }),
    uploadedByUser: one(users, {
        fields: [documents.uploadedByUserId],
        references: [users.id],
    }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    project: one(projects, {
        fields: [tasks.projectId],
        references: [projects.id],
    }),
    assignee: one(users, {
        fields: [tasks.assignedToUserId],
        references: [users.id],
        relationName: 'assignedTo'
    }),
    createdBy: one(users, {
        fields: [tasks.createdById],
        references: [users.id],
        relationName: 'createdBy'
    }),
    // Dependencies (Task depends on these)
    dependencies: many(taskDependencies, { relationName: 'dependsOn' }),
    // Dependents (These tasks depend on this task)
    dependents: many(taskDependencies, { relationName: 'requiredFor' }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
    // Task that requires the dependency
    task: one(tasks, {
        fields: [taskDependencies.taskId],
        references: [tasks.id],
        relationName: 'requiredFor'
    }),
    // Task that must be completed first
    dependsOnTask: one(tasks, {
        fields: [taskDependencies.dependsOnTaskId],
        references: [tasks.id],
        relationName: 'dependsOn'
    }),
}));


export const invoicesRelations = relations(invoices, ({ one, many }) => ({
    project: one(projects, {
        fields: [invoices.projectId],
        references: [projects.id],
    }),
    payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    invoice: one(invoices, {
        fields: [payments.invoiceId],
        references: [invoices.id],
    }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    project: one(projects, {
        fields: [messages.projectId],
        references: [projects.id],
    }),
    sender: one(users, {
        fields: [messages.senderId],
        references: [users.id],
        relationName: 'sender'
    }),
    recipient: one(users, {
        fields: [messages.recipientId],
        references: [users.id],
        relationName: 'recipient'
    }),
    // parentMessage: one(messages, { fields: [messages.parentMessageId], references: [messages.id] }) // For threading
}));

export const progressUpdatesRelations = relations(progressUpdates, ({ one, many }) => ({
    project: one(projects, {
        fields: [progressUpdates.projectId],
        references: [projects.id],
    }),
    createdBy: one(users, {
        fields: [progressUpdates.createdById],
        references: [users.id],
    }),
    media: many(media),
    // relatedTask: one(tasks, { fields: [progressUpdates.relatedTaskId], references: [tasks.id] })
}));

export const mediaRelations = relations(media, ({ one }) => ({
    progressUpdate: one(progressUpdates, {
        fields: [media.progressUpdateId],
        references: [progressUpdates.id],
    }),
    dailyLog: one(dailyLogs, {
        fields: [media.dailyLogId],
        references: [dailyLogs.id],
    }),
    punchListItem: one(punchListItems, {
        fields: [media.punchListItemId],
        references: [punchListItems.id],
    }),
    uploadedByUser: one(users, {
        fields: [media.uploadedByUserId],
        references: [users.id],
    }),
}));

export const dailyLogsRelations = relations(dailyLogs, ({ one, many }) => ({
    project: one(projects, {
        fields: [dailyLogs.projectId],
        references: [projects.id],
    }),
    createdBy: one(users, {
        fields: [dailyLogs.createdById],
        references: [users.id],
    }),
    media: many(media),
}));

export const punchListItemsRelations = relations(punchListItems, ({ one, many }) => ({
    project: one(projects, {
        fields: [punchListItems.projectId],
        references: [projects.id],
    }),
    createdBy: one(users, {
        fields: [punchListItems.createdById],
        references: [users.id],
        relationName: 'createdPunchItems'
    }),
    assignedTo: one(users, {
        fields: [punchListItems.assignedToUserId],
        references: [users.id],
        relationName: 'assignedPunchItems'
    }),
    media: many(media),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
    project: one(projects, {
        fields: [milestones.projectId],
        references: [projects.id],
    }),
}));

export const selectionsRelations = relations(selections, ({ one }) => ({
    project: one(projects, {
        fields: [selections.projectId],
        references: [projects.id],
    }),
}));


// --- Zod Schemas for Validation ---
// Users
export const insertUserSchema = createInsertSchema(users, {
    email: z.string().email(),
    role: z.enum(userRoleEnum.enumValues),
    fullName: z.string().min(1, "Full name is required"),
}).omit({
    id: true, // Usually generated by DB
    createdAt: true,
    updatedAt: true,
    hashedPassword: true, // Handled separately
    verificationToken: true,
    verificationTokenExpiresAt: true,
    passwordResetToken: true,
    passwordResetTokenExpiresAt: true,
    isVerified: true,
    profileSetupComplete: true,
});
export const selectUserSchema = createSelectSchema(users);
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;

// Projects
export const insertProjectSchema = createInsertSchema(projects, {
    budget: z.coerce.number().positive().optional(),
    clientIds: z.array(z.string().uuid()).optional().nullable(), // Ensure client IDs are UUIDs
    projectManagerId: z.string().uuid().optional().nullable(), // Ensure PM ID is UUID
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    name: z.string().min(1, "Project name is required"),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectProjectSchema = createSelectSchema(projects);
export type Project = z.infer<typeof selectProjectSchema>;
export type NewProject = z.infer<typeof insertProjectSchema>;

// Documents
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true, fileUrl: true });
export const selectDocumentSchema = createSelectSchema(documents);
export type Document = z.infer<typeof selectDocumentSchema>;
export type NewDocument = z.infer<typeof insertDocumentSchema>;

// Tasks
export const insertTaskSchema = createInsertSchema(tasks, {
     startDate: z.coerce.date().optional(),
     endDate: z.coerce.date().optional(),
     estimatedDuration: z.coerce.number().int().optional(),
     actualDuration: z.coerce.number().int().optional(),
     progress: z.coerce.number().int().min(0).max(100).optional().default(0),
     priority: z.coerce.number().int().min(0).max(2).optional().default(0),
     assignedToUserId: z.string().uuid().optional().nullable(),
     createdById: z.string().uuid().optional().nullable(),
     title: z.string().min(1, "Task title is required"),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectTaskSchema = createSelectSchema(tasks);
export type Task = z.infer<typeof selectTaskSchema>;
export type NewTask = z.infer<typeof insertTaskSchema>;

// Task Dependencies
export const insertTaskDependencySchema = createInsertSchema(taskDependencies);
export const selectTaskDependencySchema = createSelectSchema(taskDependencies);
export type TaskDependency = z.infer<typeof selectTaskDependencySchema>;
export type NewTaskDependency = z.infer<typeof insertTaskDependencySchema>;

// Invoices
export const insertInvoiceSchema = createInsertSchema(invoices, {
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
    amount: z.coerce.number().positive(),
    taxAmount: z.coerce.number().nonnegative().optional().default(0),
    totalAmount: z.coerce.number().positive(), // Could be calculated on backend
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectInvoiceSchema = createSelectSchema(invoices);
export type Invoice = z.infer<typeof selectInvoiceSchema>;
export type NewInvoice = z.infer<typeof insertInvoiceSchema>;

// Payments
export const insertPaymentSchema = createInsertSchema(payments, {
    paymentDate: z.coerce.date().optional(),
    amount: z.coerce.number().positive(),
}).omit({ id: true, createdAt: true });
export const selectPaymentSchema = createSelectSchema(payments);
export type Payment = z.infer<typeof selectPaymentSchema>;
export type NewPayment = z.infer<typeof insertPaymentSchema>;

// Messages
export const insertMessageSchema = createInsertSchema(messages, {
    content: z.string().min(1, "Message content cannot be empty"),
}).omit({ id: true, createdAt: true, isRead: true });
export const selectMessageSchema = createSelectSchema(messages);
export type Message = z.infer<typeof selectMessageSchema>;
export type NewMessage = z.infer<typeof insertMessageSchema>;

// Progress Updates
export const insertProgressUpdateSchema = createInsertSchema(progressUpdates, {
     updateDate: z.coerce.date().optional(),
     description: z.string().min(1, "Description is required"),
}).omit({ id: true, createdAt: true });
export const selectProgressUpdateSchema = createSelectSchema(progressUpdates);
export type ProgressUpdate = z.infer<typeof selectProgressUpdateSchema>;
export type NewProgressUpdate = z.infer<typeof insertProgressUpdateSchema>;

// Media
export const insertMediaSchema = createInsertSchema(media).omit({ id: true, createdAt: true, fileUrl: true });
export const selectMediaSchema = createSelectSchema(media);
export type Media = z.infer<typeof selectMediaSchema>;
export type NewMedia = z.infer<typeof insertMediaSchema>;

// Daily Logs
export const insertDailyLogSchema = createInsertSchema(dailyLogs, {
    logDate: z.coerce.date().optional(),
    temperature: z.coerce.number().optional(),
    personnelCount: z.coerce.number().int().optional(),
    workPerformed: z.string().min(1, "Work performed details are required"),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectDailyLogSchema = createSelectSchema(dailyLogs);
export type DailyLog = z.infer<typeof selectDailyLogSchema>;
export type NewDailyLog = z.infer<typeof insertDailyLogSchema>;

// Punch List Items
export const insertPunchListItemSchema = createInsertSchema(punchListItems, {
    priority: z.coerce.number().int().min(0).max(2).optional().default(0),
    dueDate: z.coerce.date().optional(),
    dateCompleted: z.coerce.date().optional(),
    description: z.string().min(1, "Description is required"),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectPunchListItemSchema = createSelectSchema(punchListItems);
export type PunchListItem = z.infer<typeof selectPunchListItemSchema>;
export type NewPunchListItem = z.infer<typeof insertPunchListItemSchema>;

// Milestones
export const insertMilestoneSchema = createInsertSchema(milestones, {
    targetDate: z.coerce.date().optional(),
    completionDate: z.coerce.date().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMilestoneSchema = createSelectSchema(milestones);
export type Milestone = z.infer<typeof selectMilestoneSchema>;
export type NewMilestone = z.infer<typeof insertMilestoneSchema>;

// Selections
export const insertSelectionSchema = createInsertSchema(selections, {
    decisionDeadline: z.coerce.date().optional(),
    dateApproved: z.coerce.date().optional(),
    costEstimate: z.coerce.number().optional(),
    actualCost: z.coerce.number().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSelectionSchema = createSelectSchema(selections);
export type Selection = z.infer<typeof selectSelectionSchema>;
export type NewSelection = z.infer<typeof insertSelectionSchema>;