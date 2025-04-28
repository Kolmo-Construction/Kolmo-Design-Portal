// server/storage/repositories/punchList.repository.ts
import { NeonDatabase, PgTransaction } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { PunchListItemWithDetails, MediaItem } from '../types'; // Import shared types
// Import Media Repository
import { mediaRepository, IMediaRepository } from './media.repository';

// Interface for PunchList Repository
export interface IPunchListRepository {
    getPunchListItemsForProject(projectId: number): Promise<PunchListItemWithDetails[]>;
    getPunchListItemById(itemId: number): Promise<PunchListItemWithDetails | null>;
    createPunchListItem(itemData: schema.InsertPunchListItem): Promise<(schema.PunchListItem & { createdBy: Pick<schema.User, 'id' | 'firstName' | 'lastName'> }) | null>; // Simpler return for create
    updatePunchListItem(itemId: number, itemData: Partial<Omit<schema.InsertPunchListItem, 'id' | 'projectId' | 'createdBy'>>): Promise<schema.PunchListItem | null>; // Simpler return for update
    deletePunchListItem(itemId: number): Promise<boolean>; // Handles media DB record deletion
    // Media linking handled by MediaRepository now
}

// Implementation
class PunchListRepository implements IPunchListRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;
    private mediaRepo: IMediaRepository; // Inject media repo

     constructor(
        databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db,
        mediaRepoInstance: IMediaRepository = mediaRepository // Use default instance
    ) {
        this.dbOrTx = databaseOrTx;
        this.mediaRepo = mediaRepoInstance;
    }

    async getPunchListItemsForProject(projectId: number): Promise<PunchListItemWithDetails[]> {
        try {
            const items = await this.dbOrTx.query.punchListItems.findMany({
                where: eq(schema.punchListItems.projectId, projectId),
                orderBy: [asc(schema.punchListItems.status), asc(schema.punchListItems.createdAt)],
                with: {
                    createdBy: { columns: { id: true, firstName: true, lastName: true } },
                    mediaItems: true // Fetch associated media items
                }
            });
             const validItems = items.filter(item => item.createdBy);
             return validItems as PunchListItemWithDetails[];
        } catch (error) {
             console.error(`Error fetching punch list items for project ${projectId}:`, error);
             throw new Error('Database error while fetching punch list items.');
        }
    }

    async getPunchListItemById(itemId: number): Promise<PunchListItemWithDetails | null> {
         try {
            const item = await this.dbOrTx.query.punchListItems.findFirst({
                where: eq(schema.punchListItems.id, itemId),
                with: {
                    createdBy: { columns: { id: true, firstName: true, lastName: true } },
                    mediaItems: true
                }
            });
             if (!item || !item.createdBy) return null;
             return item as PunchListItemWithDetails;
        } catch (error) {
             console.error(`Error fetching punch list item ${itemId}:`, error);
             throw new Error('Database error while fetching punch list item.');
        }
    }

    // Returns simpler object without media, assumes FE refetches list or full item if needed
    async createPunchListItem(itemData: schema.InsertPunchListItem): Promise<(schema.PunchListItem & { createdBy: Pick<schema.User, 'id' | 'firstName' | 'lastName'> }) | null> {
        try {
            const result = await this.dbOrTx.insert(schema.punchListItems)
                .values({
                    ...itemData,
                    status: itemData.status ?? schema.punchListItemStatusEnum.enumValues[0], // Default status
                })
                .returning({ id: schema.punchListItems.id });

            if (!result || result.length === 0) throw new Error("Failed to insert punch list item.");
            const newItemId = result[0].id;

            // Fetch with creator details only
            const createdItem = await this.dbOrTx.query.punchListItems.findFirst({
                 where: eq(schema.punchListItems.id, newItemId),
                 with: { createdBy: { columns: { id: true, firstName: true, lastName: true } } }
            });

             if (!createdItem || !createdItem.createdBy) return null;
             return createdItem as (schema.PunchListItem & { createdBy: Pick<schema.User, 'id' | 'firstName' | 'lastName'> });

        } catch (error: any) {
            console.error('Error creating punch list item:', error);
            if (error.code === '23503') { // FK violation
                 throw new HttpError(400, 'Invalid project or creator associated with the punch list item.');
            }
            throw new Error('Database error while creating punch list item.');
        }
    }

    // Returns simpler object without media/creator, assumes FE refetches list or full item if needed
    async updatePunchListItem(itemId: number, itemData: Partial<Omit<schema.InsertPunchListItem, 'id' | 'projectId' | 'createdBy'>>): Promise<schema.PunchListItem | null> {
        if (Object.keys(itemData).length === 0) {
            console.warn("Update punch list item called with empty data.");
            return this.dbOrTx.query.punchListItems.findFirst({ where: eq(schema.punchListItems.id, itemId)}) ?? null;
        }
         try {
            const result = await this.dbOrTx.update(schema.punchListItems)
                .set({
                    ...itemData,
                    completedAt: itemData.status === 'COMPLETED' ? new Date() : (itemData.status ? null : undefined), // Set/clear completedAt based on status
                    updatedAt: new Date(),
                })
                .where(eq(schema.punchListItems.id, itemId))
                .returning(); // Return updated item basic details

            return result.length > 0 ? result[0] : null; // Not found
        } catch (error) {
            console.error(`Error updating punch list item ${itemId}:`, error);
            throw new Error('Database error while updating punch list item.');
        }
    }

    async deletePunchListItem(itemId: number): Promise<boolean> {
        // Assumes R2 deletion is handled by caller *before* calling this.
        const baseDb = ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction)
            ? db : this.dbOrTx as NeonDatabase<typeof schema>;

        return baseDb.transaction(async (tx) => {
            const txMediaRepo = new MediaRepository(tx); // Use transaction instance

            // 1. Delete associated media records from DB first
            await txMediaRepo.deleteMediaForPunchListItem(itemId, tx);

            // 2. Delete the punch list item itself
            const result = await tx.delete(schema.punchListItems)
              .where(eq(schema.punchListItems.id, itemId))
              .returning({ id: schema.punchListItems.id });

           return result.length > 0;
        });
    }
}

// Export an instance for convenience
export const punchListRepository = new PunchListRepository();