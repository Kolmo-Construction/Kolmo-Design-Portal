import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertMessageSchema, User } from '../../shared/schema';
import { HttpError } from '../errors';

// --- Zod Schema for API Input Validation ---

// Schema for creating a message (expects content from client)
const messageCreateSchema = insertMessageSchema.pick({
  content: true, // Use validation from insertMessageSchema directly
}).refine(data => data.content.trim().length > 0, {
  message: "Message content cannot be empty.",
  path: ["content"], // Specify the path of the error
});


// --- Controller Functions ---

/**
 * Get all messages for a specific project.
 * Assumes checkProjectAccess middleware runs before this.
 * Storage layer should join with sender details.
 */
export const getMessagesForProject = async (
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

    // checkProjectAccess middleware verified access
    // Assumes storage.getMessagesForProject fetches messages and includes sender info (e.g., sender name, role)
    const messages = await storage.getMessagesForProject(projectIdNum);
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new message within a project thread.
 * Assumes checkProjectAccess middleware runs before this.
 */
export const createMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User; // Authenticated user

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }

    const validationResult = messageCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid message data.', validationResult.error.flatten());
    }

    const { content } = validationResult.data;

    // Prepare data for storage layer
    const newMessageData = {
        projectId: projectIdNum,
        senderId: user.id,
        content: content, // Already validated non-empty string
    };

    // Assumes storage.createMessage saves the message and returns the newly created message object,
    // potentially joined with sender details for immediate display.
    const createdMessage = await storage.createMessage(newMessageData);

    if (!createdMessage) {
        // Should not happen if DB insert is successful, but handle defensively
        throw new HttpError(500, 'Failed to create message.');
    }

    res.status(201).json(createdMessage);
  } catch (error) {
    next(error);
  }
};

// Potential future controllers (if routes are added):
// export const updateMessage = ...
// export const deleteMessage = ...