// server/storage/repositories/dailyLog.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { DailyLogWithDetails } from '../types';
// Import Media Repository if needed
import { MediaRepository } from './media.repository';

// Interface for DailyLog Repository
export interface IDailyLogRepository {
    getDailyLogsForProject(projectId: number): Promise<DailyLogWithDetails[]>;
    getDailyLogById(logId: number): Promise<DailyLogWithDetails | null>;
    createDailyLog(logData: schema.InsertDailyLog): Promise<DailyLogWithDetails | null>;
    updateDailyLog(logId: number, logData: Partial<Omit<schema.InsertDailyLog, 'id' | 'projectId' | 'userId'>>): Promise<DailyLogWithDetails | null>;
    deleteDailyLog(logId: number): Promise<boolean>;
    // Photo-related methods if needed
    // addPhotoToDailyLog(logId: number, photoData: any): Promise<any>;
    // removeDailyLogPhoto(photoId: number): Promise<boolean>;
}

// Implementation of the DailyLog Repository
class DailyLogRepository implements IDailyLogRepository {
    private dbOrTx: NeonDatabase<typeof schema> | any;
    
    constructor(databaseOrTx: NeonDatabase<typeof schema> | any = db) {
        this.dbOrTx = databaseOrTx;
    }

    async getDailyLogsForProject(projectId: number): Promise<DailyLogWithDetails[]> {
        try {
            // Fetch daily logs for the specified project
            const dailyLogs = await this.dbOrTx.query.dailyLogs.findMany({
                where: eq(schema.dailyLogs.projectId, projectId),
                orderBy: [desc(schema.dailyLogs.createdAt)],
                with: {
                    creator: {
                        columns: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        }
                    },
                    photos: true
                }
            });

            return dailyLogs;
        } catch (error) {
            console.error(`Error fetching daily logs for project ${projectId}:`, error);
            throw new Error('Database error while fetching daily logs.');
        }
    }

    async getDailyLogById(logId: number): Promise<DailyLogWithDetails | null> {
        try {
            // Fetch a specific daily log by ID
            const dailyLog = await this.dbOrTx.query.dailyLogs.findFirst({
                where: eq(schema.dailyLogs.id, logId),
                with: {
                    creator: {
                        columns: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        }
                    },
                    photos: true
                }
            });

            return dailyLog || null;
        } catch (error) {
            console.error(`Error fetching daily log ${logId}:`, error);
            throw new Error('Database error while fetching daily log.');
        }
    }

    async createDailyLog(logData: schema.InsertDailyLog): Promise<DailyLogWithDetails | null> {
        try {
            // Process the logDate to ensure it's a valid Date object
            let processedData = { ...logData };
            
            // If logDate is a string, convert it to a Date object
            if (typeof processedData.logDate === 'string') {
                console.log(`Converting logDate from string: ${processedData.logDate}`);
                processedData.logDate = new Date(processedData.logDate);
            }
            
            console.log("Processed data for insert:", JSON.stringify(processedData, null, 2));
            
            // Insert new daily log with the processed data
            const insertedLogs = await this.dbOrTx.insert(schema.dailyLogs)
                .values(processedData)
                .returning();

            if (!insertedLogs || insertedLogs.length === 0) {
                return null;
            }

            // Fetch the newly created log with its relations
            return this.getDailyLogById(insertedLogs[0].id);
        } catch (error) {
            console.error('Error creating daily log:', error);
            
            // Check for specific database errors and provide a more helpful message
            if (error instanceof Error) {
                if (error.message.includes('numeric field overflow') || 
                    (error as any).code === '22003') {
                    throw new Error('Temperature value is too large. Please enter a value between -999.99 and 999.99.');
                }
            }
            
            // Generic fallback error
            throw new Error('Database error while creating daily log.');
        }
    }

    async updateDailyLog(
        logId: number,
        logData: Partial<Omit<schema.InsertDailyLog, 'id' | 'projectId' | 'userId'>>
    ): Promise<DailyLogWithDetails | null> {
        try {
            // Process the logDate to ensure it's a valid Date object if provided
            let processedData = { ...logData };
            
            // If logDate is a string, convert it to a Date object
            if (processedData.logDate && typeof processedData.logDate === 'string') {
                console.log(`Converting logDate from string in update: ${processedData.logDate}`);
                processedData.logDate = new Date(processedData.logDate);
            }
            
            console.log("Processed data for update:", JSON.stringify(processedData, null, 2));
            
            // Update daily log with the processed data
            const updatedLogs = await this.dbOrTx.update(schema.dailyLogs)
                .set(processedData)
                .where(eq(schema.dailyLogs.id, logId))
                .returning();

            if (!updatedLogs || updatedLogs.length === 0) {
                return null;
            }

            // Fetch the updated log with its relations
            return this.getDailyLogById(logId);
        } catch (error) {
            console.error(`Error updating daily log ${logId}:`, error);
            
            // Check for specific database errors and provide a more helpful message
            if (error instanceof Error) {
                if (error.message.includes('numeric field overflow') || 
                    (error as any).code === '22003') {
                    throw new Error('Temperature value is too large. Please enter a value between -999.99 and 999.99.');
                }
            }
            
            // Generic fallback error
            throw new Error('Database error while updating daily log.');
        }
    }

    async deleteDailyLog(logId: number): Promise<boolean> {
        try {
            // Delete daily log
            const result = await this.dbOrTx.delete(schema.dailyLogs)
                .where(eq(schema.dailyLogs.id, logId))
                .returning({ id: schema.dailyLogs.id });

            return result.length > 0;
        } catch (error) {
            console.error(`Error deleting daily log ${logId}:`, error);
            throw new Error('Database error while deleting daily log.');
        }
    }

    // Photo-related methods can be added here if needed
}

// Export the repository instance and interface
export const dailyLogRepository = new DailyLogRepository();
export { DailyLogRepository };