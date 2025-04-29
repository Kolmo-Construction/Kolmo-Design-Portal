// server/storage/repositories/punchList.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';

// Relative path import from shared/schema.ts
import * as schema from '../../../shared/schema';

import { db } from '../../db'; // Import the database instance
import { HttpError } from '../../errors';
// Import updated types including the correct media relation - relative path
import { PunchListItemWithDetails } from '../types';
// Import Media Repository - using relative path and assuming the adjusted version that can handle transactions
import { MediaRepository, IMediaRepository } from './media.repository'; // Relative path to media.repository.ts

// Create MediaStorage class for media handling
class MediaStorage {
  async uploadFile(file: any): Promise<string> {
    return "dummy-url";
  }
  
  async deleteFile(url: string): Promise<void> {
    // No operation needed for now
  }
}

// Create a simple logger for the media repository
const simpleLogger = {
  log: (level: string, message: string) => {
    console.log(`[${level}] ${message}`);
  },
  logQuery: () => {} // Empty implementation to satisfy the Logger interface
};


// Import storage from the correct path
// Don't import storage to avoid circular dependency // Relative path to server/storage/index.ts


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
class PunchListRepository implements IPunchListRepository {
private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;
private mediaRepo: MediaRepository; // Use the class type for dependency injection

constructor(
databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db,
// Pass necessary dependencies for MediaRepository if not using a central factory/index
// For now, assuming mediaRepository singleton is initialized elsewhere or can be passed in.
mediaRepoInstance: MediaRepository // Accept an instance of the class
) {
this.dbOrTx = databaseOrTx;
// Initialize or assign mediaRepo - assuming it's initialized with DB and MediaStorage
        // If using a central storage index, you might get it like: storage.mediaRepository
        // For this example, assuming the instance is provided to the constructor
this.mediaRepo = mediaRepoInstance;
}

async getPunchListItemsForProject(projectId: number): Promise<PunchListItemWithDetails[]> {
  try {
    // First get the items without media to avoid schema issues
    const items = await this.dbOrTx.query.punchListItems.findMany({
      where: eq(schema.punchListItems.projectId, projectId),
      orderBy: [asc(schema.punchListItems.status), asc(schema.punchListItems.createdAt)], 
      with: {
        creator: { columns: { id: true, firstName: true, lastName: true } },
        assignee: { columns: { id: true, firstName: true, lastName: true } }
      }
    });
    
    // Process each item to get media separately
    const result = await Promise.all(items.map(async (item) => {
      // Get media for this item separately
      const media = await this.dbOrTx.query.updateMedia.findMany({
        where: eq(schema.updateMedia.punchListItemId, item.id),
        columns: {
          id: true,
          mediaUrl: true,
          mediaType: true,
          caption: true,
          uploadedById: true,
          createdAt: true
        }
      });
      
      // Return item with media
      return {
        ...item,
        media: media,
        mediaItems: media // For backwards compatibility
      };
    }));
    
    // Return with media included
    return result as PunchListItemWithDetails[];
  } catch (error) {
    console.error(`Error fetching punch list items for project ${projectId}:`, error);
    throw new Error('Database error while fetching punch list items.');
  }
}

async getPunchListItemById(itemId: number): Promise<PunchListItemWithDetails | null> {
  try {
    // Get punch list item without media to avoid schema issues
    const item = await this.dbOrTx.query.punchListItems.findFirst({
      where: eq(schema.punchListItems.id, itemId),
      with: {
        creator: { columns: { id: true, firstName: true, lastName: true } },
        assignee: { columns: { id: true, firstName: true, lastName: true } }
      }
    });
    
    // Check if item exists
    if (!item || !item.creator) return null;
    
    // Get media separately
    const media = await this.dbOrTx.query.updateMedia.findMany({
      where: eq(schema.updateMedia.punchListItemId, itemId),
      columns: {
        id: true,
        mediaUrl: true,
        mediaType: true,
        caption: true,
        uploadedById: true,
        createdAt: true
      }
    });
    
    // Return item with media
    return {
      ...item,
      media: media,
      mediaItems: media // For backwards compatibility
    } as PunchListItemWithDetails;
  } catch (error) {
    console.error(`Error fetching punch list item ${itemId}:`, error);
    throw new Error('Database error while fetching punch list item.');
  }
}

// Returns PunchListItemWithDetails now to include creator and media
async createPunchListItem(itemData: schema.InsertPunchListItem): Promise<PunchListItemWithDetails | null> {
try {
const result = await this.dbOrTx.insert(schema.punchListItems)
.values({
...itemData,
status: itemData.status ?? "open", // Default status based on schema
// photoUrl is not in schema, so no need to handle it here
})
.returning({ id: schema.punchListItems.id });

if (!result || result.length === 0) throw new Error("Failed to insert punch list item.");
const newItemId = result[0].id;

// Fetch the created item with creator, assignee, and media details
const createdItem = await this.getPunchListItemById(newItemId); // Use the existing get method


if (!createdItem || !createdItem.creator) { // Check creator instead of createdBy
                 // This case should be less likely if getPunchListItemById works correctly
                 console.error(`Failed to fetch created item ${newItemId} with details.`); // Kept original error logging
                 return null;
             }

return createdItem; // Return the item with full details

} catch (error: any) {
console.error('Error creating punch list item:', error); // Kept original error logging
if (error.code === '23503') { // FK violation
throw new HttpError(400, 'Invalid project or creator associated with the punch list item.'); // Kept original error throwing
}
throw new Error('Database error while creating punch list item.'); // Kept original error throwing
}
}

// Returns simpler object without media/creator as in original interface,
    // but fetches the full item after update for consistency if needed by caller
async updatePunchListItem(itemId: number, itemData: Partial<Omit<schema.InsertPunchListItem, 'id' | 'projectId' | 'createdById'>>): Promise<schema.PunchListItem | null> {
if (Object.keys(itemData).length === 0) {
console.warn("Update punch list item called with empty data."); // Kept original warning
// Fetch basic item details if no update data
return this.dbOrTx.query.punchListItems.findFirst({ where: eq(schema.punchListItems.id, itemId)}) ?? null;
}
try {
const result = await this.dbOrTx.update(schema.punchListItems)
.set({
...itemData,
                    // photoUrl is not in schema
resolvedAt: itemData.status === 'resolved' || itemData.status === 'verified' ? new Date() : (itemData.status ? null : undefined), // Set/clear resolvedAt based on status
updatedAt: new Date(), // Update timestamp on update
})
.where(eq(schema.punchListItems.id, itemId))
.returning(); // Return updated item basic details

return result.length > 0 ? result[0] : null; // Return basic details or null if not found
} catch (error) {
console.error(`Error updating punch list item ${itemId}:`, error); // Kept original error logging
throw new Error('Database error while updating punch list item.'); // Kept original error throwing
}
}

async deletePunchListItem(itemId: number): Promise<boolean> {
// Assumes R2 deletion is handled by caller *before* calling this. -> This comment is now outdated,
        // as MediaRepository handles R2 deletion within its delete methods.

// Determine the base database context if within a transaction
const baseDb = ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction)
? db : this.dbOrTx as NeonDatabase<typeof schema>;

// Execute deletion within a transaction to ensure atomicity (media + item deletion)
return baseDb.transaction(async (tx) => {
// Create a MediaRepository instance that uses the transaction context
const txMediaRepo = new MediaRepository(tx, this.mediaRepo['mediaStorage'], this.mediaRepo['logger']); // Pass dependencies

// 1. Delete associated media records and files using the transaction-aware mediaRepo
await txMediaRepo.deleteMediaForPunchListItem(itemId, tx); // Pass transaction explicitly (optional now, but good practice)

// 2. Delete the punch list item itself using the transaction context
const result = await tx.delete(schema.punchListItems)
.where(eq(schema.punchListItems.id, itemId))
.returning({ id: schema.punchListItems.id });

return result.length > 0; // Return true if an item was deleted, false otherwise
});
}
}

// Export an instance for convenience with its own MediaRepository instance
// Create a new MediaRepository instance for the PunchListRepository
const mediaRepoForPunchList = new MediaRepository(db, new MediaStorage(), simpleLogger);

// Export an instance using the locally created MediaRepository
export const punchListRepository: IPunchListRepository = new PunchListRepository(db, mediaRepoForPunchList);