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
import { expensifyService } from '../services/expensify.service';

// Define a Zod schema for project creation/update
const projectInputSchema = insertProjectSchema.extend({
  clientIds: z.array(z.number()).min(1, 'At least one client must be assigned.'),
});

// Refine schema for updates with proper date handling
const projectUpdateSchema = insertProjectSchema.partial().extend({
  clientIds: z.array(z.number()).optional(),
  startDate: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
  estimatedCompletionDate: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
  actualCompletionDate: z.union([z.string().datetime(), z.date(), z.null()]).optional(),
});


// Get all projects (Admin) or projects assigned to the user (Client/PM)
export const getProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User; // isAuthenticated guarantees user exists

    let projects;
    if (user.role.toLowerCase() === 'admin') {
      // Use the nested repository: storage.projects
      projects = await storage.projects.getAllProjects();
    } else {
      // Use the nested repository: storage.projects
      projects = await storage.projects.getProjectsForUser(String(user.id));
    }

    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
};

// Get a single project by ID
// Now uses validateIdParam middleware for validation
export const getProjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // The ID is guaranteed to be valid due to validateIdParam middleware
    const id = parseInt(req.params.id, 10);
    
    // Use the nested repository: storage.projects
    const project = await storage.projects.getProjectById(id);

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

    // Prepare data, converting dates and handling type conversions properly
    const insertData: any = {
        ...projectData,
        projectManagerId: user.id, // Assign creating admin as PM initially
        totalBudget: typeof projectData.totalBudget === 'number' 
            ? projectData.totalBudget.toString() 
            : projectData.totalBudget,
        ...(projectData.startDate && { startDate: new Date(projectData.startDate) }),
        ...(projectData.estimatedCompletionDate && { estimatedCompletionDate: new Date(projectData.estimatedCompletionDate) }),
    };

    // Use the nested repository: storage.projects
    const newProject = await storage.projects.createProjectWithClients(
        insertData,
        clientIds.map(id => id.toString())
    );

    // Automatically create Expensify tag using project owner's name and creation date
    if (newProject) {
      try {
        if (expensifyService.isConfigured() && insertData.customerName) {
          const creationDate = new Date();
          const result = await expensifyService.createProject(
            newProject.id,
            newProject.name,
            insertData.customerName,
            creationDate
          );
          
          if (result.success) {
            console.log(`[ProjectController] Expensify tag created: ${result.tag} for project ${newProject.id}`);
          }
        }
      } catch (error) {
        console.warn('[ProjectController] Failed to create Expensify tag:', error);
        // Don't fail project creation if Expensify tag creation fails
      }
    }

    res.status(201).json(newProject);

  } catch(error) {
    next(error);
  }
};

// Update an existing project (Admin only)
// Now uses validateIdParam middleware for validation
export const updateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // The ID is guaranteed to be valid due to validateIdParam middleware
    const id = parseInt(req.params.id, 10);

    const validationResult = projectUpdateSchema.safeParse(req.body);

    if (!validationResult.success) {
       throw new HttpError(400, 'Invalid project data.', validationResult.error.flatten());
    }

    // Ensure there's actually data to update
    if (Object.keys(validationResult.data).length === 0) {
       throw new HttpError(400, 'No update data provided.');
    }

    const { clientIds, ...projectData } = validationResult.data;

    // Prepare data, converting dates and handling type conversions properly
    const updateData: any = {};
    
    // Copy all non-date fields
    Object.keys(projectData).forEach(key => {
        if (!['startDate', 'estimatedCompletionDate', 'actualCompletionDate', 'totalBudget'].includes(key)) {
            updateData[key] = projectData[key as keyof typeof projectData];
        }
    });
    
    // Handle date fields properly
    if (projectData.startDate !== undefined) {
        updateData.startDate = projectData.startDate ? new Date(projectData.startDate) : null;
    }
    if (projectData.estimatedCompletionDate !== undefined) {
        updateData.estimatedCompletionDate = projectData.estimatedCompletionDate ? new Date(projectData.estimatedCompletionDate) : null;
    }
    if (projectData.actualCompletionDate !== undefined) {
        updateData.actualCompletionDate = projectData.actualCompletionDate ? new Date(projectData.actualCompletionDate) : null;
    }
    
    // Handle totalBudget conversion if present
    if (projectData.totalBudget !== undefined) {
        updateData.totalBudget = typeof projectData.totalBudget === 'number' 
            ? projectData.totalBudget.toString() 
            : projectData.totalBudget;
    }

    // Use the nested repository: storage.projects
    // Pass clientIds only if they were included in the request body (clientIds !== undefined)
    const updatedProject = await storage.projects.updateProjectDetailsAndClients(
        id,
        updateData,
        clientIds ? clientIds.map((id: number) => id.toString()) : undefined // Convert to string array
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
// Now uses validateIdParam middleware for validation
export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // The ID is guaranteed to be valid due to validateIdParam middleware
    const id = parseInt(req.params.id, 10);

    // Use the nested repository: storage.projects
    const success = await storage.projects.deleteProject(id);

    if (!success) {
       throw new HttpError(404, 'Project not found or could not be deleted.');
    }

    res.status(204).send(); // No content response for successful deletion

  } catch(error) {
    next(error);
  }
};

// Recalculate project progress based on weighted task completion
export const recalculateProjectProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const projectId = parseInt(req.params.id, 10);

    // Get all tasks for the project
    const tasks = await storage.tasks.getTasksForProject(projectId);

    let progressPercentage = 0;
    let totalEstimatedHours = 0;
    let completedHours = 0;

    if (tasks.length > 0) {
      // Calculate weighted progress based on task progress and estimated hours
      for (const task of tasks) {
        const estimatedHours = task.estimatedHours ? parseFloat(task.estimatedHours.toString()) : 0;
        const taskProgress = task.progress || 0; // Default to 0 if not set

        totalEstimatedHours += estimatedHours;
        completedHours += (estimatedHours * taskProgress) / 100;
      }

      // Calculate overall progress percentage
      if (totalEstimatedHours > 0) {
        progressPercentage = Math.round((completedHours / totalEstimatedHours) * 100);
      } else {
        // Fallback to simple task count if no estimated hours
        const completedTasks = tasks.filter(task =>
          task.status === 'done' || task.status === 'completed'
        ).length;
        progressPercentage = Math.round((completedTasks / tasks.length) * 100);
      }
    }

    // Update the project progress
    const updatedProject = await storage.projects.updateProjectDetailsAndClients(projectId, { progress: progressPercentage });

    if (!updatedProject) {
      throw new HttpError(404, 'Project not found.');
    }

    res.status(200).json({
      message: 'Project progress recalculated successfully (weighted by estimated hours)',
      progress: progressPercentage,
      totalEstimatedHours,
      completedHours: Math.round(completedHours * 100) / 100, // Round to 2 decimals
      completedTasks: tasks.filter(task => task.status === 'done' || task.status === 'completed').length,
      totalTasks: tasks.length
    });

  } catch(error) {
    next(error);
  }
};