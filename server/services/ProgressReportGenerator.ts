/**
 * Production service for generating AI-powered construction progress reports
 * Handles batching, context management, and database persistence
 */

import { db } from '../db';
import { adminImages, progressUpdates, progressReportSummaries, updateMedia, projects } from '@shared/schema';
import { eq, and, desc, gte, lte, isNotNull, sql } from 'drizzle-orm';
import { ImageAnalysisService, type AnalysisResult } from './ImageAnalysisService';

export interface ImageBatch {
  date: Date;
  images: Array<{
    id: number;
    title: string;
    imageUrl: string;
    captureDate: Date;
    metadata?: any;
  }>;
}

export interface GenerateReportOptions {
  projectId: number;
  imageIds?: number[]; // Optional: specific images to analyze (otherwise groups by date)
  batchByDate?: boolean; // Default: true - group images by capture date
  userId: number; // Admin/PM user creating the report
}

export interface GeneratedReport {
  progressUpdateId: number;
  status: string;
  visibility: string;
  analysis: AnalysisResult;
  imageCount: number;
  cost: number;
}

export class ProgressReportGenerator {
  private imageAnalysisService: ImageAnalysisService;

  constructor() {
    this.imageAnalysisService = new ImageAnalysisService();
  }

  /**
   * Generate an AI-powered progress report for a project
   * Creates a draft progress update that requires admin review
   */
  async generateReport(options: GenerateReportOptions): Promise<GeneratedReport> {
    const { projectId, imageIds, batchByDate = true, userId } = options;

    console.log(`[ProgressReportGenerator] Starting report generation for project ${projectId}`);

    // 1. Get project context
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // 2. Get images to analyze
    let images: any[];
    if (imageIds && imageIds.length > 0) {
      // Use specific images provided, but filter out already-processed ones
      const requestedImages = await this.getImagesByIds(imageIds);
      const processedImageUrls = await this.getProcessedImageUrls(projectId);
      images = requestedImages.filter(img => !processedImageUrls.has(img.imageUrl));

      if (images.length < requestedImages.length) {
        console.log(`[ProgressReportGenerator] Filtered out ${requestedImages.length - images.length} already-processed images`);
      }
    } else {
      // Get unanalyzed images for this project
      images = await this.getUnanalyzedImages(projectId);
    }

    if (images.length === 0) {
      throw new Error('No unprocessed images available for analysis');
    }

    console.log(`[ProgressReportGenerator] Found ${images.length} images to analyze`);

    // 3. Get previous report summary for context
    const previousSummary = await this.getLatestSummary(projectId);
    const previousSummaryText = previousSummary?.summaryText;

    console.log(`[ProgressReportGenerator] Previous summary ${previousSummaryText ? 'found' : 'not found'}`);

    // 4. Run AI analysis
    const analysis = await this.imageAnalysisService.analyzeProgressImages(
      projectId,
      images.map(img => img.id),
      previousSummaryText
    );

    // 5. Calculate cost
    const cost = this.imageAnalysisService.calculateEstimatedCost(images.length);

    // 6. Create draft progress update
    const progressUpdate = await this.createDraftProgressUpdate({
      projectId,
      analysis,
      images,
      cost,
      userId,
    });

    // 7. Link images to update via update_media
    await this.linkImagesToUpdate(progressUpdate.id, images);

    // 8. Create summary for future context
    await this.createSummaryEntry({
      projectId,
      progressUpdateId: progressUpdate.id,
      analysis,
      images,
      userId,
    });

    console.log(`[ProgressReportGenerator] Report generated successfully. Update ID: ${progressUpdate.id}`);

    return {
      progressUpdateId: progressUpdate.id,
      status: progressUpdate.status!,
      visibility: progressUpdate.visibility!,
      analysis,
      imageCount: images.length,
      cost: cost.total,
    };
  }

  /**
   * Get project from database
   */
  private async getProject(projectId: number) {
    return await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
  }

  /**
   * Get specific images by IDs
   */
  private async getImagesByIds(imageIds: number[]) {
    return await db
      .select()
      .from(adminImages)
      .where(sql`${adminImages.id} = ANY(${imageIds})`);
  }

  /**
   * Get URLs of all images that have been processed in AI updates
   */
  private async getProcessedImageUrls(projectId: number): Promise<Set<string>> {
    const linkedImageUrls = await db
      .select({ mediaUrl: updateMedia.mediaUrl })
      .from(updateMedia)
      .innerJoin(progressUpdates, eq(updateMedia.updateId, progressUpdates.id))
      .where(
        and(
          eq(progressUpdates.projectId, projectId),
          eq(progressUpdates.generatedByAI, true)
        )
      );

    return new Set(linkedImageUrls.map(img => img.mediaUrl));
  }

  /**
   * Get unanalyzed images for a project
   * Images are considered unanalyzed if they haven't been linked to an AI-generated update
   */
  private async getUnanalyzedImages(projectId: number) {
    // Get all images for project that don't have an AI-generated update
    const allImages = await db
      .select()
      .from(adminImages)
      .where(
        and(
          eq(adminImages.projectId, projectId),
          eq(adminImages.category, 'progress'),
          eq(adminImages.visibility, 'published') // Only process published images
        )
      )
      .orderBy(desc(adminImages.createdAt));

    // Get URLs of images that are already processed
    const processedUrls = await this.getProcessedImageUrls(projectId);

    // Return images not yet linked to an AI update
    return allImages.filter(img => !processedUrls.has(img.imageUrl));
  }

  /**
   * Get the latest summary for a project to use as context
   */
  private async getLatestSummary(projectId: number) {
    return await db.query.progressReportSummaries.findFirst({
      where: eq(progressReportSummaries.projectId, projectId),
      orderBy: desc(progressReportSummaries.createdAt),
    });
  }

  /**
   * Create a draft progress update from AI analysis
   */
  private async createDraftProgressUpdate(params: {
    projectId: number;
    analysis: AnalysisResult;
    images: any[];
    cost: { total: number; inputCost: number; outputCost: number };
    userId: number;
  }): Promise<any> {
    const { projectId, analysis, images, cost, userId } = params;

    // Build title from date range
    const dates = images.map(img => new Date(img.metadata?.captureDate || img.createdAt));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const dateStr = minDate.toDateString() === maxDate.toDateString()
      ? minDate.toLocaleDateString()
      : `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;

    const title = `AI Progress Report: ${dateStr}`;

    // Build description from analysis
    let description = `${analysis.executiveSummary}\n\n`;

    if (analysis.keyObservations.length > 0) {
      description += `**Key Observations:**\n${analysis.keyObservations.map(obs => `• ${obs}`).join('\n')}\n\n`;
    }

    if (Object.keys(analysis.progressEstimate).length > 0) {
      description += `**Progress Estimate:**\n${Object.entries(analysis.progressEstimate)
        .map(([phase, pct]) => `• ${phase}: ${pct}%`)
        .join('\n')}\n\n`;
    }

    if (analysis.concernsOrIssues.length > 0) {
      description += `**Concerns/Issues:**\n${analysis.concernsOrIssues.map(c => `• ${c}`).join('\n')}\n\n`;
    }

    if (analysis.recommendedActions.length > 0) {
      description += `**Recommended Actions:**\n${analysis.recommendedActions.map(a => `• ${a}`).join('\n')}`;
    }

    // Create the progress update
    const [progressUpdate] = await db
      .insert(progressUpdates)
      .values({
        projectId,
        title,
        description,
        updateType: 'ai_analysis',
        createdById: userId,
        generatedByAI: true,
        status: 'draft',
        visibility: 'admin_only',
        aiAnalysisMetadata: {
          confidence: analysis.confidence,
          tokensUsed: analysis.tokensUsed,
          cost: { total: cost.total },
          model: 'gemini-2.0-flash-exp',
          imageIds: images.map(img => img.id),
          previousSummaryUsed: true,
        },
        rawLLMResponse: {
          executiveSummary: analysis.executiveSummary,
          keyObservations: analysis.keyObservations,
          progressEstimate: analysis.progressEstimate,
          concernsOrIssues: analysis.concernsOrIssues,
          recommendedActions: analysis.recommendedActions,
          rawText: analysis.rawResponse,
        },
      })
      .returning();

    return progressUpdate;
  }

  /**
   * Link images to the progress update via update_media
   */
  private async linkImagesToUpdate(updateId: number, images: any[]) {
    const mediaRecords = images.map(img => ({
      updateId,
      mediaUrl: img.imageUrl,
      mediaType: 'image' as const,
      caption: img.title,
      uploadedById: null, // Images were uploaded previously
    }));

    await db.insert(updateMedia).values(mediaRecords);
  }

  /**
   * Create a summary entry for future LLM context
   */
  private async createSummaryEntry(params: {
    projectId: number;
    progressUpdateId: number;
    analysis: AnalysisResult;
    images: any[];
    userId: number;
  }) {
    const { projectId, progressUpdateId, analysis, images, userId } = params;

    // Build compressed summary text
    const summaryText = `${analysis.executiveSummary} Key work: ${analysis.keyObservations.slice(0, 3).join('; ')}. ${
      analysis.concernsOrIssues.length > 0 ? `Issues: ${analysis.concernsOrIssues.join('; ')}.` : ''
    }`;

    // Get date range
    const dates = images.map(img => new Date(img.metadata?.captureDate || img.createdAt));
    const dateFrom = new Date(Math.min(...dates.map(d => d.getTime())));
    const dateTo = new Date(Math.max(...dates.map(d => d.getTime())));

    await db.insert(progressReportSummaries).values({
      projectId,
      progressUpdateId,
      summaryText,
      dateFrom,
      dateTo,
      progressSnapshot: {
        phaseProgress: analysis.progressEstimate,
      },
      imageCount: images.length,
      generatedById: userId,
    });
  }

  /**
   * Group images by capture date for batch processing
   */
  async groupImagesByDate(projectId: number): Promise<ImageBatch[]> {
    const images = await this.getUnanalyzedImages(projectId);

    // Group by date
    const grouped = new Map<string, typeof images>();

    for (const image of images) {
      const date = new Date(image.metadata?.captureDate || image.createdAt);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(image);
    }

    // Convert to batches
    return Array.from(grouped.entries()).map(([dateStr, imgs]) => ({
      date: new Date(dateStr),
      images: imgs.map(img => ({
        id: img.id,
        title: img.title,
        imageUrl: img.imageUrl,
        captureDate: new Date(img.metadata?.captureDate || img.createdAt),
        metadata: img.metadata,
      })),
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
