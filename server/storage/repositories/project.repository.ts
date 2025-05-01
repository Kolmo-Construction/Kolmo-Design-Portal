// server/storage/repositories/project.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc, inArray, exists } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { ProjectWithDetails, ClientInfo, ProjectManagerInfo } from '../types';
// Import user repository if needed for complex checks, though checkUserProjectAccess fetches user directly now
// import { userRepository, IUserRepository } from './user.repository';

// Interface for Project Repository
export interface IProjectRepository {
    getAllProjects(): Promise<ProjectWithDetails[]>;
    getProjectsForUser(userId: string): Promise<ProjectWithDetails[]>;
    getProjectById(projectId: number): Promise<ProjectWithDetails | null>;
    getProject(projectId: number): Promise<schema.Project | null>; // Basic project without relations
    checkUserProjectAccess(userId: string, projectId: number): Promise<boolean>;
    createProjectWithClients(projectData: schema.InsertProject, clientIds: string[]): Promise<ProjectWithDetails | null>;
    updateProjectDetailsAndClients(projectId: number, projectData: Partial<Omit<schema.InsertProject, 'pmId' | 'id' | 'createdAt' | 'updatedAt'>>, clientIds?: string[]): Promise<ProjectWithDetails | null>;
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

    async createProjectWithClients(projectData: schema.InsertProject, clientIds: string[]): Promise<ProjectWithDetails | null> {
         if (!clientIds || clientIds.length === 0) {
            throw new Error("Cannot create project without assigning at least one client.");
         }
         // Use the db instance passed to the constructor for transaction
         return this.db.transaction(async (tx) => {
            const projectResult = await tx.insert(schema.projects).values(projectData).returning({ id: schema.projects.id });
            if (!projectResult || projectResult.length === 0) throw new Error("Failed to insert project.");
            const projectId = projectResult[0].id;

            const clientLinks = clientIds.map(clientId => ({ projectId, clientId }));
            await tx.insert(schema.clientProjects).values(clientLinks);

            // Use tx instance for query inside transaction
            const finalProject = await tx.query.projects.findFirst({
                where: eq(schema.projects.id, projectId),
                with: {
                    projectManager: { columns: { id: true, firstName: true, lastName: true, email: true } },
                    clientProjects: { with: { client: { columns: { id: true, firstName: true, lastName: true, email: true } } } }
                }
            });
            // Map using 'this' which refers to the class instance
            return finalProject ? this.mapProjectResult(finalProject) : null;
        });
    }

    async updateProjectDetailsAndClients(
            projectId: number,
            projectData: Partial<Omit<schema.InsertProject, 'pmId' | 'id' | 'createdAt' | 'updatedAt'>>,
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
                const newClientLinks = clientIds.map(clientId => ({ projectId, clientId }));
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
             // Assume ON DELETE CASCADE is set for related tables (tasks, documents, invoices, messages, etc.)
             // and for the join table projectsToClients from the project side.
             // If not, manual deletion is required here within a transaction.
            const result = await this.db.delete(schema.projects)
                .where(eq(schema.projects.id, projectId))
                .returning({ id: schema.projects.id });
            return result.length > 0;
        } catch (error) {
            console.error(`Error deleting project ${projectId}:`, error);
            throw new Error('Database error while deleting project.');
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