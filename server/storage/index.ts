// server/storage/index.ts
import { db, pool } from '../db'; // Import db instance
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { eq } from 'drizzle-orm';
import * as schema from '../../shared/schema';

// Import Repository INTERFACES
import { IUserRepository, userRepository } from './repositories/user.repository';
import { IProjectRepository, projectRepository } from './repositories/project.repository';
import { ITaskRepository, taskRepository } from './repositories/task.repository';
import { IDocumentRepository, documentRepository } from './repositories/document.repository';
import { IInvoiceRepository, invoiceRepository } from './repositories/invoice.repository';
import { IMessageRepository, messageRepository } from './repositories/message.repository';
import { IProgressUpdateRepository, progressUpdateRepository } from './repositories/progressUpdate.repository';
import { IDailyLogRepository, dailyLogRepository } from './repositories/dailyLog.repository';
import { IMediaRepository, mediaRepository } from './repositories/media.repository'; // Import instance for injection
import { IQuoteRepository, quoteRepository } from './repositories/quote.repository';
import { IMilestoneRepository, milestoneRepository } from './repositories/milestone.repository';
// *** ADDED: Import PunchListRepository CLASS and INTERFACE ***
import { PunchListRepository, IPunchListRepository } from './repositories/punchList.repository';
import { PaymentRepository, IPaymentRepository } from './repositories/payment.repository';
import { IApiKeyRepository, apiKeyRepository } from './repositories/apikey.repository';
import { ITimeEntryRepository, timeEntryRepository } from './repositories/timeentry.repository';
import { IReceiptRepository, receiptRepository } from './repositories/receipt.repository';
import { ILeadRepository, leadRepository } from './repositories/lead.repository';
import { IInterviewRepository, interviewRepository } from './repositories/interview.repository';
// *** END ADDED ***

// Define the shape of the aggregated storage object
export interface StorageAggregate {
    users: IUserRepository;
    projects: IProjectRepository;
    tasks: ITaskRepository;
    documents: IDocumentRepository;
    invoices: IInvoiceRepository;
    payments: IPaymentRepository;
    messages: IMessageRepository;
    progressUpdates: IProgressUpdateRepository;
    dailyLogs: IDailyLogRepository;
    punchLists: IPunchListRepository; // Use interface
    media: IMediaRepository;
    quotes: IQuoteRepository;
    milestones: IMilestoneRepository;
    apiKeys: IApiKeyRepository;
    timeEntries: ITimeEntryRepository;
    receipts: IReceiptRepository;
    leads: ILeadRepository;
    interviewSessions: IInterviewRepository;
    sessionStore: session.Store;
    // Permission helper functions
    projectManagerHasProjectAccess: (userId: number, projectId: number) => Promise<boolean>;
    clientHasProjectAccess: (userId: number, projectId: number) => Promise<boolean>;
    contractorHasProjectAccess: (userId: number, projectId: number) => Promise<boolean>;
}

// Create PostgreSQL session store
const PostgresSessionStore = connectPg(session);
const sessionStore = new PostgresSessionStore({
    pool,
    createTableIfMissing: true
});

// *** ADDED: Instantiate PunchListRepository here, injecting dependencies ***
const punchListRepositoryInstance = new PunchListRepository(db, mediaRepository);
// *** END ADDED ***

// *** ADDED: Instantiate PaymentRepository ***
const paymentRepositoryInstance = new PaymentRepository(db);
// *** END ADDED ***

// Permission helper functions
const projectManagerHasProjectAccess = async (userId: number, projectId: number): Promise<boolean> => {
    try {
        const project = await db.query.projects.findFirst({
            where: eq(schema.projects.id, projectId),
            columns: { id: true, projectManagerId: true }
        });
        
        return project?.projectManagerId === userId;
    } catch (error) {
        console.error(`Error checking project manager access for user ${userId} to project ${projectId}:`, error);
        return false;
    }
};

const clientHasProjectAccess = async (userId: number, projectId: number): Promise<boolean> => {
    try {
        const project = await db.query.projects.findFirst({
            where: eq(schema.projects.id, projectId),
            with: { clientProjects: { columns: { clientId: true } } }
        });

        return project?.clientProjects?.some(c => c.clientId === userId) || false;
    } catch (error) {
        console.error(`Error checking client access for user ${userId} to project ${projectId}:`, error);
        return false;
    }
};

const contractorHasProjectAccess = async (userId: number, projectId: number): Promise<boolean> => {
    try {
        // Contractors are also stored in clientProjects table (it's a user-project junction table)
        const project = await db.query.projects.findFirst({
            where: eq(schema.projects.id, projectId),
            with: { clientProjects: { columns: { clientId: true } } }
        });

        return project?.clientProjects?.some(c => c.clientId === userId) || false;
    } catch (error) {
        console.error(`Error checking contractor access for user ${userId} to project ${projectId}:`, error);
        return false;
    }
};

// Export the aggregated object
export const storage: StorageAggregate = {
    users: userRepository,
    projects: projectRepository,
    tasks: taskRepository,
    documents: documentRepository,
    invoices: invoiceRepository,
    payments: paymentRepositoryInstance,
    messages: messageRepository,
    progressUpdates: progressUpdateRepository,
    dailyLogs: dailyLogRepository,
    punchLists: punchListRepositoryInstance, // Use the newly created instance
    media: mediaRepository,
    quotes: quoteRepository,
    milestones: milestoneRepository,
    apiKeys: apiKeyRepository,
    timeEntries: timeEntryRepository,
    receipts: receiptRepository,
    leads: leadRepository,
    interviewSessions: interviewRepository,
    sessionStore,
    projectManagerHasProjectAccess,
    clientHasProjectAccess,
    contractorHasProjectAccess,
};

// Optionally re-export individual repositories if needed elsewhere
// (No changes needed here unless you want to export the new instance directly)
export {
    userRepository,
    projectRepository,
    taskRepository,
    documentRepository,
    invoiceRepository,
    messageRepository,
    progressUpdateRepository,
    dailyLogRepository,
    punchListRepositoryInstance as punchListRepository, // Export the instance with the original name
    mediaRepository,
    apiKeyRepository,
    timeEntryRepository,
    receiptRepository,
    leadRepository,
    interviewRepository
};
