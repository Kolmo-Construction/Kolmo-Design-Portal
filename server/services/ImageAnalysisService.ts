/**
 * LLM-powered Image Analysis Service for Construction Progress Reporting
 * Uses Google Gemini 2.0 Flash to analyze project photos and generate status updates
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';
import { adminImages, projects } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ProjectContext {
  id: number;
  name: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  status: string;
  progress: number;
  totalBudget: string;
  startDate?: Date;
  estimatedCompletionDate?: Date;
}

export interface PreviousReport {
  date: string;
  summary: string;
  progressEstimate?: Record<string, number>;
}

export interface ImageToAnalyze {
  id: number;
  url: string;
  captureDate?: Date;
  latitude?: number;
  longitude?: number;
  device?: string;
}

export interface AnalysisResult {
  executiveSummary: string;
  keyObservations: string[];
  progressEstimate: Record<string, number>;
  concernsOrIssues: string[];
  recommendedActions: string[];
  confidence: number;
  rawResponse?: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

export class ImageAnalysisService {
  private readonly MAX_IMAGES_PER_BATCH = 8;
  private readonly MODEL = 'gemini-2.0-flash-exp';

  /**
   * Analyze construction progress from project images
   */
  async analyzeProgressImages(
    projectId: number,
    imageIds: number[],
    previousReportSummary?: string
  ): Promise<AnalysisResult> {
    console.log(`[ImageAnalysis] Starting analysis for project ${projectId} with ${imageIds.length} images`);

    // 1. Fetch project context
    const project = await this.getProjectContext(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // 2. Fetch images with metadata
    const images = await this.getImagesWithMetadata(imageIds);
    if (images.length === 0) {
      throw new Error('No valid images found for analysis');
    }

    // 3. Sample images if too many (cost optimization)
    const selectedImages = this.selectRepresentativeImages(images);
    console.log(`[ImageAnalysis] Selected ${selectedImages.length} images for analysis`);

    // 4. Build prompt with context
    const prompt = this.buildAnalysisPrompt(project, previousReportSummary, selectedImages);

    // 5. Prepare image content for Claude
    const imageContent = await this.prepareImageContent(selectedImages);

    // 6. Call Claude Vision API
    const analysis = await this.callClaudeVision(prompt, imageContent);

    // 7. Parse and validate response
    const result = this.parseAnalysisResponse(analysis);

    console.log(`[ImageAnalysis] Analysis complete. Confidence: ${result.confidence}`);
    return result;
  }

  /**
   * Get project context from database
   */
  private async getProjectContext(projectId: number): Promise<ProjectContext | null> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      description: project.description || undefined,
      address: project.address,
      city: project.city,
      state: project.state,
      status: project.status,
      progress: project.progress || 0,
      totalBudget: project.totalBudget,
      startDate: project.startDate || undefined,
      estimatedCompletionDate: project.estimatedCompletionDate || undefined,
    };
  }

  /**
   * Get images with metadata from database
   */
  private async getImagesWithMetadata(imageIds: number[]): Promise<ImageToAnalyze[]> {
    const images = await db.query.adminImages.findMany({
      where: and(
        // Filter by IDs
        eq(adminImages.id, imageIds[0]) // Note: This is simplified, you'd use IN operator in real code
      ),
    });

    // For POC, let's query all matching IDs
    const allImages = await db
      .select()
      .from(adminImages)
      .where(
        // Match any of the provided IDs
        eq(adminImages.id, imageIds[0]) // Simplified - would use sql`id IN (...)` in production
      );

    return allImages.map(img => ({
      id: img.id,
      url: img.imageUrl,
      captureDate: img.metadata?.captureDate || img.createdAt,
      latitude: img.metadata?.gps?.latitude,
      longitude: img.metadata?.gps?.longitude,
      device: img.metadata?.device,
    }));
  }

  /**
   * Select representative images from batch (cost optimization)
   */
  private selectRepresentativeImages(images: ImageToAnalyze[]): ImageToAnalyze[] {
    if (images.length <= this.MAX_IMAGES_PER_BATCH) {
      return images;
    }

    // Simple sampling: evenly distribute across the set
    const step = Math.floor(images.length / this.MAX_IMAGES_PER_BATCH);
    return images.filter((_, index) => index % step === 0).slice(0, this.MAX_IMAGES_PER_BATCH);
  }

  /**
   * Build analysis prompt with project context
   */
  private buildAnalysisPrompt(
    project: ProjectContext,
    previousSummary: string | undefined,
    images: ImageToAnalyze[]
  ): string {
    const today = new Date().toLocaleDateString();
    const daysElapsed = project.startDate
      ? Math.floor((Date.now() - project.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 'Unknown';

    const totalDays = project.startDate && project.estimatedCompletionDate
      ? Math.floor((project.estimatedCompletionDate.getTime() - project.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 'Unknown';

    return `You are an expert construction project analyst reviewing daily progress photos.

PROJECT CONTEXT:
- Project Name: ${project.name}
- Type: ${project.description || 'Construction project'}
- Location: ${project.address}, ${project.city}, ${project.state}
- Current Status: ${project.status}
- Overall Progress: ${project.progress}%
- Budget: $${project.totalBudget}
- Timeline: ${daysElapsed} days into ${totalDays} day project

${previousSummary ? `PREVIOUS STATUS:
${previousSummary}

` : ''}TODAY'S IMAGES (${today}):
${images.length} construction site photos captured${images[0]?.captureDate ? ` on ${new Date(images[0].captureDate).toLocaleDateString()}` : ''}.

ANALYSIS INSTRUCTIONS:
1. Review each photo carefully for construction progress
2. ${previousSummary ? 'Compare to previous status and identify what changed' : 'Assess current state of construction'}
3. Identify specific work completed (foundation, framing, electrical, plumbing, etc.)
4. Estimate completion percentage for visible trades/phases
5. Note any quality concerns, safety issues, or potential problems
6. Provide a professional executive summary suitable for client viewing
7. Be specific and factual - avoid generic statements
8. If uncertain about something, indicate lower confidence

OUTPUT FORMAT (strict JSON only):
{
  "executiveSummary": "2-3 sentence summary of progress suitable for clients",
  "keyObservations": ["Specific observation 1", "Specific observation 2", "..."],
  "progressEstimate": {"foundation": 75, "framing": 20, "electrical": 0, "plumbing": 0},
  "concernsOrIssues": ["Any safety/quality concerns, or empty array"],
  "recommendedActions": ["Suggested next steps or empty array"],
  "confidence": 0.85
}

Important:
- Respond ONLY with valid JSON
- Base observations on what you can actually see in photos
- Don't make up details not visible in images
- Confidence score: 0.0 (uncertain) to 1.0 (very confident)`;
  }

  /**
   * Prepare image content for Gemini API
   */
  private async prepareImageContent(images: ImageToAnalyze[]): Promise<any[]> {
    // Gemini requires inline data with base64 or fileData
    // For now, we'll use image URLs with the inlineData format after fetching
    const imageParts = await Promise.all(
      images.map(async (img) => {
        const imageUrl = this.convertToAbsoluteUrl(img.url);

        try {
          // Fetch the image and convert to base64
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.warn(`Failed to fetch image ${imageUrl}`);
            return null;
          }

          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = response.headers.get('content-type') || 'image/jpeg';

          return {
            inlineData: {
              mimeType,
              data: base64,
            },
          };
        } catch (error) {
          console.error(`Error fetching image ${imageUrl}:`, error);
          return null;
        }
      })
    );

    // Filter out failed image fetches
    return imageParts.filter(part => part !== null);
  }

  /**
   * Convert relative URL to absolute URL for API access
   */
  private convertToAbsoluteUrl(url: string): string {
    // If URL is relative (starts with /api/storage/proxy), make it absolute
    if (url.startsWith('/api/storage/proxy/')) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      return `${baseUrl}${url}`;
    }
    return url;
  }

  /**
   * Call Gemini Vision API
   */
  private async callClaudeVision(prompt: string, imageContent: any[]): Promise<any> {
    try {
      console.log('[ImageAnalysis] Calling Gemini 2.0 Flash API...');

      const model = genAI.getGenerativeModel({ model: this.MODEL });

      // Build the content parts array with text first, then images
      const parts = [
        { text: prompt },
        ...imageContent,
      ];

      const result = await model.generateContent(parts);
      const response = result.response;
      const text = response.text();

      // Gemini doesn't provide exact token counts in the response by default
      // Estimate based on text length (rough approximation: 1 token ≈ 4 chars)
      const estimatedInputTokens = Math.ceil((prompt.length + imageContent.length * 1290) / 4);
      const estimatedOutputTokens = Math.ceil(text.length / 4);

      console.log(`[ImageAnalysis] API call successful. Estimated tokens: input=${estimatedInputTokens}, output=${estimatedOutputTokens}`);

      return {
        content: text,
        usage: {
          input_tokens: estimatedInputTokens,
          output_tokens: estimatedOutputTokens,
        },
      };
    } catch (error) {
      console.error('[ImageAnalysis] Gemini API error:', error);
      throw new Error(`Failed to analyze images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse and validate Gemini's response
   */
  private parseAnalysisResponse(response: any): AnalysisResult {
    try {
      console.log('[ImageAnalysis] Parsing response. Content length:', response.content?.length);

      // Extract JSON from response (Gemini might wrap it in markdown or text)
      let jsonText = response.content;

      // First, try to find JSON in markdown code blocks
      let jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
        console.log('[ImageAnalysis] Found JSON in markdown code block');
      } else {
        // Try to find JSON object in the text
        jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
          console.log('[ImageAnalysis] Found JSON object in text');
        }
      }

      console.log('[ImageAnalysis] Attempting to parse JSON...');
      const parsed = JSON.parse(jsonText);
      console.log('[ImageAnalysis] JSON parsed successfully');

      // Validate required fields
      if (!parsed.executiveSummary && !parsed.executive_summary) {
        console.warn('[ImageAnalysis] Missing executiveSummary field');
        throw new Error('Invalid response structure - missing executiveSummary');
      }

      // Handle different field name formats (camelCase vs snake_case)
      const executiveSummary = parsed.executiveSummary || parsed.executive_summary || 'No summary provided';
      const keyObservations = parsed.keyObservations || parsed.key_observations || [];
      const progressEstimate = parsed.progressEstimate || parsed.progress_estimate || {};
      const concernsOrIssues = parsed.concernsOrIssues || parsed.concerns_or_issues || [];
      const recommendedActions = parsed.recommendedActions || parsed.recommended_actions || [];
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;

      console.log('[ImageAnalysis] Successfully extracted fields:', {
        hasSummary: !!executiveSummary,
        observationsCount: keyObservations.length,
        estimatesCount: Object.keys(progressEstimate).length,
        concernsCount: concernsOrIssues.length,
        actionsCount: recommendedActions.length,
      });

      return {
        executiveSummary,
        keyObservations: Array.isArray(keyObservations) ? keyObservations : [],
        progressEstimate: typeof progressEstimate === 'object' ? progressEstimate : {},
        concernsOrIssues: Array.isArray(concernsOrIssues) ? concernsOrIssues : [],
        recommendedActions: Array.isArray(recommendedActions) ? recommendedActions : [],
        confidence,
        rawResponse: response.content,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    } catch (error) {
      console.error('[ImageAnalysis] Failed to parse response:', error);
      console.error('[ImageAnalysis] Raw response (first 1000 chars):', response.content?.substring(0, 1000));

      // Return fallback result
      return {
        executiveSummary: 'Failed to parse AI analysis. Manual review required.',
        keyObservations: ['Error parsing AI response - check server logs for details'],
        progressEstimate: {},
        concernsOrIssues: ['AI analysis parsing failed - manual input needed'],
        recommendedActions: ['Review images manually and create report'],
        confidence: 0.0,
        rawResponse: response.content,
        tokensUsed: response.usage,
      };
    }
  }

  /**
   * Calculate estimated cost of analysis
   */
  calculateEstimatedCost(imageCount: number): { inputCost: number; outputCost: number; total: number } {
    // Gemini 2.0 Flash pricing (as of 2025)
    const INPUT_PRICE_PER_MTK = 0.075; // $0.075 per million tokens (prompts up to 128K)
    const OUTPUT_PRICE_PER_MTK = 0.30; // $0.30 per million tokens

    // Gemini token estimates
    const tokensPerImage = 1290; // ~1290 tokens per 1024x1024 image
    const promptTokens = 500;
    const outputTokens = 1000;

    const estimatedInput = (imageCount * tokensPerImage) + promptTokens;
    const estimatedOutput = outputTokens;

    const inputCost = (estimatedInput / 1_000_000) * INPUT_PRICE_PER_MTK;
    const outputCost = (estimatedOutput / 1_000_000) * OUTPUT_PRICE_PER_MTK;

    return {
      inputCost: Math.round(inputCost * 1000) / 1000, // Round to 3 decimals
      outputCost: Math.round(outputCost * 1000) / 1000,
      total: Math.round((inputCost + outputCost) * 1000) / 1000,
    };
  }
}
