import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertProjectSchema, Project, User } from '../../shared/schema';
import { HttpError } from '../errors';

// --- Zod Schemas for API Input Validation ---

// Schema for creating a project
const projectCreateSchema = insertProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for updating a project
const projectUpdateSchema = projectCreateSchema.partial();

// --- Helper functions for authorization logic ---

// Checks if a user can access a specific project
// Returns true if user is admin or associated with the project
async function canAccessProject(userId: number, projectId: number): Promise<boolean> {
  try {
    // Admin users can access all projects
    const user = await storage.getUser(userId);
    if (user?.role === 'admin') {
      return true;
    }

    // Check if user is associated with the project
    return await storage.checkUserProjectAccess(userId, projectId);
  } catch (error) {
    console.error('Error checking project access:', error);
    return false;
  }
}

// --- Controller Functions ---

/**
 * Get all projects the authenticated user has access to.
 * Admins see all projects, other users see only their associated projects.
 */
export const getAllProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as User;
    
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.'); // Should be caught by middleware
    }

    let projects: Project[];
    
    // Admin sees all projects
    if (user.role === 'admin') {
      projects = await storage.getAllProjects();
    } else {
      // Other users see only their associated projects
      projects = await storage.getProjectsForUser(user.id);
    }

    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new project.
 * Admin only operation.
 */
export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate the request data
    const validationResult = projectCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid project data.', validationResult.error.flatten());
    }

    const projectData = validationResult.data;
    const createdProject = await storage.createProject(projectData);
    
    res.status(201).json(createdProject);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a project by ID.
 * Accessible to admins and users associated with the project.
 */
export const getProjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const projectId = parseInt(id, 10);
    const user = req.user as User;

    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.'); // Should be caught by middleware
    }

    // Check access permissions
    const hasAccess = await canAccessProject(user.id, projectId);
    if (!hasAccess) {
      throw new HttpError(403, 'You do not have permission to access this project.');
    }

    // Get project details
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new HttpError(404, 'Project not found.');
    }

    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a project by ID.
 * Admin only operation.
 */
export const updateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      throw new HttpError(400, 'Invalid project ID.');
    }

    // Validate the request data
    const validationResult = projectUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid project data.', validationResult.error.flatten());
    }

    const updateData = validationResult.data;
    
    // Admin permission check handled by isAdmin middleware

    // Check if project exists
    const existingProject = await storage.getProject(projectId);
    if (!existingProject) {
      throw new HttpError(404, 'Project not found.');
    }

    // Update the project
    const updatedProject = await storage.updateProject(projectId, updateData);
    
    res.status(200).json(updatedProject);
  } catch (error) {
    next(error);
  }
};