// server/storage/index.ts
import { db, pool } from '../db'; // Import db instance
import session from 'express-session';
import connectPg from 'connect-pg-simple';

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

// *** ADDED: Import PunchListRepository CLASS and INTERFACE ***
import { PunchListRepository, IPunchListRepository } from './repositories/punchList.repository';
// *** END ADDED ***

// Define the shape of the aggregated storage object
export interface StorageAggregate {
    users: IUserRepository;
    projects: IProjectRepository;
    tasks: ITaskRepository;
    documents: IDocumentRepository;
    invoices: IInvoiceRepository;
    messages: IMessageRepository;
    progressUpdates: IProgressUpdateRepository;
    dailyLogs: IDailyLogRepository;
    punchLists: IPunchListRepository; // Use interface
    media: IMediaRepository;
    sessionStore: session.Store;
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

// Export the aggregated object
export const storage: StorageAggregate = {
    users: userRepository,
    projects: projectRepository,
    tasks: taskRepository,
    documents: documentRepository,
    invoices: invoiceRepository,
    messages: messageRepository,
    progressUpdates: progressUpdateRepository,
    dailyLogs: dailyLogRepository,
    punchLists: punchListRepositoryInstance, // Use the newly created instance
    media: mediaRepository,
    sessionStore,
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
    mediaRepository
};
