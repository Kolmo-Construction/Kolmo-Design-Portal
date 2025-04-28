// server/storage/index.ts
import { userRepository, IUserRepository } from './repositories/user.repository';
import { projectRepository, IProjectRepository } from './repositories/project.repository';
import { taskRepository, ITaskRepository } from './repositories/task.repository';
import { documentRepository, IDocumentRepository } from './repositories/document.repository';
import { invoiceRepository, IInvoiceRepository } from './repositories/invoice.repository';
import { messageRepository, IMessageRepository } from './repositories/message.repository';
import { progressUpdateRepository, IProgressUpdateRepository } from './repositories/progressUpdate.repository'; // Import Progress Update repo
import { dailyLogRepository, IDailyLogRepository } from './repositories/dailyLog.repository'; // Import Daily Log repo
import { punchListRepository, IPunchListRepository } from './repositories/punchList.repository'; // Import Punch List repo
import { mediaRepository, IMediaRepository } from './repositories/media.repository'; // Import Media repo


// Define the shape of the aggregated storage object
export interface StorageAggregate {
    users: IUserRepository;
    projects: IProjectRepository;
    tasks: ITaskRepository;
    documents: IDocumentRepository;
    invoices: IInvoiceRepository;
    messages: IMessageRepository;
    progressUpdates: IProgressUpdateRepository; // Add Progress Update repo interface
    dailyLogs: IDailyLogRepository;           // Add Daily Log repo interface
    punchLists: IPunchListRepository;         // Add Punch List repo interface
    media: IMediaRepository;                  // Add Media repo interface
    // ... other repositories
}

// Export the aggregated object
export const storage: StorageAggregate = {
    users: userRepository,
    projects: projectRepository,
    tasks: taskRepository,
    documents: documentRepository,
    invoices: invoiceRepository,
    messages: messageRepository,
    progressUpdates: progressUpdateRepository, // Add Progress Update repo instance
    dailyLogs: dailyLogRepository,           // Add Daily Log repo instance
    punchLists: punchListRepository,         // Add Punch List repo instance
    media: mediaRepository,                  // Add Media repo instance
    // ... add other repositories here
};

// Optionally re-export individual repositories if needed elsewhere
export {
    userRepository,
    projectRepository,
    taskRepository,
    documentRepository,
    invoiceRepository,
    messageRepository,
    progressUpdateRepository,
    dailyLogRepository,
    punchListRepository,
    mediaRepository
};