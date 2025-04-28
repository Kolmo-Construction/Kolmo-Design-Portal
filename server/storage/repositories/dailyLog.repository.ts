// server/storage/repositories/dailyLog.repository.ts
import { NeonDatabase, PgTransaction } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { DailyLogWithAuthor } from '../types';

// Interface for DailyLog Repository
export interface IDailyLogRepository {
    getDailyLogsForProject(projectId: number): Promise<DailyLogWithAuthor[]>;
    createDailyLog(logData: schema.InsertDailyLog): Promise<DailyLogWithAuthor | null>;
    updateDailyLog(logId: number, logData: Partial<Omit<schema.InsertDailyLog, 'id' | 'projectId' | 'authorId'>>): Promise<DailyLogWithAuthor | null>;
    deleteDailyLog(logId: number): Promise<boolean>;
    getDailyLogById(logId: number): Promise<DailyLogWithAuthor | null>; // Added for convenience
}

// Implementation
class DailyLogRepository implements IDailyLogRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    private async getLogWithDetails(logId: number): Promise<DailyLogWithAuthor | null> {
         const log = await this.dbOrTx.query.dailyLogs.findFirst({
            where: eq(schema.dailyLogs.id, logId),
            with: {
                author: { columns: { id: true, firstName: true, lastName: true } }
            }
         });
         if (!log || !log.author) return null;
         return log as DailyLogWithAuthor;
    }

    async getDailyLogById(logId: number): Promise<DailyLogWithAuthor | null> {
         try {
             return await this.getLogWithDetails(logId);
         } catch (error) {
              console.error(`Error fetching daily log ${logId}:`, error);
              throw new Error('Database error while fetching daily log.');
         }
    }

    async getDailyLogsForProject(projectId: number): Promise<DailyLogWithAuthor[]> {
        try {
            const logs = await this.dbOrTx.query.dailyLogs.findMany({
                where: eq(schema.dailyLogs.projectId, projectId),
                orderBy: [desc(schema.dailyLogs.logDate)],
                with: {
                    author: { columns: { id: true, firstName: true, lastName: true } }
                }
            });
            const validLogs = logs.filter(log => log.author);
            return validLogs as DailyLogWithAuthor[];
        } catch (error) {
            console.error(`Error fetching daily logs for project ${projectId}:`, error);
            throw new Error('Database error while fetching daily logs.');
        }
    }

    async createDailyLog(logData: schema.InsertDailyLog): Promise<DailyLogWithAuthor | null> {
        try {
            const result = await this.dbOrTx.insert(schema.dailyLogs)
                .values(logData)
                .returning({ id: schema.dailyLogs.id });
             if (!result || result.length === 0) throw new Error("Failed to insert daily log.");
             return await this.getLogWithDetails(result[0].id);
        } catch (error: any) {
            console.error('Error creating daily log:', error);
            if (error.code === '23503') { // FK violation
                 throw new HttpError(400, 'Invalid project or author associated with the daily log.');
            }
            // Handle potential unique constraint on projectId+logDate if added
            // if (error.code === '23505') { ... }
            throw new Error('Database error while creating daily log.');
        }
    }

    async updateDailyLog(logId: number, logData: Partial<Omit<schema.InsertDailyLog, 'id' | 'projectId' | 'authorId'>>): Promise<DailyLogWithAuthor | null> {
        if (Object.keys(logData).length === 0) {
            console.warn("Update daily log called with empty data.");
            return this.getLogWithDetails(logId);
        }
        try {
            const result = await this.dbOrTx.update(schema.dailyLogs)
                .set({ ...logData, updatedAt: new Date() })
                .where(eq(schema.dailyLogs.id, logId))
                .returning({ id: schema.dailyLogs.id });

            if (!result || result.length === 0) return null; // Not found
            return await this.getLogWithDetails(logId);
        } catch (error) {
            console.error(`Error updating daily log ${logId}:`, error);
            throw new Error('Database error while updating daily log.');
        }
    }

    async deleteDailyLog(logId: number): Promise<boolean> {
        try {
            const result = await this.dbOrTx.delete(schema.dailyLogs)
                .where(eq(schema.dailyLogs.id, logId))
                .returning({ id: schema.dailyLogs.id });
            return result.length > 0;
        } catch (error) {
            console.error(`Error deleting daily log ${logId}:`, error);
            throw new Error('Database error while deleting daily log.');
        }
    }
}

// Export an instance for convenience
export const dailyLogRepository = new DailyLogRepository();