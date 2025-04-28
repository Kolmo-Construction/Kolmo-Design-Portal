// server/storage/repositories/media.repository.ts
import { NeonDatabase, PgTransaction } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';

// Interface for Media Repository
export interface IMediaRepository {
    // Creates a single media item, linking to EITHER progress update OR punch list item
    createMediaItem(mediaData: schema.InsertMedia): Promise<schema.MediaItem | null>;
    // Creates multiple media items (useful for bulk uploads)
    createMultipleMediaItems(mediaItemsData: schema.InsertMedia[]): Promise<schema.MediaItem[]>;
    // Deletes media items associated with a specific progress update
    deleteMediaForProgressUpdate(progressUpdateId: number, dbOrTxInstance?: NeonDatabase<typeof schema> | PgTransaction<any, any, any>): Promise<boolean>;
    // Deletes media items associated with a specific punch list item
    deleteMediaForPunchListItem(punchListItemId: number, dbOrTxInstance?: NeonDatabase<typeof schema> | PgTransaction<any, any, any>): Promise<boolean>;
    // Get storage keys for deletion from R2
    getMediaKeysForProgressUpdate(progressUpdateId: number): Promise<string[]>;
    getMediaKeysForPunchListItem(punchListItemId: number): Promise<string[]>;
}

// Implementation
class MediaRepository implements IMediaRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    async createMediaItem(mediaData: schema.InsertMedia): Promise<schema.MediaItem | null> {
         // Ensure only one foreign key (progressUpdateId or punchListItemId) is set
         if (mediaData.progressUpdateId && mediaData.punchListItemId) {
             throw new Error("Media item cannot be linked to both a progress update and a punch list item simultaneously.");
         }
         // Can add validation ensure one IS set if required by business logic.

        try {
            const result = await this.dbOrTx.insert(schema.mediaItems)
                .values(mediaData)
                .returning();
            return result.length > 0 ? result[0] : null;
        } catch (error: any) {
            console.error('Error creating media item:', error);
            if (error.code === '23503') { // FK violation
                 throw new HttpError(400, 'Invalid project, user, progress update, or punch list item associated with the media.');
            }
            throw new Error('Database error while creating media item.');
        }
    }

    async createMultipleMediaItems(mediaItemsData: schema.InsertMedia[]): Promise<schema.MediaItem[]> {
        if (mediaItemsData.length === 0) return [];
        try {
            // Basic validation (can be enhanced)
            mediaItemsData.forEach(item => {
                 if (item.progressUpdateId && item.punchListItemId) {
                    throw new Error("Media item cannot be linked to both a progress update and a punch list item simultaneously.");
                }
            });

            const result = await this.dbOrTx.insert(schema.mediaItems)
                .values(mediaItemsData)
                .returning();
            return result;
        } catch (error: any) {
             console.error('Error creating multiple media items:', error);
             if (error.code === '23503') { // FK violation
                 throw new HttpError(400, 'Invalid project, user, progress update, or punch list item associated with the media.');
             }
             throw new Error('Database error while creating media items.');
        }
    }

    // Helper to allow passing transaction instance easily
    private getDbInstance(dbOrTxInstance?: NeonDatabase<typeof schema> | PgTransaction<any, any, any>): NeonDatabase<typeof schema> | PgTransaction<any, any, any> {
        return dbOrTxInstance ?? this.dbOrTx;
    }


    async deleteMediaForProgressUpdate(progressUpdateId: number, dbOrTxInstance?: NeonDatabase<typeof schema> | PgTransaction<any, any, any>): Promise<boolean> {
        const instance = this.getDbInstance(dbOrTxInstance);
        try {
            const result = await instance.delete(schema.mediaItems)
                .where(eq(schema.mediaItems.progressUpdateId, progressUpdateId));
            // Drizzle delete doesn't always reliably return count, success determined by lack of error
            return true;
        } catch (error) {
             console.error(`Error deleting media for progress update ${progressUpdateId}:`, error);
             throw new Error('Database error while deleting progress update media.');
        }
    }

    async deleteMediaForPunchListItem(punchListItemId: number, dbOrTxInstance?: NeonDatabase<typeof schema> | PgTransaction<any, any, any>): Promise<boolean> {
         const instance = this.getDbInstance(dbOrTxInstance);
         try {
            await instance.delete(schema.mediaItems)
                .where(eq(schema.mediaItems.punchListItemId, punchListItemId));
            return true;
         } catch (error) {
            console.error(`Error deleting media for punch list item ${punchListItemId}:`, error);
            throw new Error('Database error while deleting punch list media.');
         }
    }

     async getMediaKeysForProgressUpdate(progressUpdateId: number): Promise<string[]> {
         const results = await this.dbOrTx.select({ storageKey: schema.mediaItems.storageKey })
            .from(schema.mediaItems)
            .where(eq(schema.mediaItems.progressUpdateId, progressUpdateId));
         return results.map(r => r.storageKey);
     }

     async getMediaKeysForPunchListItem(punchListItemId: number): Promise<string[]> {
         const results = await this.dbOrTx.select({ storageKey: schema.mediaItems.storageKey })
             .from(schema.mediaItems)
             .where(eq(schema.mediaItems.punchListItemId, punchListItemId));
         return results.map(r => r.storageKey);
     }
}

// Export an instance for convenience
export const mediaRepository = new MediaRepository();