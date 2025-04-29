// server/storage/repositories/media.repository.ts
import { db as database } from "../../db"; 
import { Logger } from "drizzle-orm"; 
import { eq, inArray } from "drizzle-orm"; 
import { NeonDatabase } from 'drizzle-orm/neon-serverless'; 

// Mock MediaStorage for now as we fix the import
class MediaStorage {
  async uploadFile(file: any): Promise<string> {
    return "dummy-url";
  }
  
  async deleteFile(url: string): Promise<void> {
    // No operation needed for now
  }
}

// Changed import from '@/shared/schema' to a relative path
import * as schema from '../../../shared/schema'; // Relative path to shared/schema.ts
import { InsertUpdateMedia, updateMedia } from '../../../shared/schema'; // Relative path to shared/schema.ts


// Update the IMediaRepository interface if you use one elsewhere to reflect transaction parameter if you use one
// For simplicity, we'll adjust the class methods directly for now.

export class MediaRepository {
  // Adjusted constructor to potentially accept a transaction
   constructor(
     private dbOrTx: NeonDatabase<any> | any = database, 
     private mediaStorage: MediaStorage = new MediaStorage(), 
     private logger: any = { log: console.log }
   ) {}


  async createMedia(data: InsertUpdateMedia) {
    if (!data.updateId && !data.punchListItemId) {
        throw new Error("Either updateId or punchListItemId must be provided");
    }
    const result = await this.dbOrTx.insert(updateMedia).values(data).returning();
    return result[0];
  }

  async getMediaForUpdate(updateId: number) {
    return this.dbOrTx.query.updateMedia.findMany({
      where: eq(updateMedia.updateId, updateId),
    });
  }

  async getMediaForPunchListItem(punchListItemId: number) {
      return this.dbOrTx.query.updateMedia.findMany({
          where: eq(updateMedia.punchListItemId, punchListItemId),
      });
  }


   // Adjusted to accept an optional transaction object (though constructor handles it now)
  async deleteMedia(mediaId: number, tx?: any) {
    const dbContext = tx || this.dbOrTx; // Use transaction if provided, else use constructor's db

    const mediaToDelete = await dbContext.query.updateMedia.findFirst({
        where: eq(updateMedia.id, mediaId),
        columns: {
            mediaUrl: true,
        }
    });

    if (!mediaToDelete) {
        this.logger.log("info", `Media with ID ${mediaId} not found for deletion.`);
        return null;
    }

    try {
        await this.mediaStorage.deleteFile(mediaToDelete.mediaUrl);
        this.logger.log("info", `Deleted media file: ${mediaToDelete.mediaUrl}`);
    } catch (error) {
        this.logger.log("error", `Failed to delete media file ${mediaToDelete.mediaUrl}: ${error}`);
        throw new Error(`Failed to delete media file: ${error}`);
    }

    const result = await dbContext.delete(updateMedia).where(eq(updateMedia.id, mediaId)).returning();

    if (result.length === 0) {
        this.logger.log("info", `Media record with ID ${mediaId} not found in DB after file deletion.`);
        return null;
    }

    return result[0];
  }

   // Adjusted to accept an optional transaction object
  async deleteMediaForUpdate(updateId: number, tx?: PgTransaction<any, any, any>) {
    const dbContext = tx || this.dbOrTx;

    const mediaToDelete = await dbContext.query.updateMedia.findMany({
        where: eq(updateMedia.updateId, updateId),
        columns: {
            id: true,
            mediaUrl: true,
        }
    });

    if (mediaToDelete.length === 0) {
        this.logger.log("info", `No media found for update ID ${updateId} for deletion.`);
        return;
    }

    for (const media of mediaToDelete) {
        try {
            await this.mediaStorage.deleteFile(media.mediaUrl);
            this.logger.log("info", `Deleted media file: ${media.mediaUrl}`);
        } catch (error) {
            this.logger.log("error", `Failed to delete media file ${media.mediaUrl} for update ID ${updateId}: ${error}`);
             throw new Error(`Failed to delete one or more media files for update ID ${updateId}: ${error}`);
        }
    }

    const mediaIds = mediaToDelete.map(media => media.id);
     if (mediaIds.length > 0) {
         await dbContext.delete(updateMedia).where(inArray(updateMedia.id, mediaIds));
         this.logger.log("info", `Deleted ${mediaIds.length} media records for update ID ${updateId}.`);
     }
  }

   // Adjusted to accept an optional transaction object
  async deleteMediaForPunchListItem(punchListItemId: number, tx?: PgTransaction<any, any, any>) {
        const dbContext = tx || this.dbOrTx;

        const mediaToDelete = await dbContext.query.updateMedia.findMany({
            where: eq(updateMedia.punchListItemId, punchListItemId),
            columns: {
                id: true,
                mediaUrl: true,
            }
        });

        if (mediaToDelete.length === 0) {
            this.logger.log("info", `No media found for punch list item ID ${punchListItemId} for deletion.`);
            return;
        }

        for (const media of mediaToDelete) {
            try {
                await this.mediaStorage.deleteFile(media.mediaUrl);
                this.logger.log("info", `Deleted media file: ${media.mediaUrl}`);
            } catch (error) {
                this.logger.log("error", `Failed to delete media file ${media.mediaUrl} for punch list item ID ${punchListItemId}: ${error}`);
                 throw new Error(`Failed to delete one or more media files for punch list item ID ${punchListItemId}: ${error}`);
            }
        }

        const mediaIds = mediaToDelete.map(media => media.id);
         if (mediaIds.length > 0) {
             await dbContext.delete(updateMedia).where(inArray(updateMedia.id, mediaIds));
             this.logger.log("info", `Deleted ${mediaIds.length} media records for punch list item ID ${punchListItemId}.`);
         }
    }


  async getMediaKeysForPunchListItem(punchListItemId: number): Promise<string[]> {
    const media = await this.dbOrTx.query.updateMedia.findMany({
      where: eq(updateMedia.punchListItemId, punchListItemId),
      columns: {
        mediaUrl: true,
      },
    });
    return media.map((m) => m.mediaUrl);
  }

    async getMediaKeysForUpdate(updateId: number): Promise<string[]> {
        const media = await this.dbOrTx.query.updateMedia.findMany({
            where: eq(updateMedia.updateId, updateId),
            columns: {
                mediaUrl: true,
            },
        });
        return media.map((m) => m.mediaUrl);
    }
}

// Export an interface for dependency injection
export interface IMediaRepository {
  createMedia(data: InsertUpdateMedia): Promise<schema.UpdateMedia>;
  deleteMediaForUpdate(updateId: number, tx?: any): Promise<void>;
  deleteMediaForPunchListItem(punchListItemId: number, tx?: any): Promise<void>;
  getMediaKeysForPunchListItem(punchListItemId: number): Promise<string[]>;
  getMediaKeysForUpdate(updateId: number): Promise<string[]>;
}

// Export a singleton instance
// Create a custom logger function that matches what the methods use
const simpleLogger = {
  log: (level: string, message: string) => {
    console.log(`[${level}] ${message}`);
  },
  logQuery: () => {} // Empty implementation to satisfy the Logger interface
};

// Create and export the instance with defaults
export const mediaRepository: IMediaRepository = new MediaRepository(database, new MediaStorage(), simpleLogger);