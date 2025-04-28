import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import specific types from the new types file
import { MessageWithSender } from '../storage/types';
import { insertMessageSchema, User } from '../../shared/schema'; // Keep User type
import { HttpError } from '../errors';

// --- Zod Schema for API Input Validation (Unchanged) ---

const messageCreateSchema = insertMessageSchema.pick({
  content: true,
}).refine(data => data.content.trim().length > 0, {
  message: "Message content cannot be empty.",
  path: ["content"],
});


// --- Controller Functions ---

/**
 * Get all messages for a specific project.
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

    // Use the nested repository: storage.messages
    const messages = await storage.messages.getMessagesForProject(projectIdNum);
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new message within a project thread.
 */
export const createMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User;

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

    const validationResult = messageCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid message data.', validationResult.error.flatten());
    }
    const { content } = validationResult.data;

    const newMessageData = {
        projectId: projectIdNum,
        senderId: user.id,
        content: content,
    };

    // Use the nested repository: storage.messages
    const createdMessage = await storage.messages.createMessage(newMessageData);

    if (!createdMessage) {
        throw new HttpError(500, 'Failed to create message.');
    }

    res.status(201).json(createdMessage); // Returns MessageWithSender type
  } catch (error) {
    next(error);
  }
};