// server/storage/repositories/punchList.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';

// Relative path import from shared/schema.ts
import * as schema from '../../../shared/schema';

import { db } from '../../db'; // Import the database instance
import { HttpError } from '../../errors';
// Import updated types including the correct media relation - relative path
import { PunchListItemWithDetails } from '../types';
// Import ONLY the Media Repository INTERFACE for type hinting
import { IMediaRepository } from './media.repository'; // Relative path to media.repository.ts
import { log as logger } from '../../vite'; // Import logger

// --- REMOVED: Placeholder MediaStorage and simpleLogger ---

// Interface for PunchList Repository - Updated return types to use PunchListItemWithDetails where applicable
export interface IPunchListRepository {
    getPunchListItemsForProject(projectId: number): Promise<PunchListItemWithDetails[]>;
    getPunchListItemById(itemId: number): Promise<PunchListItemWithDetails | null>;
    // Return type updated to match the fetched type which includes creator and media
    createPunchListItem(itemData: schema.InsertPunchListItem): Promise<PunchListItemWithDetails | null>;
    // Update return type simplified as before, as media updates are separate
    updatePunchListItem(itemId: number, itemData: Partial<Omit<schema.InsertPunchListItem, 'id' | 'projectId' | 'createdById'>>): Promise<schema.PunchListItem | null>;
    // Return type updated to match the original boolean
    deletePunchListItem(itemId: number): Promise<boolean>;
}

// Implementation
// *** ADDED: Export the class itself ***
export class PunchListRepository implements IPunchListRepository {
    private dbOrTx: NeonDatabase<typeof schema> | any;
    private mediaRepo: IMediaRepository; // Use the interface type

    constructor(
        // *** MODIFIED: Removed default value depending on storage ***
        databaseOrTx: NeonDatabase<typeof schema> | any,
        // *** MODIFIED: Constructor now REQUIRES the media repository instance ***
        mediaRepoInstance: IMediaRepository
    ) {
        this.dbOrTx = databaseOrTx;
        this.mediaRepo = mediaRepoInstance; // Assign the injected instance
    }

    // Helper function to fetch item with details (including media)
    private async _getPunchListItemWithDetails(itemId: number): Promise<PunchListItemWithDetails | null> {
        const item = await this.dbOrTx.query.punchListItems.findFirst({
            where: eq(schema.punchListItems.id, itemId),
            with: {
                creator: { columns: { id: true, firstName: true, lastName: true } },
                assignee: { columns: { id: true, firstName: true, lastName: true } },
                 // Fetch related media items using the correct relation name from schema.ts
                 // Ensure 'media' is the relation defined in punchListItemRelations
                media: {
                    columns: {
                        id: true,
                        mediaUrl: true,
                        mediaType: true,
                        caption: true,
                        uploadedById: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!item) return null;

        // Ensure the media property exists and rename for backward compatibility if needed
        const result = {
            ...item,
            media: item.media || [], // Ensure media is always an array
            mediaItems: item.media || [] // For compatibility with previous type defs
        };

        return result as PunchListItemWithDetails;
    }


    async getPunchListItemsForProject(projectId: number): Promise<PunchListItemWithDetails[]> {
        try {
            const items = await this.dbOrTx.query.punchListItems.findMany({
                where: eq(schema.punchListItems.projectId, projectId),
                orderBy: [asc(schema.punchListItems.status), asc(schema.punchListItems.createdAt)],
                with: {
                    creator: { columns: { id: true, firstName: true, lastName: true } },
                    assignee: { columns: { id: true, firstName: true, lastName: true } },
                    media: true // Fetch related media directly
                }
            });

            // Map to ensure 'mediaItems' exists for compatibility if needed elsewhere
            return items.map(item => ({
                ...item,
                mediaItems: item.media || []
            })) as PunchListItemWithDetails[];

        } catch (error) {
            logger(`Error fetching punch list items for project ${projectId}: ${error instanceof Error ? error.message : error}`, 'PunchListRepo');
            throw new Error('Database error while fetching punch list items.');
        }
    }

    async getPunchListItemById(itemId: number): Promise<PunchListItemWithDetails | null> {
        try {
            return await this._getPunchListItemWithDetails(itemId); // Use helper
        } catch (error) {
            logger(`Error fetching punch list item ${itemId}: ${error instanceof Error ? error.message : error}`, 'PunchListRepo');
            throw new Error('Database error while fetching punch list item.');
        }
    }

    // Returns PunchListItemWithDetails now to include creator and media
    async createPunchListItem(itemData: schema.InsertPunchListItem): Promise<PunchListItemWithDetails | null> {
        logger(`Attempting to insert punch list item: ${JSON.stringify(itemData)}`, 'PunchListRepo');
        try {
            const result = await this.dbOrTx.insert(schema.punchListItems)
                .values({
                    ...itemData,
                    status: itemData.status ?? "open",
                })
                .returning({ id: schema.punchListItems.id });

            if (!result || result.length === 0) {
                logger('Insert operation returned no ID.', 'PunchListRepo');
                throw new Error("Failed to insert punch list item.");
            }
            const newItemId = result[0].id;
            logger(`Item inserted with ID: ${newItemId}`, 'PunchListRepo');

            // Fetch the created item with details
            const createdItem = await this._getPunchListItemWithDetails(newItemId);

            if (!createdItem) {
                logger(`Failed to fetch created item ${newItemId} with details after insert.`, 'PunchListRepo');
                return null;
            }
            logger(`Successfully fetched created item ${newItemId} with details.`, 'PunchListRepo');
            return createdItem;

        } catch (error: any) {
            logger(`Database error during punch list item creation: ${error.message}`, 'PunchListRepo');
            console.error("Original DB Error:", error); // Log the full error object

            if (error.code === '23503') { // FK violation
                throw new HttpError(400, 'Invalid project, creator, or assignee associated with the punch list item.');
            }
            throw new Error('Database error while creating punch list item.');
        }
    }

    async updatePunchListItem(itemId: number, itemData: Partial<Omit<schema.InsertPunchListItem, 'id' | 'projectId' | 'createdById'>>): Promise<schema.PunchListItem | null> {
        if (Object.keys(itemData).length === 0) {
            logger(`Update punch list item ${itemId} called with empty data.`, 'PunchListRepo');
            return this.dbOrTx.query.punchListItems.findFirst({ where: eq(schema.punchListItems.id, itemId)}) ?? null;
        }
        logger(`Attempting to update punch list item ${itemId} with data: ${JSON.stringify(itemData)}`, 'PunchListRepo');
        try {
            const result = await this.dbOrTx.update(schema.punchListItems)
                .set({
                    ...itemData,
                    resolvedAt: itemData.status === 'resolved' || itemData.status === 'verified' ? new Date() : (itemData.status ? null : undefined),
                    updatedAt: new Date(),
                })
                .where(eq(schema.punchListItems.id, itemId))
                .returning();

            logger(`Update result for item ${itemId}: ${result.length > 0 ? 'Success' : 'Not Found'}`, 'PunchListRepo');
            return result.length > 0 ? result[0] : null;
        } catch (error: any) {
            logger(`Database error during punch list item update for ID ${itemId}: ${error.message}`, 'PunchListRepo');
            console.error("Original DB Error:", error);
            throw new Error('Database error while updating punch list item.');
        }
    }

    async deletePunchListItem(itemId: number): Promise<boolean> {
        logger(`Attempting to delete punch list item ${itemId}`, 'PunchListRepo');
        const baseDb = ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction)
            ? db : this.dbOrTx as NeonDatabase<typeof schema>;

        try {
            return await baseDb.transaction(async (tx) => {
                // *** MODIFIED: Create a new MediaRepository instance using the transaction ***
                // This requires MediaRepository constructor to accept db/tx and dependencies
                // Assuming MediaRepository constructor is like: constructor(dbOrTx, mediaStorage, logger)
                const txMediaRepo = new MediaRepository(tx, this.mediaRepo['mediaStorage'], this.mediaRepo['logger']); // Access private members if needed, or adjust MediaRepo constructor

                logger(`Deleting associated media for punch list item ${itemId} within transaction...`, 'PunchListRepo');
                // *** MODIFIED: Call deleteMediaForPunchListItem on the transaction-aware instance ***
                await txMediaRepo.deleteMediaForPunchListItem(itemId);

                logger(`Deleting punch list item ${itemId} record within transaction...`, 'PunchListRepo');
                const result = await tx.delete(schema.punchListItems)
                    .where(eq(schema.punchListItems.id, itemId))
                    .returning({ id: schema.punchListItems.id });

                logger(`Deletion result for item ${itemId}: ${result.length > 0 ? 'Success' : 'Not Found'}`, 'PunchListRepo');
                return result.length > 0;
            });
        } catch (error: any) {
             logger(`Database error during punch list item deletion for ID ${itemId}: ${error.message}`, 'PunchListRepo');
             console.error("Original DB Error:", error);
             throw new Error('Database error while deleting punch list item.');
        }
    }
}

// --- REMOVED: Singleton export from this file ---
// export const punchListRepository: IPunchListRepository = new PunchListRepository(db, storage.media); // REMOVED
