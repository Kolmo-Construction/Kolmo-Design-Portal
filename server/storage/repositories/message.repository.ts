// server/storage/repositories/message.repository.ts
import { NeonDatabase, PgTransaction } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { MessageWithSender } from '../types'; // Import shared types

// Interface for Message Repository
export interface IMessageRepository {
    getMessagesForProject(projectId: number): Promise<MessageWithSender[]>;
    createMessage(messageData: schema.InsertMessage): Promise<MessageWithSender | null>;
}

// Implementation
class MessageRepository implements IMessageRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    // Helper to get message with sender details
    private async getMessageWithDetails(messageId: number): Promise<MessageWithSender | null> {
         const message = await this.dbOrTx.query.messages.findFirst({
            where: eq(schema.messages.id, messageId),
            with: {
                sender: { // Join sender details
                    columns: { id: true, firstName: true, lastName: true, role: true }
                }
            }
         });
         if (!message) return null;
         if (!message.sender) {
             console.error(`Message ${messageId} found but sender details are missing.`);
             // This implies the sender user was deleted - return null or throw? Let's return null.
             return null;
         }
         return message as MessageWithSender;
    }


    async getMessagesForProject(projectId: number): Promise<MessageWithSender[]> {
        try {
            const messages = await this.dbOrTx.query.messages.findMany({
                where: eq(schema.messages.projectId, projectId),
                orderBy: [asc(schema.messages.createdAt)], // Show oldest first
                with: {
                    sender: { // Join sender details
                        columns: { id: true, firstName: true, lastName: true, role: true }
                    }
                }
            });
            // Filter out messages where sender might be null (e.g., user deleted)
            const validMessages = messages.filter(m => m.sender);
            return validMessages as MessageWithSender[];
        } catch (error) {
            console.error(`Error fetching messages for project ${projectId}:`, error);
            throw new Error('Database error while fetching messages.');
        }
    }

    async createMessage(messageData: schema.InsertMessage): Promise<MessageWithSender | null> {
        try {
            const result = await this.dbOrTx.insert(schema.messages)
                .values(messageData)
                .returning({ id: schema.messages.id }); // Get the new message ID

             if (!result || result.length === 0) throw new Error("Failed to insert message.");
             const newMessageId = result[0].id;

             // Fetch the created message with sender details
             return await this.getMessageWithDetails(newMessageId);

        } catch (error: any) {
            console.error('Error creating message:', error);
             if (error.code === '23503') { // FK violation (projectId or senderId)
                 throw new HttpError(400, 'Invalid project or sender associated with the message.');
            }
            throw new Error('Database error while creating message.');
        }
    }
}

// Export an instance for convenience
export const messageRepository = new MessageRepository();