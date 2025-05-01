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
    // Add other methods if they exist in your original repository
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
                            // Select only necessary fields, e.g., fullName if available, or firstName/lastName
                            fullName: true, // Adjust if your user schema uses firstName/lastName
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
            let clientsMap: Map<string, { fullName: string | null }> = new Map();
            if (uniqueClientIds.length > 0) {
                const clientUsers = await db.query.users.findMany({
                    where: inArray(users.id, uniqueClientIds),
                    columns: {
                        id: true,
                        fullName: true, // Adjust if using firstName/lastName
                    },
                });
                clientsMap = new Map(clientUsers.map(c => [c.id, { fullName: c.fullName }]));
                console.log(`[ProjectRepository] Fetched details for ${clientsMap.size} clients.`);
            }

            // 4. Map client names back to the project objects
            const projectsWithDetails: ProjectWithManagerAndClients[] = fetchedProjects.map(p => {
                // Ensure p.clientIds is treated as an array, filter nulls/undefineds
                const clientNames = (p.clientIds || [])
                    .filter(id => id != null) // Filter out potential nulls in the array
                    .map(clientId => clientsMap.get(clientId!)?.fullName) // Use non-null assertion after filtering
                    .filter((name): name is string => name !== null && name !== undefined); // Type guard

                return {
                    ...p, // Spread the original project data
                    projectManagerName: p.projectManager?.fullName ?? null, // Safely access manager name
                    clientNames: clientNames, // Assign the array of client names
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
                        columns: { fullName: true }, // Adjust if needed
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
                    columns: { fullName: true }, // Adjust if needed
                });
                clientNames = clientUsers.map(c => c.fullName).filter((name): name is string => !!name);
                 console.log(`[ProjectRepository] Found ${clientNames.length} client(s) for project ${id}.`);
            } else {
                 console.log(`[ProjectRepository] No client IDs associated with project ${id}.`);
            }

            return {
                ...project,
                projectManagerName: project.projectManager?.fullName ?? null,
                clientNames: clientNames,
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
            const [newProject] = await db.insert(projects).values({
                ...projectData,
                // Ensure updatedAt is set if your schema doesn't use defaultNow() on update triggers
                // updatedAt: new Date(),
            }).returning(); // Return the newly created record

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
            const [updatedProject] = await db.update(projects)
                .set({
                    ...projectData,
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
            const success = result.rowCount > 0;
            console.log(`[ProjectRepository] Project ${id} deletion ${success ? 'successful' : 'failed (not found?)'}.`);
            return success;
        } catch (error) {
            console.error(`[ProjectRepository] Error in delete for ID ${id}:`, error);
             throw new Error(`Database error while deleting project ${id}.`);
        }
    }
}

// Export a singleton instance
export const projectRepository = new ProjectRepository();
