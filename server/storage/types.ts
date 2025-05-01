// server/storage/types.ts

// Changed import from '../../shared/schema' to a relative path
import * as schema from '../../shared/schema'; // Relative path to shared/schema.ts

// Define reusable types for repository return values
export type UserProfile = Omit<schema.User, 'password' | 'magicLinkToken' | 'magicLinkExpiry'>; // Corrected field names based on schema
export type ClientInfo = Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'email'>;
export type ProjectManagerInfo = Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'email'>;

export type ProjectWithDetails = schema.Project & {
    clients: ClientInfo[];
    projectManager: ProjectManagerInfo | null;
};

export type TaskWithAssignee = schema.Task & {
    assignee: Pick<schema.User, 'id' | 'firstName' | 'lastName'> | null; // Use Pick for consistency
    // Note: No creator field as the tasks table doesn't have a created_by column
};

export type MessageWithSender = schema.Message & {
    sender: Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'role'>;
    recipient: Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'role'> | null; // Add recipient based on schema relations
};

export type ProgressUpdateWithDetails = schema.ProgressUpdate & {
    creator: Pick<schema.User, 'id' | 'firstName' | 'lastName'>, // Use creator based on schema relations
    media: schema.UpdateMedia[] // Updated to match schema relation name and type
};

export type DailyLogWithAuthor = schema.DailyLog & {
    creator: Pick<schema.User, 'id' | 'firstName' | 'lastName'>; // Use creator based on schema relations
    photos: schema.DailyLogPhoto[]; // Include daily log photos based on schema relations
};

// Add DailyLogWithDetails for backward compatibility and maintain consistent naming
export type DailyLogWithDetails = schema.DailyLog & {
    creator?: Pick<schema.User, 'id' | 'firstName' | 'lastName'> | null;
    photos?: schema.DailyLogPhoto[];
};

export type PunchListItemWithDetails = schema.PunchListItem & {
    creator: Pick<schema.User, 'id' | 'firstName' | 'lastName'>; // Use creator based on schema relations
    assignee: Pick<schema.User, 'id' | 'firstName' | 'lastName'> | null; // Include assignee based on schema relations
    media: schema.UpdateMedia[]; // Updated to match schema relation name and type
};

export type InvoiceWithPayments = schema.Invoice & {
    payments: schema.Payment[]
};

// Define other complex types as needed...