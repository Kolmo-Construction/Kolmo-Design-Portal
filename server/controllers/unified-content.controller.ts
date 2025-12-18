import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { User } from '../../shared/schema';
import { HttpError } from '../errors';
import { db } from '../db';
import { progressUpdates, adminImages } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Unified Content Controller
 *
 * Provides a single endpoint to fetch all content types for a project
 * (progress updates, images, invoices, documents, milestones, tasks, daily logs, punch list items)
 *
 * This simplifies the frontend by allowing a single API call to get all reviewable content.
 */

// Normalized content item interface
interface UnifiedContentItem {
  id: number;
  type: 'progress_update' | 'task' | 'invoice' | 'document' | 'milestone' | 'daily_log' | 'punch_list' | 'image';
  title: string;
  description?: string;
  status?: string;
  visibility?: 'admin_only' | 'published';
  createdAt: Date;
  createdBy?: {
    id: number;
    name: string;
  };
  reviewedBy?: {
    id: number;
    name: string;
  };
  reviewedAt?: Date;
  projectId: number;
  // Type-specific fields
  metadata?: Record<string, any>;
}

/**
 * Get all content for a project across all content types
 *
 * GET /api/projects/:projectId/unified-content
 *
 * Query params:
 * - contentType: Filter by specific type (optional)
 * - status: Filter by status (optional)
 * - visibility: Filter by visibility (optional)
 */
export const getUnifiedContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);
    const user = req.user as User;

    const { contentType, status, visibility } = req.query;

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }

    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.');
    }

    // Verify project exists and user has access
    const project = await storage.projects.getProjectById(projectIdNum);
    if (!project) {
      throw new HttpError(404, 'Project not found.');
    }

    // Fetch all content types in parallel for performance
    const [
      progressUpdatesData,
      invoicesData,
      documentsData,
      milestonesData,
      dailyLogsData,
      punchListData,
      imagesData,
    ] = await Promise.all([
      // Progress Updates
      storage.progressUpdates.getProgressUpdatesForProject(projectIdNum),
      // Invoices
      storage.invoices.getInvoicesForProject(projectIdNum),
      // Documents
      storage.documents.getDocumentsForProject(projectIdNum),
      // Milestones
      storage.milestones.getMilestonesByProjectId(projectIdNum),
      // Daily Logs
      storage.dailyLogs.getDailyLogsForProject(projectIdNum),
      // Punch List Items
      storage.punchLists.getPunchListItemsForProject(projectIdNum),
      // Admin Images (for this project)
      db.select().from(adminImages).where(eq(adminImages.projectId, projectIdNum)),
    ]);

    // Normalize all content to unified format
    const allContent: UnifiedContentItem[] = [
      // Progress Updates
      ...progressUpdatesData.map(item => ({
        id: item.id,
        type: 'progress_update' as const,
        title: item.title || 'Progress Update',
        description: item.description || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt),
        projectId: item.projectId,
        metadata: {
          generatedByAI: item.generatedByAI,
          rawLLMResponse: item.rawLLMResponse,
          rejectionReason: item.rejectionReason,
        },
      })),

      // Invoices
      ...invoicesData.map(item => ({
        id: item.id,
        type: 'invoice' as const,
        title: item.invoiceNumber || `Invoice #${item.id}`,
        description: item.description || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt),
        projectId: item.projectId,
        metadata: {
          amount: item.amount,
          dueDate: item.dueDate,
          paidDate: item.paidDate,
        },
      })),

      // Documents
      ...documentsData.map(item => ({
        id: item.id,
        type: 'document' as const,
        title: item.title || item.fileName,
        description: item.description || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.uploadedAt),
        projectId: item.projectId,
        metadata: {
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          fileSize: item.fileSize,
        },
      })),

      // Milestones
      ...milestonesData.map(item => ({
        id: item.id,
        type: 'milestone' as const,
        title: item.name,
        description: item.description || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt),
        projectId: item.projectId,
        metadata: {
          targetDate: item.targetDate,
          actualDate: item.actualDate,
          isBillable: item.isBillable,
          billingPercentage: item.billingPercentage,
        },
      })),

      // Daily Logs
      ...dailyLogsData.map(item => ({
        id: item.id,
        type: 'daily_log' as const,
        title: `Daily Log - ${new Date(item.logDate).toLocaleDateString()}`,
        description: item.workPerformed || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt),
        projectId: item.projectId,
        metadata: {
          logDate: item.logDate,
          weather: item.weather,
          temperature: item.temperature,
          crewOnSite: item.crewOnSite,
        },
      })),

      // Punch List Items
      ...punchListData.map(item => ({
        id: item.id,
        type: 'punch_list' as const,
        title: item.description,
        description: item.location || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt),
        projectId: item.projectId,
        metadata: {
          priority: item.priority,
          dueDate: item.dueDate,
          resolvedAt: item.resolvedAt,
          photoUrl: item.photoUrl,
        },
      })),

      // Admin Images
      ...imagesData.map(item => ({
        id: item.id,
        type: 'image' as const,
        title: item.title,
        description: item.description || undefined,
        status: item.status,
        visibility: item.visibility,
        createdAt: new Date(item.createdAt),
        projectId: item.projectId!,
        metadata: {
          imageUrl: item.imageUrl,
          category: item.category,
          tags: item.tags,
          width: item.width,
          height: item.height,
        },
      })),
    ];

    // Apply client visibility filtering
    let filteredContent = allContent;
    if (user.role === 'client') {
      filteredContent = filteredContent.filter(item => item.visibility === 'published');
    }

    // Apply query filters
    if (contentType) {
      filteredContent = filteredContent.filter(item => item.type === contentType);
    }

    if (status) {
      filteredContent = filteredContent.filter(item => item.status === status);
    }

    if (visibility) {
      filteredContent = filteredContent.filter(item => item.visibility === visibility);
    }

    // Sort by created date (newest first)
    filteredContent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.status(200).json({
      projectId: projectIdNum,
      totalCount: filteredContent.length,
      content: filteredContent,
      contentTypeCounts: {
        progress_update: filteredContent.filter(i => i.type === 'progress_update').length,
        invoice: filteredContent.filter(i => i.type === 'invoice').length,
        document: filteredContent.filter(i => i.type === 'document').length,
        milestone: filteredContent.filter(i => i.type === 'milestone').length,
        daily_log: filteredContent.filter(i => i.type === 'daily_log').length,
        punch_list: filteredContent.filter(i => i.type === 'punch_list').length,
        image: filteredContent.filter(i => i.type === 'image').length,
      },
    });
  } catch (error) {
    next(error);
  }
};
