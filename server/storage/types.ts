// server/storage/types.ts
import * as schema from '../../shared/schema';

// Define reusable types for repository return values
export type UserProfile = Omit<schema.User, 'passwordHash' | 'magicLinkToken' | 'magicLinkExpiresAt'>;
export type ClientInfo = Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'email'>;
export type ProjectManagerInfo = Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'email'>;

export type ProjectWithDetails = schema.Project & {
    clients: ClientInfo[];
    projectManager: ProjectManagerInfo | null;
};

export type TaskWithAssignee = schema.Task & {
    assignee: ClientInfo | null; // Use ClientInfo for consistency
    createdBy: Pick<schema.User, 'id' | 'firstName' | 'lastName'>;
};

export type MessageWithSender = schema.Message & {
    sender: Pick<schema.User, 'id' | 'firstName' | 'lastName' | 'role'>
};

export type ProgressUpdateWithDetails = schema.ProgressUpdate & {
    author: Pick<schema.User, 'id' | 'firstName' | 'lastName'>,
    mediaItems: schema.MediaItem[]
};

export type DailyLogWithAuthor = schema.DailyLog & {
    author: Pick<schema.User, 'id' | 'firstName' | 'lastName'>
};

export type PunchListItemWithDetails = schema.PunchListItem & {
    createdBy: Pick<schema.User, 'id' | 'firstName' | 'lastName'>,
    mediaItems: schema.MediaItem[]
};

export type InvoiceWithPayments = schema.Invoice & {
    payments: schema.Payment[]
};

// Define other complex types as needed...