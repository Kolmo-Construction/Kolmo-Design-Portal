import type {
    Project,
    Document,
    User,
    Task,
    TaskDependency,
    DailyLog,
    Media,
    PunchListItem,
    ProgressUpdate,
    Invoice,
} from '@/shared/schema'; // Adjust imports based on your actual schema exports

// --- NEW OR MODIFIED TYPE ---
export type ProjectWithManagerAndClients = Project & {
    projectManagerName: string | null;
    clientNames: string[];
    // Include other relations if they were part of a previous 'ProjectWithDetails' type
    // For example:
    // documents?: Document[];
    // tasks?: Task[];
};
// --- END OF CHANGE ---

// Keep other existing types if needed
export type TaskWithAssignee = Task & {
    assigneeName: string | null;
};

export type TaskWithDetails = Task & {
    assignee: User | null; // Or just assigneeName: string | null;
    dependencies?: TaskDependency[];
    dependents?: TaskDependency[];
};

export type DailyLogWithDetails = DailyLog & {
    createdByFullName: string | null;
    media: Media[];
};

export type PunchListItemWithDetails = PunchListItem & {
    createdByFullName: string | null;
    assignedToFullName: string | null;
    media: Media[];
};

export type ProgressUpdateWithMedia = ProgressUpdate & {
    media: Media[];
};

export type InvoiceWithDetails = Invoice & {
    // Add related fields if necessary, e.g., payments
};

export type ProjectFullDetails = ProjectWithManagerAndClients & {
    documents?: Document[];
    tasks?: TaskWithAssignee[]; // Or TaskWithDetails[]
    dailyLogs?: DailyLogWithDetails[];
    punchListItems?: PunchListItemWithDetails[];
    progressUpdates?: ProgressUpdateWithMedia[];
    invoices?: InvoiceWithDetails[];
    // messages, milestones, selections etc. if needed
};

// Interface for User object expected by repositories/controllers
// Ensure this matches what Passport puts on req.user
export interface AuthenticatedUser {
    id: string;
    role: 'admin' | 'project_manager' | 'client';
    // Add other fields from User if necessary (e.g., fullName)
}