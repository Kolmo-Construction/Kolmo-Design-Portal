// server/storage/repositories/document.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
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
    getAllDocuments(): Promise<DocumentWithUploader[]>; // Get all documents (for admin)
    getDocumentsForUser(userId: number): Promise<DocumentWithUploader[]>; // Get documents for user (based on their projects)
}

// Implementation
class DocumentRepository implements IDocumentRepository {
    private dbOrTx: NeonDatabase<typeof schema> | any;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | any = db) {
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

    async getAllDocuments(): Promise<DocumentWithUploader[]> {
        try {
            // Fetch documents first
            const documents = await this.dbOrTx.select().from(schema.documents)
                .orderBy(desc(schema.documents.createdAt));
            
            // Then fetch uploader info separately for each document
            const documentsWithUploader: DocumentWithUploader[] = [];
            
            for (const doc of documents) {
                let uploadedBy = null;
                
                if (doc.uploadedById) {
                    const uploader = await this.dbOrTx.select({
                        id: schema.users.id,
                        firstName: schema.users.firstName,
                        lastName: schema.users.lastName
                    }).from(schema.users)
                    .where(eq(schema.users.id, doc.uploadedById))
                    .then(result => result[0] || null);
                    
                    uploadedBy = uploader;
                }
                
                documentsWithUploader.push({
                    ...doc,
                    uploadedBy
                });
            }
            
            return documentsWithUploader;
        } catch (error) {
            console.error('Error fetching all documents:', error);
            throw new Error('Database error while fetching all documents.');
        }
    }

    async getDocumentsForUser(userId: number): Promise<DocumentWithUploader[]> {
        try {
            // First, get all projects the user is associated with
            const userProjects = await this.dbOrTx.query.clientProjects.findMany({
                where: eq(schema.clientProjects.clientId, userId),
                columns: {
                    projectId: true
                }
            });
            
            // Also check if the user is a project manager for any projects
            const managedProjects = await this.dbOrTx.query.projects.findMany({
                where: eq(schema.projects.projectManagerId, userId),
                columns: {
                    id: true
                }
            });
            
            // Combine all project IDs
            const projectIds = [
                ...userProjects.map((p: { projectId: number }) => p.projectId),
                ...managedProjects.map((p: { id: number }) => p.id)
            ];
            
            // If user has no projects, return empty array
            if (projectIds.length === 0) {
                return [];
            }
            
            // Get documents for all these projects - using a simplified approach
            // Fetch documents first
            const documents = await this.dbOrTx.select().from(schema.documents)
                .where(sql`${schema.documents.projectId} IN (${sql.join(projectIds, sql`, `)})`)
                .orderBy(desc(schema.documents.createdAt));
            
            // Then fetch uploader info separately for each document
            const documentsWithUploader: DocumentWithUploader[] = [];
            
            for (const doc of documents) {
                let uploadedBy = null;
                
                if (doc.uploadedById) {
                    const uploader = await this.dbOrTx.select({
                        id: schema.users.id,
                        firstName: schema.users.firstName,
                        lastName: schema.users.lastName
                    }).from(schema.users)
                    .where(eq(schema.users.id, doc.uploadedById))
                    .then(result => result[0] || null);
                    
                    uploadedBy = uploader;
                }
                
                documentsWithUploader.push({
                    ...doc,
                    uploadedBy
                });
            }
            
            return documentsWithUploader;
            
        } catch (error) {
            console.error(`Error fetching documents for user ${userId}:`, error);
            throw new Error('Database error while fetching user documents.');
        }
    }
}

// Export an instance for convenience
export const documentRepository = new DocumentRepository();