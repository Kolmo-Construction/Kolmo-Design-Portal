// server/storage/repositories/progressUpdate.repository.ts
import { NeonDatabase, PgTransaction } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { ProgressUpdateWithDetails } from '../types';
// Import Media Repository
import { mediaRepository, IMediaRepository } from './media.repository';

// Interface for ProgressUpdate Repository
export interface IProgressUpdateRepository {
    getProgressUpdatesForProject(projectId: number): Promise<ProgressUpdateWithDetails[]>;
    // Transactional method combining update and media creation
    createProgressUpdateWithMedia(
        updateData: schema.InsertProgressUpdate,
        mediaItemsData: Omit<schema.InsertMedia, 'id' | 'createdAt'>[] // Media data without IDs
    ): Promise<ProgressUpdateWithDetails | null>;
    // Need method to get keys for R2 deletion before DB deletion
    getProgressUpdateWithMediaKeys(updateId: number): Promise<{ update: schema.ProgressUpdate, keys: string[] } | null>;
    deleteProgressUpdate(updateId: number): Promise<boolean>;
}

// Implementation
class ProgressUpdateRepository implements IProgressUpdateRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;
    private mediaRepo: IMediaRepository; // Inject media repo

    constructor(
        databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db,
        mediaRepoInstance: IMediaRepository = mediaRepository // Use default instance
    ) {
        this.dbOrTx = databaseOrTx;
        this.mediaRepo = mediaRepoInstance;
    }

    async getProgressUpdatesForProject(projectId: number): Promise<ProgressUpdateWithDetails[]> {
         try {
            const updates = await this.dbOrTx.query.progressUpdates.findMany({
                where: eq(schema.progressUpdates.projectId, projectId),
                orderBy: [desc(schema.progressUpdates.createdAt)],
                with: {
                    author: { columns: { id: true, firstName: true, lastName: true } },
                    mediaItems: true // Fetch associated media items
                }
            });
            // Filter/ensure author exists
             const validUpdates = updates.filter(u => u.author);
             return validUpdates as ProgressUpdateWithDetails[];
        } catch (error) {
            console.error(`Error fetching progress updates for project ${projectId}:`, error);
            throw new Error('Database error while fetching progress updates.');
        }
    }

    async createProgressUpdateWithMedia(
        updateData: schema.InsertProgressUpdate,
        mediaItemsData: Omit<schema.InsertMedia, 'id' | 'createdAt'>[]
    ): Promise<ProgressUpdateWithDetails | null> {
         // Ensure dbOrTx is the base db instance for transaction
         const baseDb = ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction)
            ? db // If called within transaction, use base db to start new one (or handle nested?) - check Drizzle docs for best practice
            : this.dbOrTx as NeonDatabase<typeof schema>;

         return baseDb.transaction(async (tx) => {
            // Use transaction instance for repository methods
            const txProgressRepo = new ProgressUpdateRepository(tx, new MediaRepository(tx)); // Create repo instances with tx
            const txMediaRepo = new MediaRepository(tx);

            // 1. Insert progress update
            const updateResult = await tx.insert(schema.progressUpdates)
                .values(updateData)
                .returning({ id: schema.progressUpdates.id });
            if (!updateResult || updateResult.length === 0) throw new Error("Failed to insert progress update.");
            const updateId = updateResult[0].id;

            // 2. Insert media items using MediaRepository
            if (mediaItemsData.length > 0) {
                const fullMediaData = mediaItemsData.map(m => ({
                    ...m,
                    progressUpdateId: updateId, // Link media to this update
                    punchListItemId: null, // Ensure other link is null
                }));
                await txMediaRepo.createMultipleMediaItems(fullMediaData);
            }

            // 3. Fetch the complete result using the transaction instance
            const finalResult = await tx.query.progressUpdates.findFirst({
                where: eq(schema.progressUpdates.id, updateId),
                with: {
                    author: { columns: { id: true, firstName: true, lastName: true } },
                    mediaItems: true,
                },
            });

            if (!finalResult || !finalResult.author) throw new Error("Failed to retrieve created progress update with details.");
            return finalResult as ProgressUpdateWithDetails;
        });
    }

     async getProgressUpdateWithMediaKeys(updateId: number): Promise<{ update: schema.ProgressUpdate, keys: string[] } | null> {
         const update = await this.dbOrTx.query.progressUpdates.findFirst({
             where: eq(schema.progressUpdates.id, updateId),
             columns: { id: true }, // Fetch only ID or needed fields
         });
         if (!update) return null;
         const keys = await this.mediaRepo.getMediaKeysForProgressUpdate(updateId);
         return { update, keys };
     }


     async deleteProgressUpdate(updateId: number): Promise<boolean> {
          // Assumes R2 deletion is handled by caller using keys from getProgressUpdateWithMediaKeys
          const baseDb = ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction)
            ? db : this.dbOrTx as NeonDatabase<typeof schema>;

          return baseDb.transaction(async (tx) => {
              const txMediaRepo = new MediaRepository(tx);
              // 1. Delete associated media records first
              await txMediaRepo.deleteMediaForProgressUpdate(updateId, tx);

              // 2. Delete the progress update itself
              const result = await tx.delete(schema.progressUpdates)
                .where(eq(schema.progressUpdates.id, updateId))
                .returning({ id: schema.progressUpdates.id });

             return result.length > 0;
          });
     }
}

// Export an instance for convenience
export const progressUpdateRepository = new ProgressUpdateRepository();