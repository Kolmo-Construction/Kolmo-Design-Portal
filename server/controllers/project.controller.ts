import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import specific types from the new types file
import { UserProfile, ProjectWithDetails } from '../storage/types';
import {
  insertProjectSchema,
  projectStatusEnum,
  User, // Keep User type for req.user casting
} from '../../shared/schema';
import { HttpError } from '../errors';

// Define a Zod schema for project creation/update
const projectInputSchema = insertProjectSchema
  .omit({
    id: true, createdAt: true, updatedAt: true, pmId: true,
  })
  .extend({
    clientIds: z.array(z.string().uuid()).min(1, 'At least one client must be assigned.'),
  });

// Refine schema for updates
const projectUpdateSchema = projectInputSchema.partial();


// Get all projects (Admin) or projects assigned to the user (Client/PM)
export const getProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User; // isAuthenticated guarantees user exists

    let projects;
    if (user.role === 'ADMIN') {
      // Use the nested repository: storage.projects
      projects = await storage.projects.getAllProjects();
    } else {
      // Use the nested repository: storage.projects
      projects = await storage.projects.getProjectsForUser(user.id);
    }

    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
};

// Get a single project by ID
// Assumes checkProjectAccess middleware runs *before* this handler
export const getProjectById = async (
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

    // Use the nested repository: storage.projects
    const project = await storage.projects.getProjectById(projectIdNum);

    if (!project) {
       throw new HttpError(404, 'Project not found.');
    }

    res.status(200).json(project);
  } catch (error) {
    next(error);
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
      throw new HttpError(400, 'Invalid project data.', validationResult.error.flatten());
    }

    const { clientIds, ...projectData } = validationResult.data;
    const user = req.user as User;

    // Prepare data, converting dates if necessary
     const insertData = {
        ...projectData,
        pmId: user.id, // Assign creating admin as PM initially? Adjust as needed.
        ...(projectData.startDate && { startDate: new Date(projectData.startDate) }),
        ...(projectData.endDate && { endDate: new Date(projectData.endDate) }),
    };

    // Use the nested repository: storage.projects
    const newProject = await storage.projects.createProjectWithClients(
        insertData,
        clientIds
    );

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

    // Use the nested repository: storage.projects
    // Pass clientIds only if they were included in the request body (clientIds !== undefined)
    const updatedProject = await storage.projects.updateProjectDetailsAndClients(
        projectIdNum,
        updateData,
        clientIds // Pass the array or undefined
    );

    if (!updatedProject) {
      // updateProjectDetailsAndClients throws 404 if not found during update now
      // This line might not be reachable if the repo throws HttpError directly
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

    // Use the nested repository: storage.projects
    const success = await storage.projects.deleteProject(projectIdNum);

    if (!success) {
       throw new HttpError(404, 'Project not found or could not be deleted.');
    }

    res.status(204).send(); // No content response for successful deletion

  } catch(error) {
    next(error);
  }
};