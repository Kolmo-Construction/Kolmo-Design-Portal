// server/storage/repositories/project.repository.ts
import { db } from '../../db';
import { projects, users, type NewProject, type Project } from '../../../shared/schema';
import { eq, desc, inArray, sql, type SQL } from 'drizzle-orm';
// Import the specific types needed from storage/types.ts
import type { AuthenticatedUser, ProjectWithManagerAndClients } from '../types';
import { HttpError } from '../../errors';

// Interface (optional but good practice, ensure it matches the class methods)
export interface IProjectRepository {
    findForUser(user: AuthenticatedUser): Promise<ProjectWithManagerAndClients[]>;
    findById(id: string): Promise<ProjectWithManagerAndClients | null>;
    create(projectData: NewProject): Promise<Project>; // Returns base project type
    update(id: string, projectData: Partial<NewProject>): Promise<Project | null>; // Returns base project type or null
    delete(id: string): Promise<boolean>;
    getAllProjects(): Promise<Project[]>;
    assignClientToProject?(userId: string, projectId: string): Promise<boolean>; // Optional for now
}

export class ProjectRepository implements IProjectRepository {

    /**
     * Finds projects accessible to a given user based on their role.
     * Includes Project Manager name and associated Client names.
     * @param user - The authenticated user object containing id and role.
     * @returns A promise resolving to an array of projects with details.
     */
    async findForUser(user: AuthenticatedUser): Promise<ProjectWithManagerAndClients[]> {
        console.log(`[ProjectRepository] Finding projects for user ID: ${user.id}, Role: ${user.role}`);
        let whereCondition: SQL | undefined = undefined;

        // --- ROLE-BASED FILTERING ---
        if (user.role === 'project_manager') {
            // Project managers see projects where they are assigned
            whereCondition = eq(projects.projectManagerId, user.id);
            console.log(`[ProjectRepository] Applying filter for project_manager: projectManagerId = ${user.id}`);
        } else if (user.role === 'client') {
            // Clients see projects where their ID is in the clientIds array
            // Using PostgreSQL specific array containment syntax: '<value> = ANY(<array_column>)'
            // Ensure user.id is cast correctly if your IDs are UUIDs in the DB
            whereCondition = sql`${user.id}::uuid = ANY (${projects.clientIds})`;
            console.log(`[ProjectRepository] Applying filter for client: ${user.id} = ANY (clientIds)`);
        }
        // Admins (user.role === 'admin') get no 'whereCondition', fetching all projects
        else if (user.role === 'admin') {
             console.log(`[ProjectRepository] No filter applied for admin user.`);
        } else {
            console.warn(`[ProjectRepository] Unknown user role encountered: ${user.role}. Returning empty array.`);
            return []; // Handle unknown roles gracefully
        }
        // --- END ROLE-BASED FILTERING ---

        try {
            // 1. Fetch projects with project manager details using the defined relation
            const fetchedProjects = await db.query.projects.findMany({
                where: whereCondition,
                with: {
                    projectManager: { // Assumes relation named 'projectManager' is defined in schema.ts
                        columns: {
                            // Select only necessary fields, e.g., firstName/lastName
                            firstName: true,
                            lastName: true,
                            // id: true, // Include ID if needed elsewhere
                        },
                    },
                },
                orderBy: (p) => [desc(p.createdAt)], // Use alias 'p' for clarity
            });
            console.log(`[ProjectRepository] Fetched ${fetchedProjects.length} project(s) initially.`);


            if (!fetchedProjects || fetchedProjects.length === 0) {
                return []; // Return early if no projects found
            }

            // 2. Extract unique client IDs from all fetched projects
            // Ensure clientIds is treated as an array, even if null/undefined, and filter null IDs
            const allClientIds = fetchedProjects.flatMap(p => p.clientIds || []).filter(id => id != null);
            const uniqueClientIds = [...new Set(allClientIds)];
            console.log(`[ProjectRepository] Unique client IDs found: ${uniqueClientIds.length > 0 ? uniqueClientIds.join(', ') : 'None'}`);


            // 3. Fetch client details if there are any client IDs
            let clientsMap = new Map<string, { firstName: string | null, lastName: string | null }>();
            if (uniqueClientIds.length > 0) {
                const clientUsers = await db.query.users.findMany({
                    where: inArray(users.id, uniqueClientIds),
                    columns: {
                        id: true,
                        firstName: true, 
                        lastName: true,
                    },
                });
                clientsMap = new Map(clientUsers.map(c => [c.id, { firstName: c.firstName, lastName: c.lastName }]));
                console.log(`[ProjectRepository] Fetched details for ${clientsMap.size} clients.`);
            }

            // 4. Map client names back to the project objects
            const projectsWithDetails: ProjectWithManagerAndClients[] = fetchedProjects.map(p => {
                // Ensure p.clientIds is treated as an array, filter nulls/undefineds
                const clientNames = (p.clientIds || [])
                    .filter(id => id != null) // Filter out potential nulls in the array
                    .map(clientId => {
                        const client = clientsMap.get(clientId!);
                        if (client && (client.firstName || client.lastName)) {
                            return `${client.firstName || ''} ${client.lastName || ''}`.trim();
                        }
                        return null;
                    })
                    .filter((name): name is string => name !== null && name !== undefined); // Type guard

                // Create a project manager name from firstName and lastName
                let projectManagerName = null;
                if (p.projectManager) {
                    if (p.projectManager.firstName || p.projectManager.lastName) {
                        projectManagerName = `${p.projectManager.firstName || ''} ${p.projectManager.lastName || ''}`.trim();
                    }
                }

                return {
                    ...p, // Spread the original project data
                    projectManagerName, 
                    clientNames, // Assign the array of client names
                 };
            });

            console.log(`[ProjectRepository] Returning ${projectsWithDetails.length} project(s) with details.`);
            return projectsWithDetails;

        } catch (error) {
            console.error(`[ProjectRepository] Error in findForUser for user ${user.id}:`, error);
            // Re-throw or handle as appropriate for your application structure
            throw new Error(`Database error while fetching projects for user ${user.id}.`);
        }
    }

    /**
     * Finds a single project by its ID, including manager and client names.
     * Note: Authorization should be checked in the controller/service layer.
     * @param id - The UUID of the project to find.
     * @returns A promise resolving to the project with details or null if not found.
     */
    async findById(id: string): Promise<ProjectWithManagerAndClients | null> {
         console.log(`[ProjectRepository] Finding project by ID: ${id}`);
         try {
            const project = await db.query.projects.findFirst({
                where: eq(projects.id, id),
                with: {
                    projectManager: {
                        columns: { 
                            firstName: true,
                            lastName: true,
                        },
                    },
                    // Include other relations here if needed for a full detail view
                    // e.g., documents: true, tasks: true, etc.
                },
            });

            if (!project) {
                console.log(`[ProjectRepository] Project with ID ${id} not found.`);
                return null;
            }

            // Fetch client names separately
            let clientNames: string[] = [];
            const clientIds = (project.clientIds || []).filter(id => id != null); // Ensure array and filter nulls
            if (clientIds.length > 0) {
                const clientUsers = await db.query.users.findMany({
                    where: inArray(users.id, clientIds),
                    columns: { 
                        firstName: true,
                        lastName: true,
                    },
                });
                clientNames = clientUsers.map(c => {
                    if (c.firstName || c.lastName) {
                        return `${c.firstName || ''} ${c.lastName || ''}`.trim();
                    }
                    return '';
                }).filter(Boolean);
                 console.log(`[ProjectRepository] Found ${clientNames.length} client(s) for project ${id}.`);
            } else {
                 console.log(`[ProjectRepository] No client IDs associated with project ${id}.`);
            }

            // Create project manager name
            let projectManagerName = null;
            if (project.projectManager) {
                if (project.projectManager.firstName || project.projectManager.lastName) {
                    projectManagerName = `${project.projectManager.firstName || ''} ${project.projectManager.lastName || ''}`.trim();
                }
            }

            return {
                ...project,
                projectManagerName,
                clientNames,
            };
         } catch (error) {
             console.error(`[ProjectRepository] Error in findById for ID ${id}:`, error);
             throw new Error(`Database error while fetching project ${id}.`);
         }
    }

    /**
     * Creates a new project in the database.
     * @param projectData - Data for the new project, conforming to NewProject type.
     * @returns A promise resolving to the newly created project object.
     */
    async create(projectData: NewProject): Promise<Project> {
         console.log(`[ProjectRepository] Creating new project: ${projectData.name}`);
         try {
            // Drizzle automatically handles default values like createdAt/updatedAt if defined in schema
            const [newProject] = await db.insert(projects).values(projectData).returning();

            if (!newProject) {
                 throw new Error("Project creation failed, no record returned.");
            }
             console.log(`[ProjectRepository] Project created with ID: ${newProject.id}`);
            return newProject;
         } catch (error) {
            console.error(`[ProjectRepository] Error in create:`, error);
            // Add more specific error handling if needed (e.g., unique constraint violation)
             throw new Error(`Database error while creating project.`);
         }
    }

    /**
     * Updates an existing project.
     * @param id - The UUID of the project to update.
     * @param projectData - An object containing the fields to update.
     * @returns A promise resolving to the updated project object or null if not found.
     */
    async update(id: string, projectData: Partial<NewProject>): Promise<Project | null> {
        console.log(`[ProjectRepository] Updating project ID: ${id}`);
        if (Object.keys(projectData).length === 0) {
            console.warn(`[ProjectRepository] Update called with empty data for project ID: ${id}`);
            // Optionally fetch and return the current project data or just return null/throw error
            return this.findById(id); // Example: return current data if no changes
        }
        try {
            // Convert Date objects to strings for database compatibility
            const processedData: any = { ...projectData };
            if (processedData.startDate instanceof Date) {
                processedData.startDate = processedData.startDate.toISOString();
            }
            if (processedData.endDate instanceof Date) {
                processedData.endDate = processedData.endDate.toISOString();
            }
            
            const [updatedProject] = await db.update(projects)
                .set({
                    ...processedData,
                    updatedAt: new Date(), // Explicitly set updatedAt on every update
                })
                .where(eq(projects.id, id))
                .returning(); // Return the updated record

            if (!updatedProject) {
                 console.log(`[ProjectRepository] Project with ID ${id} not found for update.`);
                 return null;
            }
            console.log(`[ProjectRepository] Project ${id} updated successfully.`);
            return updatedProject;
        } catch (error) {
             console.error(`[ProjectRepository] Error in update for ID ${id}:`, error);
             throw new Error(`Database error while updating project ${id}.`);
        }
    }

    /**
     * Deletes a project by its ID.
     * Note: Related data deletion (tasks, documents etc.) depends on DB foreign key constraints (ON DELETE CASCADE).
     * @param id - The UUID of the project to delete.
     * @returns A promise resolving to true if deletion was successful, false otherwise.
     */
    async delete(id: string): Promise<boolean> {
        console.log(`[ProjectRepository] Deleting project ID: ${id}`);
        try {
            const result = await db.delete(projects).where(eq(projects.id, id));
            const success = result && result.rowCount && result.rowCount > 0;
            console.log(`[ProjectRepository] Project ${id} deletion ${success ? 'successful' : 'failed (not found?)'}.`);
            return success;
        } catch (error) {
            console.error(`[ProjectRepository] Error in delete for ID ${id}:`, error);
            throw new Error(`Database error while deleting project ${id}.`);
        }
    }

    /**
     * Assigns a client user to a project.
     * @param userId - The UUID of the client user.
     * @param projectId - The UUID of the project.
     * @returns A promise resolving to true if assignment was successful.
     */
    async assignClientToProject(userId: string, projectId: string): Promise<boolean> {
        console.log(`[ProjectRepository] Assigning client ${userId} to project ${projectId}`);
        try {
            // 1. Get the current project to access its clientIds array
            const project = await db.query.projects.findFirst({
                where: eq(projects.id, projectId),
                columns: { clientIds: true }
            });

            if (!project) {
                throw new HttpError(404, `Project with ID ${projectId} not found.`);
            }

            // 2. Check if the client is already assigned
            const currentClientIds = project.clientIds || [];
            if (currentClientIds.includes(userId)) {
                console.log(`[ProjectRepository] Client ${userId} is already assigned to project ${projectId}.`);
                return true; // Already assigned, so consider it successful
            }

            // 3. Add the client to the array
            const updatedClientIds = [...currentClientIds, userId];
            
            // 4. Update the project with the new client array
            const [updatedProject] = await db.update(projects)
                .set({ 
                    clientIds: updatedClientIds,
                    updatedAt: new Date() 
                })
                .where(eq(projects.id, projectId))
                .returning();

            if (!updatedProject) {
                throw new Error(`Failed to update project ${projectId} with new client.`);
            }

            console.log(`[ProjectRepository] Client ${userId} successfully assigned to project ${projectId}.`);
            return true;
        } catch (error) {
            console.error(`[ProjectRepository] Error in assignClientToProject:`, error);
            if (error instanceof HttpError) {
                throw error; // Re-throw HTTP errors with their status
            }
            throw new Error(`Database error while assigning client to project.`);
        }
    }

    /**
     * Gets all projects in the system.
     * For admin use.
     */
    async getAllProjects(): Promise<Project[]> {
        console.log(`[ProjectRepository] Fetching all projects`);
        try {
            const allProjects = await db.query.projects.findMany({
                orderBy: (p) => [desc(p.createdAt)],
            });
            return allProjects;
        } catch (error) {
            console.error(`[ProjectRepository] Error in getAllProjects:`, error);
            throw new Error(`Database error while fetching all projects.`);
        }
    }
}

// Export a singleton instance
export const projectRepository = new ProjectRepository();