import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage'; // Assuming storage is exported from here
import {
  insertProjectSchema,
  projectStatusEnum,
  User,
} from '../../shared/schema'; // Import necessary types/schemas
import { HttpError } from '../errors'; // Assuming a custom HttpError class for structured errors

// Define a Zod schema for project creation/update, potentially reusing or adapting insertProjectSchema
// We need clientIds which is not directly in insertProjectSchema
const projectInputSchema = insertProjectSchema
  .omit({
    // Fields set by server or relations managed separately
    id: true,
    createdAt: true,
    updatedAt: true,
    pmId: true, // Assume PM might be set differently or is part of user info
  })
  .extend({
    // Add fields expected from the client API
    clientIds: z.array(z.string().uuid()).min(1, 'At least one client must be assigned.'),
    // Make fields explicitly optional if needed for updates, or create a separate update schema
    // Example: making description optional for update
    // description: z.string().optional(),
  });

// Refine schema for updates - often making fields optional
const projectUpdateSchema = projectInputSchema.partial();


// Get all projects (Admin) or projects assigned to the user (Client/PM)
export const getProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User; // isAuthenticated middleware guarantees user exists

    let projects;
    if (user.role === 'ADMIN') {
      // Admins see all projects, potentially with client/pm details joined
      projects = await storage.getAllProjects(); // Assumes storage.getAllProjects exists
    } else {
      // Non-admins see only projects they are assigned to (as client or PM)
      projects = await storage.getProjectsForUser(user.id); // Assumes storage.getProjectsForUser exists
    }

    res.status(200).json(projects);
  } catch (error) {
    next(error); // Pass error to the centralized error handler
  }
};

// Get a single project by ID
// Assumes checkProjectAccess middleware runs *before* this handler via routes config
export const getProjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    // Validate projectId parameter
    if (isNaN(projectIdNum)) {
      // Use HttpError for consistent error responses
      throw new HttpError(400, 'Invalid project ID parameter.');
      // Or send response directly:
      // return res.status(400).json({ message: 'Invalid project ID parameter.' });
    }

    // The checkProjectAccess middleware should have already verified permissions.
    // We just need to fetch the data.
    const project = await storage.getProjectById(projectIdNum); // Assumes storage.getProjectById exists

    if (!project) {
       throw new HttpError(404, 'Project not found.');
      // Or send response directly:
      // return res.status(404).json({ message: 'Project not found.' });
    }

    res.status(200).json(project);
  } catch (error) {
    next(error); // Pass error to the centralized error handler
  }
};

// Create a new project (Admin only)
// Assumes isAdmin middleware runs before this handler
export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
   try {
    const validationResult = projectInputSchema.safeParse(req.body);

    if (!validationResult.success) {
      // Refined error response using HttpError
      throw new HttpError(400, 'Invalid project data.', validationResult.error.flatten());
      // Or send response directly:
      // return res.status(400).json({
      //   message: 'Invalid project data.',
      //   errors: validationResult.error.flatten(),
      // });
    }

    const { clientIds, ...projectData } = validationResult.data;
    const user = req.user as User; // isAdmin ensures user exists and is Admin

    // Call storage layer to create project and associate clients
    // This might be one method or multiple depending on storage implementation
    const newProject = await storage.createProjectWithClients({
        ...projectData,
        pmId: user.id, // Example: Assign creating admin as PM initially? Adjust as needed.
        // Ensure dates are Date objects if schema expects them
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
    }, clientIds); // Assumes storage.createProjectWithClients handles transaction

    res.status(201).json(newProject);

  } catch(error) {
    next(error);
  }
};

// Update an existing project (Admin only)
// Assumes isAdmin middleware runs before this handler
export const updateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
       throw new HttpError(400, 'Invalid project ID parameter.');
    }

    const validationResult = projectUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
       throw new HttpError(400, 'Invalid project data.', validationResult.error.flatten());
    }

    // Ensure there's actually data to update
    if (Object.keys(validationResult.data).length === 0) {
       throw new HttpError(400, 'No update data provided.');
    }

    const { clientIds, ...projectData } = validationResult.data;

    // Prepare data, converting dates if necessary
     const updateData = {
        ...projectData,
        ...(projectData.startDate && { startDate: new Date(projectData.startDate) }),
        ...(projectData.endDate && { endDate: new Date(projectData.endDate) }),
    };


    // Call storage layer to update project details and potentially client associations
    // The storage layer should handle fetching the existing project and applying updates.
    // It might need separate methods for updating details vs. updating client list.
    const updatedProject = await storage.updateProjectDetailsAndClients(
        projectIdNum,
        updateData, // Only fields present in the partial schema
        clientIds // Pass clientIds if they are part of the update, otherwise handle separately
    ); // Adjust based on actual storage method signature

    if (!updatedProject) {
      throw new HttpError(404, 'Project not found or update failed.');
    }

    res.status(200).json(updatedProject);

  } catch(error) {
    next(error);
  }
};

// Delete a project (Admin only) - Use with caution!
// Assumes isAdmin middleware runs before this handler
export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

     if (isNaN(projectIdNum)) {
       throw new HttpError(400, 'Invalid project ID parameter.');
    }

    // Call storage layer to delete the project.
    // Consider implications: deletes associated tasks, documents, etc.? (Handled in storage logic)
    const success = await storage.deleteProject(projectIdNum); // Assumes storage.deleteProject exists and returns boolean/affectedRows

    if (!success) {
       // Could be because project didn't exist or deletion failed for other reasons
       throw new HttpError(404, 'Project not found or could not be deleted.');
    }

    res.status(204).send(); // No content response for successful deletion

  } catch(error) {
    next(error);
  }
};

// --- Placeholder for other project-related controller functions if needed ---
// Example: Assign/Unassign users, etc.