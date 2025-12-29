// server/storage/repositories/document.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc, exists } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';

// Define interface for document relation output
interface DocumentWithRelations {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: string;
  uploadedById: number | null;
  createdAt: Date;
  uploader: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}

// Export the user-facing type with renamed field
export interface DocumentWithUploader {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: string;
  uploadedById: number | null;
  createdAt: Date;
  uploadedBy: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}


// Interface for Document Repository
export interface IDocumentRepository {
    // Returns documents with uploader details included
    getDocumentsForProject(projectId: number): Promise<DocumentWithUploader[]>;
    getAllDocuments(): Promise<DocumentWithUploader[]>; // Get all documents (admin only)
    getDocumentsForUser(userId: number | string): Promise<DocumentWithUploader[]>; // Get documents accessible to a user
    getDocumentById(documentId: number): Promise<schema.Document | null>; // Get raw document for delete logic
    createDocument(docData: schema.InsertDocument): Promise<schema.Document | null>; // Return basic doc
    deleteDocument(documentId: number): Promise<boolean>;
}

// Implementation
class DocumentRepository implements IDocumentRepository {
    private dbOrTx: NeonDatabase<typeof schema> | any; // Use 'any' for transaction type to avoid compatibility issues

    constructor(databaseOrTx: NeonDatabase<typeof schema> | any = db) {
        this.dbOrTx = databaseOrTx;
    }

    async getDocumentsForProject(projectId: number): Promise<DocumentWithUploader[]> {
        try {
            const documents = await this.dbOrTx.query.documents.findMany({
                where: eq(schema.documents.projectId, projectId),
                orderBy: [desc(schema.documents.createdAt)],
                with: { // Join with the user who uploaded the document
                    uploader: { // This should match the relation name in schema.ts
                        columns: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            });
            
            // Map the relation name from 'uploader' to 'uploadedBy' for consistency
            return documents.map((doc: DocumentWithRelations) => ({
                ...doc,
                uploadedBy: doc.uploader
            })) as DocumentWithUploader[];
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
            const documents = await this.dbOrTx.query.documents.findMany({
                orderBy: [desc(schema.documents.createdAt)],
                with: {
                    uploader: { // This should match the relation name in schema.ts
                        columns: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            });
            
            // Map the relation name from 'uploader' to 'uploadedBy' for consistency
            return documents.map((doc: DocumentWithRelations) => ({
                ...doc,
                uploadedBy: doc.uploader
            })) as DocumentWithUploader[];
        } catch (error) {
            console.error('Error fetching all documents:', error);
            throw new Error('Database error while fetching all documents.');
        }
    }

    async getDocumentsForUser(userId: number | string): Promise<DocumentWithUploader[]> {
        const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        
        try {
            // Get user's role first to determine access level
            const user = await this.dbOrTx.query.users.findFirst({
                where: eq(schema.users.id, numericUserId),
                columns: {
                    id: true,
                    role: true
                }
            });

            if (!user) {
                throw new Error('User not found.');
            }

            // Admin can see all documents
            if (user.role.toLowerCase() === 'admin') {
                return this.getAllDocuments();
            }

            // For project managers, get documents from projects they manage
            // For clients, get documents from projects they are clients of
            let documents = await this.dbOrTx.query.documents.findMany({
                where: or(
                    // Documents from projects the user manages
                    exists(
                        this.dbOrTx.select({ val: sql`1` })
                            .from(schema.projects)
                            .where(and(
                                eq(schema.projects.id, schema.documents.projectId),
                                eq(schema.projects.projectManagerId, numericUserId)
                            ))
                    ),
                    // Documents from projects the user is a client of
                    exists(
                        this.dbOrTx.select({ val: sql`1` })
                            .from(schema.clientProjects)
                            .where(and(
                                eq(schema.clientProjects.projectId, schema.documents.projectId),
                                eq(schema.clientProjects.clientId, numericUserId)
                            ))
                    )
                ),
                orderBy: [desc(schema.documents.createdAt)],
                with: {
                    uploader: { // This should match the relation name in schema.ts
                        columns: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        }
                    }
                }
            });

            // Filter by visibility for clients - they can only see published documents
            if (user.role.toLowerCase() === 'client') {
                documents = documents.filter(doc => doc.visibility === 'published');
            }

            // Map the relation name from 'uploader' to 'uploadedBy' for consistency
            return documents.map((doc: DocumentWithRelations) => ({
                ...doc,
                uploadedBy: doc.uploader
            })) as DocumentWithUploader[];
        } catch (error) {
            console.error(`Error fetching documents for user ${userId}:`, error);
            throw new Error('Database error while fetching user documents.');
        }
    }
}

// Export an instance for convenience
export const documentRepository = new DocumentRepository();