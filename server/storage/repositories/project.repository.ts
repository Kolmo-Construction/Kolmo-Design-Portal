// server/storage/repositories/project.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc, inArray, exists } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { ProjectWithDetails, ClientInfo, ProjectManagerInfo } from '../types';
import { sendEmail } from '../../email';
import { getBaseUrl } from '../../domain.config';
import { randomBytes } from 'crypto';
// Import user repository if needed for complex checks, though checkUserProjectAccess fetches user directly now
// import { userRepository, IUserRepository } from './user.repository';

// Interface for Project Repository
export interface IProjectRepository {
    getAllProjects(): Promise<ProjectWithDetails[]>;
    getProjectsForUser(userId: string): Promise<ProjectWithDetails[]>;
    getProjectsByManager(managerId: number): Promise<ProjectWithDetails[]>; // Get projects assigned to a specific project manager
    getProjectById(projectId: number): Promise<ProjectWithDetails | null>;
    getProjectByQuoteId(quoteId: number): Promise<schema.Project | null>; // Find project by origin quote ID
    getProject(projectId: number): Promise<schema.Project | null>; // Basic project without relations
    getProjectClients(projectId: number): Promise<ClientInfo[]>; // Get clients for a specific project
    checkUserProjectAccess(userId: string, projectId: number): Promise<boolean>;
    createProject(projectData: Omit<schema.InsertProject, 'totalBudget'> & { totalBudget: string }): Promise<schema.Project>; // Simple project creation for quote workflow
    createProjectWithClients(projectData: Omit<schema.InsertProject, 'totalBudget'> & { totalBudget: string }, clientIds: string[]): Promise<ProjectWithDetails | null>;
    updateProjectDetailsAndClients(projectId: number, projectData: Partial<Omit<schema.InsertProject, 'pmId' | 'id' | 'createdAt' | 'updatedAt' | 'totalBudget'>> & { totalBudget?: string }, clientIds?: string[]): Promise<ProjectWithDetails | null>;
    deleteProject(projectId: number): Promise<boolean>;
    
    // Method for backward compatibility
    assignClientToProject(clientId: string | number, projectId: string | number): Promise<any>;
}

// Implementation
class ProjectRepository implements IProjectRepository {
    private db: NeonDatabase<typeof schema>;
    // Optionally inject other repositories if needed
    // private userRepo: IUserRepository;

    constructor(database: NeonDatabase<typeof schema> = db /*, userRepoInstance: IUserRepository = userRepository */) {
        this.db = database;
        // this.userRepo = userRepoInstance;
    }

    // Helper moved inside the class or kept separate
    private mapProjectResult(project: any): ProjectWithDetails {
        const clients = project.clientProjects?.map((cp: any) => cp.client)
                                              .filter(Boolean)
                                              .map((c: any) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email })) || [];
        const projectManager = project.projectManager ? {
            id: project.projectManager.id, firstName: project.projectManager.firstName,
            lastName: project.projectManager.lastName, email: project.projectManager.email,
        } : null;
        const { clientProjects, ...projectBase } = project; // Exclude join table data
        return { ...projectBase, clients, projectManager };
    }

    async getAllProjects(): Promise<ProjectWithDetails[]> {
        try {
            const projects = await this.db.query.projects.findMany({
                orderBy: [desc(schema.projects.createdAt)],
                with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            return projects.map(p => this.mapProjectResult(p)); // Use class method
        } catch (error) {
            console.error('Error fetching all projects:', error);
            throw new Error('Database error while fetching projects.');
        }
    }

    async getProjectsForUser(userId: string): Promise<ProjectWithDetails[]> {
         try {
            const projects = await this.db.query.projects.findMany({
                where: or(
                    eq(schema.projects.projectManagerId, Number(userId)),
                    exists(this.db.select({ val: sql`1` }).from(schema.clientProjects)
                           .where(and(eq(schema.clientProjects.projectId, schema.projects.id), eq(schema.clientProjects.clientId, Number(userId)))))
                ),
                orderBy: [desc(schema.projects.createdAt)],
                with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            return projects.map(p => this.mapProjectResult(p));
        } catch (error) {
            console.error(`Error fetching projects for user ${userId}:`, error);
            throw new Error('Database error while fetching user projects.');
        }
    }

    async getProjectById(projectId: number): Promise<ProjectWithDetails | null> {
        try {
            const project = await this.db.query.projects.findFirst({
                where: eq(schema.projects.id, projectId),
                with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            return project ? this.mapProjectResult(project) : null;
        } catch (error) {
            console.error(`Error fetching project ${projectId}:`, error);
            throw new Error('Database error while fetching project.');
        }
    }
    
    async getProject(projectId: number): Promise<schema.Project | null> {
        try {
            const project = await this.db.query.projects.findFirst({
                where: eq(schema.projects.id, projectId)
            });
            return project || null;
        } catch (error) {
            console.error(`Error fetching project ${projectId}:`, error);
            throw new Error('Database error while fetching project.');
        }
    }

    async getProjectByQuoteId(quoteId: number): Promise<schema.Project | null> {
        try {
            const project = await this.db.query.projects.findFirst({
                where: eq(schema.projects.originQuoteId, quoteId)
            });
            return project || null;
        } catch (error) {
            console.error(`Error fetching project by quote ID ${quoteId}:`, error);
            throw new Error('Database error while fetching project by quote ID.');
        }
    }

    async checkUserProjectAccess(userId: string, projectId: number): Promise<boolean> {
         try {
            // Fetch minimal user role info directly
            const userRoleResult = await this.db.select({ role: schema.users.role })
                                          .from(schema.users)
                                          .where(eq(schema.users.id, Number(userId)))
                                          .limit(1);
            if (userRoleResult.length > 0 && userRoleResult[0].role.toLowerCase() === 'admin') {
                return true;
            }

            const project = await this.db.query.projects.findFirst({
                where: eq(schema.projects.id, projectId),
                columns: { id: true, projectManagerId: true },
                with: { clientProjects: { columns: { clientId: true } } }
            });

            if (!project) return false;
            if (project.projectManagerId === Number(userId)) return true;
            if (project.clientProjects?.some(c => c.clientId === Number(userId))) return true;

            return false;
        } catch (error) {
            console.error(`Error checking access for user ${userId} to project ${projectId}:`, error);
            throw new Error('Database error while checking project access.');
        }
    }

    async createProject(projectData: Omit<schema.InsertProject, 'totalBudget'> & { totalBudget: string }): Promise<schema.Project> {
        try {
            const result = await this.db.insert(schema.projects)
                .values([projectData])
                .returning();
            
            if (!result || result.length === 0) {
                throw new Error("Failed to create project.");
            }
            
            return result[0];
        } catch (error) {
            console.error('Error creating project:', error);
            throw new Error('Database error while creating project.');
        }
    }

    async createProjectWithClients(projectData: Omit<schema.InsertProject, 'totalBudget'> & { totalBudget: string }, clientIds: string[]): Promise<ProjectWithDetails | null> {
         if (!clientIds || clientIds.length === 0) {
            throw new Error("Cannot create project without assigning at least one client.");
         }
         // Use the db instance passed to the constructor for transaction
         return this.db.transaction(async (tx) => {
            const projectResult = await tx.insert(schema.projects).values(projectData).returning({ id: schema.projects.id });
            if (!projectResult || projectResult.length === 0) throw new Error("Failed to insert project.");
            const projectId = projectResult[0].id;

            const clientLinks = clientIds.map(clientId => ({ projectId, clientId: parseInt(clientId.toString()) }));
            await tx.insert(schema.clientProjects).values(clientLinks);

            // Automatically ensure all assigned clients have 'client' role and are activated
            const clientUsers = [];
            for (const clientId of clientIds) {
                const clientIdNum = parseInt(clientId.toString());
                
                // Get client details for notification
                const clientUser = await tx.query.users.findFirst({
                    where: eq(schema.users.id, clientIdNum)
                });
                
                if (clientUser) {
                    clientUsers.push(clientUser);
                    
                    // Update client role to 'client' if not already set and activate their account
                    await tx.update(schema.users)
                        .set({ 
                            role: 'client', 
                            isActivated: true,
                            updatedAt: new Date()
                        })
                        .where(eq(schema.users.id, clientIdNum));
                }
            }

            console.log(`✓ Client portal access automatically created for project ${projectId} with ${clientIds.length} clients`);

            // Use tx instance for query inside transaction
            const finalProject = await tx.query.projects.findFirst({
                where: eq(schema.projects.id, projectId),
                with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            
            const result = finalProject ? this.mapProjectResult(finalProject) : null;
            
            // Return both the project result and client users for email notifications
            return { result, clientUsers, projectName: projectData.name || 'Your Project' };
        }).then(async (transactionResult) => {
            // Portal notifications are now handled by PaymentService to prevent duplicate emails
            // Automatic portal notifications disabled to avoid sending multiple magic links
            console.log(`✓ Project created with ${transactionResult?.clientUsers?.length || 0} clients - portal notifications handled by payment service`);
            
            return transactionResult?.result || null;
        });
    }

    async updateProjectDetailsAndClients(
            projectId: number,
            projectData: Partial<Omit<schema.InsertProject, 'pmId' | 'id' | 'createdAt' | 'updatedAt' | 'totalBudget'>> & { totalBudget?: string },
            clientIds?: string[]
        ): Promise<ProjectWithDetails | null> {
         // Use the db instance passed to the constructor for transaction
         return this.db.transaction(async (tx) => {
            if (Object.keys(projectData).length > 0) {
                await tx.update(schema.projects).set({ ...projectData, updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
            }
            if (clientIds !== undefined) {
                if (clientIds.length === 0) throw new Error("Cannot update project to have zero clients.");
                await tx.delete(schema.clientProjects).where(eq(schema.clientProjects.projectId, projectId));
                const newClientLinks = clientIds.map(clientId => ({ projectId, clientId: parseInt(clientId.toString()) }));
                await tx.insert(schema.clientProjects).values(newClientLinks);
            }

            const finalProject = await tx.query.projects.findFirst({
                where: eq(schema.projects.id, projectId),
                 with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            if (!finalProject) throw new HttpError(404, 'Project not found during update.');
             // Map using 'this' which refers to the class instance
            return this.mapProjectResult(finalProject);
        });
    }

    async deleteProject(projectId: number): Promise<boolean> {
        try {
            console.log(`[deleteProject] Starting deletion of project ${projectId}`);

            // Use a transaction and delete each table with raw SQL to avoid ORM issues
            // Delete in order to respect foreign key constraints
            await this.db.transaction(async (tx) => {
                const operations = [
                    // 1. Delete payments first (references invoices)
                    { name: 'payments', sql: sql`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE project_id = ${projectId})` },

                    // 2. Delete tasks before invoices (tasks.invoiceId references invoices)
                    { name: 'tasks', sql: sql`DELETE FROM tasks WHERE project_id = ${projectId}` },

                    // 3. Delete tables that reference projects directly
                    { name: 'client_projects', sql: sql`DELETE FROM client_projects WHERE project_id = ${projectId}` },
                    { name: 'documents', sql: sql`DELETE FROM documents WHERE project_id = ${projectId}` },
                    { name: 'messages', sql: sql`DELETE FROM messages WHERE project_id = ${projectId}` },
                    { name: 'progress_report_summaries', sql: sql`DELETE FROM progress_report_summaries WHERE project_id = ${projectId}` },
                    { name: 'progress_updates', sql: sql`DELETE FROM progress_updates WHERE project_id = ${projectId}` },
                    { name: 'milestones', sql: sql`DELETE FROM milestones WHERE project_id = ${projectId}` },
                    { name: 'selections', sql: sql`DELETE FROM selections WHERE project_id = ${projectId}` },

                    // 4. Delete invoices after payments and tasks
                    { name: 'invoices', sql: sql`DELETE FROM invoices WHERE project_id = ${projectId}` },

                    // 5. Delete tables with cascade (for consistency)
                    { name: 'daily_logs', sql: sql`DELETE FROM daily_logs WHERE project_id = ${projectId}` },
                    { name: 'punch_list_items', sql: sql`DELETE FROM punch_list_items WHERE project_id = ${projectId}` },
                    { name: 'project_versions', sql: sql`DELETE FROM project_versions WHERE project_id = ${projectId}` },

                    // 6. Nullify nullable references to project
                    { name: 'admin_images (nullify)', sql: sql`UPDATE admin_images SET project_id = NULL WHERE project_id = ${projectId}` },
                    { name: 'design_proposals (nullify)', sql: sql`UPDATE design_proposals SET project_id = NULL WHERE project_id = ${projectId}` },

                    // 7. Finally delete the project itself
                    { name: 'projects', sql: sql`DELETE FROM projects WHERE id = ${projectId}` }
                ];

                for (const operation of operations) {
                    try {
                        console.log(`[deleteProject] Executing operation: ${operation.name} for project ${projectId}`);
                        await tx.execute(operation.sql);
                    } catch (error) {
                        console.error(`[deleteProject] Failed operation: ${operation.name}:`, error);
                        console.error(`[deleteProject] Error details:`, JSON.stringify(error, null, 2));
                        // Re-throw to abort transaction
                        throw error;
                    }
                }
            });

            console.log(`[deleteProject] Successfully deleted project ${projectId}`);
            return true;
        } catch (error) {
            console.error(`[deleteProject] Error deleting project ${projectId}:`, error);
            throw new Error('Database error while deleting project.');
        }
    }
    
    // DISABLED: Send email notification to client about new portal access with magic link
    // This function has been disabled to prevent duplicate magic links during payment processing
    // Portal notifications are now handled exclusively by PaymentService
    private async sendClientPortalNotification(client: any, projectName: string): Promise<void> {
        console.log(`✓ Portal notification DISABLED for ${client.firstName} ${client.lastName} (${client.email}) - handled by payment service`);
        // Email sending disabled to prevent duplicates during down payment flow
        return;
    }

    // Generate a unique token for magic links using proper UUID v4
    private generateMagicLinkToken(): string {
        const bytes = randomBytes(16);
        
        // Set version (4) and variant bits according to RFC 4122
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
        
        // Format as UUID string
        const hex = bytes.toString('hex');
        return [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32)
        ].join('-');
    }

    // Calculate expiry time (default: 5 months from now)
    private getMagicLinkExpiry(months = 5): Date {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + months);
        return expiryDate;
    }

    // Get all projects assigned to a specific project manager
    async getProjectsByManager(managerId: number): Promise<ProjectWithDetails[]> {
        try {
            const projects = await this.db.query.projects.findMany({
                where: eq(schema.projects.projectManagerId, managerId),
                orderBy: [desc(schema.projects.updatedAt)],
                with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            return projects.map(this.mapProjectResult);
        } catch (error) {
            console.error(`Error fetching projects for manager ${managerId}:`, error);
            throw new Error('Database error while fetching projects for manager.');
        }
    }

    // Get clients for a specific project
    async getProjectClients(projectId: number): Promise<ClientInfo[]> {
        try {
            const clientProjects = await this.db.query.clientProjects.findMany({
                where: eq(schema.clientProjects.projectId, projectId),
                with: {
                    client: { columns: { id: true, firstName: true, lastName: true, email: true, phone: true } }
                }
            });
            
            return clientProjects.map(cp => ({
                id: cp.client.id,
                firstName: cp.client.firstName,
                lastName: cp.client.lastName,
                email: cp.client.email,
                phone: cp.client.phone
            }));
        } catch (error) {
            console.error(`Error fetching clients for project ${projectId}:`, error);
            throw new Error('Database error while fetching project clients.');
        }
    }

    // Method for backward compatibility
    async assignClientToProject(clientId: string | number, projectId: string | number): Promise<any> {
        try {
            // Convert IDs to strings for consistency
            const clientIdNum = Number(clientId);
            const projectIdNum = Number(projectId);
            
            // Check if association already exists
            const existing = await this.db.query.clientProjects.findFirst({
                where: and(
                    eq(schema.clientProjects.clientId, clientIdNum),
                    eq(schema.clientProjects.projectId, projectIdNum)
                )
            });
            
            if (existing) {
                return existing; // Return existing association
            }
            
            // Create new association
            const result = await this.db.insert(schema.clientProjects)
                .values({ 
                    clientId: clientIdNum,
                    projectId: projectIdNum 
                })
                .returning();
                
            return result[0];
        } catch (error) {
            console.error(`Error assigning client ${clientId} to project ${projectId}:`, error);
            throw new Error('Database error while assigning client to project.');
        }
    }
}

// Export an instance for convenience
export const projectRepository = new ProjectRepository();
