// server/routes/progressUpdate.routes.ts
import { Router } from "express";
import * as progressUpdateController from "@server/controllers/progressUpdate.controller"; // Updated import
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware";
import { ImageAnalysisService } from "../services/ImageAnalysisService";
import { ProgressReportGenerator } from "../services/ProgressReportGenerator";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
// Import checkProjectAccess or specific permission middleware if applying at route level
import { progressUpdates, progressUpdateViews } from "@shared/schema";
import { db } from "../db";
import { eq, and, sql, notInArray, inArray } from "drizzle-orm";

// Use mergeParams: true to access :projectId from the parent router mount point
const router = Router({ mergeParams: true });

// Both routes require authentication, handled at mount point in server/routes.ts
// Access checks for the specific project and role permissions are handled within the controllers for now.

// GET /api/projects/:projectId/updates/
router.get("/", progressUpdateController.getProgressUpdatesForProject);

// POST /api/projects/:projectId/updates/
// (Permissions check for Admin/PM done in controller)
router.post("/", progressUpdateController.createProgressUpdate);

// POST /api/projects/:projectId/updates/analyze-images-poc
// POC endpoint for LLM-powered image analysis (Phase 0)
// Admin-only endpoint for testing the ImageAnalysisService
router.post("/analyze-images-poc", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const { imageIds, previousReportSummary } = req.body;

    // Validate input
    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "imageIds array is required and must not be empty",
      });
    }

    console.log(`[POC] Starting image analysis for project ${projectId} with ${imageIds.length} images`);

    // Initialize the service and run analysis
    const service = new ImageAnalysisService();
    const result = await service.analyzeProgressImages(
      parseInt(projectId),
      imageIds,
      previousReportSummary
    );

    // Calculate estimated cost
    const cost = service.calculateEstimatedCost(imageIds.length);

    console.log(`[POC] Analysis complete. Confidence: ${result.confidence}, Cost: $${cost.total}`);

    res.json({
      success: true,
      analysis: result,
      estimatedCost: cost,
      metadata: {
        projectId: parseInt(projectId),
        imagesAnalyzed: imageIds.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[POC] Image analysis error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze images",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/projects/:projectId/updates/generate-ai-report
// Production endpoint for generating AI-powered progress reports
// Creates a draft progress update that requires admin review before client visibility
router.post("/generate-ai-report", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const { imageIds, batchByDate = true } = req.body;
    const userId = req.user!.id;

    console.log(`[GenerateAIReport] Starting for project ${projectId} by user ${userId}`);

    // Initialize the service
    const generator = new ProgressReportGenerator();

    // Generate the report
    const result = await generator.generateReport({
      projectId: parseInt(projectId),
      imageIds: imageIds || undefined,
      batchByDate,
      userId,
    });

    console.log(`[GenerateAIReport] Report generated successfully. Update ID: ${result.progressUpdateId}`);

    res.json({
      success: true,
      message: 'AI progress report generated successfully',
      data: {
        progressUpdateId: result.progressUpdateId,
        status: result.status,
        visibility: result.visibility,
        imageCount: result.imageCount,
        estimatedCost: result.cost,
        analysis: {
          executiveSummary: result.analysis.executiveSummary,
          confidence: result.analysis.confidence,
        },
      },
    });
  } catch (error) {
    console.error("[GenerateAIReport] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI report",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/projects/:projectId/updates/unanalyzed-batches
// Get image batches that haven't been analyzed yet (grouped by date)
router.get("/unanalyzed-batches", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;

    const generator = new ProgressReportGenerator();
    const batches = await generator.groupImagesByDate(parseInt(projectId));

    res.json({
      success: true,
      batches: batches.map(batch => ({
        date: batch.date.toISOString().split('T')[0],
        imageCount: batch.images.length,
        imageIds: batch.images.map(img => img.id),
        thumbnails: batch.images.slice(0, 3).map(img => img.imageUrl),
      })),
    });
  } catch (error) {
    console.error("[UnanalyzedBatches] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unanalyzed batches",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/projects/:projectId/updates/:updateId/approve
// Approve an AI-generated progress report and optionally publish to client portal
router.put("/:updateId/approve", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, updateId } = req.params;
    const { publish = false, editedDescription } = req.body;
    const userId = req.user!.id;

    console.log(`[ApproveUpdate] Approving update ${updateId} by user ${userId}`);

    // Get the update
    const [update] = await db
      .select()
      .from(progressUpdates)
      .where(
        and(
          eq(progressUpdates.id, parseInt(updateId)),
          eq(progressUpdates.projectId, parseInt(projectId))
        )
      )
      .limit(1);

    if (!update) {
      return res.status(404).json({ success: false, message: 'Progress update not found' });
    }

    if (!update.generatedByAI) {
      return res.status(400).json({ success: false, message: 'Only AI-generated updates can be approved' });
    }

    // Update the status and visibility
    const [updatedReport] = await db
      .update(progressUpdates)
      .set({
        status: 'approved',
        visibility: publish ? 'published' : 'admin_only',
        reviewedById: userId,
        reviewedAt: new Date(),
        description: editedDescription || update.description,
        updatedAt: new Date(),
      })
      .where(eq(progressUpdates.id, parseInt(updateId)))
      .returning();

    console.log(`[ApproveUpdate] Update ${updateId} approved${publish ? ' and published' : ''}`);

    res.json({
      success: true,
      message: publish ? 'Report approved and published to client portal' : 'Report approved',
      data: updatedReport,
    });
  } catch (error) {
    console.error("[ApproveUpdate] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve update",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/projects/:projectId/updates/:updateId/reject
// Reject an AI-generated progress report
router.put("/:updateId/reject", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, updateId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    console.log(`[RejectUpdate] Rejecting update ${updateId} by user ${userId}`);

    const [updatedReport] = await db
      .update(progressUpdates)
      .set({
        status: 'rejected',
        visibility: 'admin_only',
        reviewedById: userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
        // Store rejection reason in metadata
        aiAnalysisMetadata: db.raw(`
          COALESCE(ai_analysis_metadata, '{}'::jsonb) ||
          jsonb_build_object('rejectionReason', '${reason || 'Not specified'}')
        `),
      })
      .where(
        and(
          eq(progressUpdates.id, parseInt(updateId)),
          eq(progressUpdates.projectId, parseInt(projectId))
        )
      )
      .returning();

    if (!updatedReport) {
      return res.status(404).json({ success: false, message: 'Progress update not found' });
    }

    console.log(`[RejectUpdate] Update ${updateId} rejected`);

    res.json({
      success: true,
      message: 'Report rejected',
      data: updatedReport,
    });
  } catch (error) {
    console.error("[RejectUpdate] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject update",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/projects/:projectId/updates/:updateId/publish
// Publish an approved report to the client portal
router.put("/:updateId/publish", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, updateId } = req.params;

    const [update] = await db
      .select()
      .from(progressUpdates)
      .where(
        and(
          eq(progressUpdates.id, parseInt(updateId)),
          eq(progressUpdates.projectId, parseInt(projectId))
        )
      )
      .limit(1);

    if (!update) {
      return res.status(404).json({ success: false, message: 'Progress update not found' });
    }

    if (update.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved updates can be published. Please approve the update first.'
      });
    }

    const [publishedReport] = await db
      .update(progressUpdates)
      .set({
        visibility: 'published',
        updatedAt: new Date(),
      })
      .where(eq(progressUpdates.id, parseInt(updateId)))
      .returning();

    console.log(`[PublishUpdate] Update ${updateId} published to client portal`);

    res.json({
      success: true,
      message: 'Report published to client portal',
      data: publishedReport,
    });
  } catch (error) {
    console.error("[PublishUpdate] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to publish update",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// PUT /api/projects/:projectId/updates/:updateId/unpublish
// Remove a report from client portal (make admin-only again)
router.put("/:updateId/unpublish", isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, updateId } = req.params;

    const [unpublishedReport] = await db
      .update(progressUpdates)
      .set({
        visibility: 'admin_only',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(progressUpdates.id, parseInt(updateId)),
          eq(progressUpdates.projectId, parseInt(projectId))
        )
      )
      .returning();

    if (!unpublishedReport) {
      return res.status(404).json({ success: false, message: 'Progress update not found' });
    }

    console.log(`[UnpublishUpdate] Update ${updateId} removed from client portal`);

    res.json({
      success: true,
      message: 'Report removed from client portal',
      data: unpublishedReport,
    });
  } catch (error) {
    console.error("[UnpublishUpdate] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unpublish update",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/projects/:projectId/updates/unread-count
// Get count of unread progress updates for current user
router.get("/unread-count", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get all published updates for this project
    const allUpdates = await db
      .select({ id: progressUpdates.id })
      .from(progressUpdates)
      .where(
        and(
          eq(progressUpdates.projectId, parseInt(projectId)),
          eq(progressUpdates.visibility, 'published')
        )
      );

    if (allUpdates.length === 0) {
      return res.json({ success: true, unreadCount: 0 });
    }

    const updateIds = allUpdates.map(u => u.id);

    // Get updates this user has viewed
    const viewedUpdates = await db
      .select({ progressUpdateId: progressUpdateViews.progressUpdateId })
      .from(progressUpdateViews)
      .where(
        and(
          eq(progressUpdateViews.userId, userId),
          sql`${progressUpdateViews.progressUpdateId} = ANY(${updateIds})`
        )
      );

    const viewedIds = new Set(viewedUpdates.map(v => v.progressUpdateId));
    const unreadCount = updateIds.filter(id => !viewedIds.has(id)).length;

    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error("[UnreadCount] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/projects/:projectId/updates/:updateId/mark-read
// Mark a progress update as read by the current user
router.post("/:updateId/mark-read", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, updateId } = req.params;
    const userId = req.user!.id;

    // Check if already viewed
    const existing = await db
      .select()
      .from(progressUpdateViews)
      .where(
        and(
          eq(progressUpdateViews.progressUpdateId, parseInt(updateId)),
          eq(progressUpdateViews.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      // Mark as viewed
      await db.insert(progressUpdateViews).values({
        progressUpdateId: parseInt(updateId),
        userId,
      });
    }

    res.json({ success: true, message: "Update marked as read" });
  } catch (error) {
    console.error("[MarkRead] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark update as read",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/projects/:projectId/updates/with-read-status
// Get progress updates with read/unread status for current user
router.get("/with-read-status", isAuthenticated, async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get all updates for this project
    let updates = await db
      .select()
      .from(progressUpdates)
      .where(eq(progressUpdates.projectId, parseInt(projectId)))
      .orderBy(sql`${progressUpdates.createdAt} DESC`);

    // Filter by visibility for clients
    if (userRole === 'client') {
      updates = updates.filter(update => !update.visibility || update.visibility === 'published');
    }

    if (updates.length === 0) {
      return res.json({ success: true, updates: [] });
    }

    const updateIds = updates.map(u => u.id);

    // Get viewed status for these updates
    const viewedUpdates = await db
      .select({ progressUpdateId: progressUpdateViews.progressUpdateId })
      .from(progressUpdateViews)
      .where(
        and(
          eq(progressUpdateViews.userId, userId),
          inArray(progressUpdateViews.progressUpdateId, updateIds)
        )
      );

    const viewedIds = new Set(viewedUpdates.map(v => v.progressUpdateId));

    // Add isNew flag to updates
    const updatesWithStatus = updates.map(update => ({
      ...update,
      isNew: !viewedIds.has(update.id),
    }));

    res.json({ success: true, updates: updatesWithStatus });
  } catch (error) {
    console.error("[WithReadStatus] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get updates with read status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;