// server/storage/repositories/document.repository.ts
import { NeonDatabase, PgTransaction } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
// Import shared types if needed for complex return values, though document schema is simpler
// import { ... } from '../types';

// Define a specific type for Document with Uploader info if needed
export type DocumentWithUploader = schema.Document & {
    uploadedBy: Pick<schema.User, 'id' | 'firstName' | 'lastName'> | null; // Uploader might be null if user deleted? Handle this case.
};


// Interface for Document Repository
export interface IDocumentRepository {
    // Returns documents with uploader details included
    getDocumentsForProject(projectId: number): Promise<DocumentWithUploader[]>;
    getDocumentById(documentId: number): Promise<schema.Document | null>; // Get raw document for delete logic
    createDocument(docData: schema.InsertDocument): Promise<schema.Document | null>; // Return basic doc
    deleteDocument(documentId: number): Promise<boolean>;
}

// Implementation
class DocumentRepository implements IDocumentRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    async getDocumentsForProject(projectId: number): Promise<DocumentWithUploader[]> {
        try {
            const documents = await this.dbOrTx.query.documents.findMany({
                where: eq(schema.documents.projectId, projectId),
                orderBy: [desc(schema.documents.createdAt)],
                with: { // Join with the user who uploaded the document
                    uploadedBy: {
                        columns: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            });
            // Cast to the specific type, ensuring uploadedBy is handled (can be null if user deleted)
            return documents as DocumentWithUploader[];
        } catch (error) {
            console.error(`Error fetching documents for project ${projectId}:`, error);
            throw new Error('Database error while fetching documents.');
        }
    }

    async getDocumentById(documentId: number): Promise<schema.Document | null> {
        try {
            const document = await this.dbOrTx.query.documents.findFirst({
                where: eq(schema.documents.id, documentId),
            });
            return document ?? null;
        } catch (error) {
            console.error(`Error fetching document ${documentId}:`, error);
            throw new Error('Database error while fetching document.');
        }
    }

    async createDocument(docData: schema.InsertDocument): Promise<schema.Document | null> {
        try {
            const result = await this.dbOrTx.insert(schema.documents)
                .values(docData)
                .returning(); // Return all columns of the inserted document

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error creating document:', error);
            // Handle potential FK violations (e.g., projectId or uploadedBy doesn't exist)
            if ((error as any).code === '23503') {
                 throw new HttpError(400, 'Invalid project or user associated with the document.');
            }
            throw new Error('Database error while creating document.');
        }
    }

    async deleteDocument(documentId: number): Promise<boolean> {
        // Note: Deleting the associated file from R2 storage should be handled
        // by the controller/service *before* calling this repository method.
        try {
            const result = await this.dbOrTx.delete(schema.documents)
                .where(eq(schema.documents.id, documentId))
                .returning({ id: schema.documents.id }); // Check if a row was actually deleted

            return result.length > 0; // Return true if a row was deleted
        } catch (error) {
            console.error(`Error deleting document ${documentId}:`, error);
            throw new Error('Database error while deleting document.');
        }
    }
}

// Export an instance for convenience
export const documentRepository = new DocumentRepository();