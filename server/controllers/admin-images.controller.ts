// server/controllers/admin-images.controller.ts
import { Request, Response } from 'express';
import { db } from '../db';
import { adminImages } from '../../shared/schema';
import { uploadToR2 } from '../r2-upload';
import { eq, desc, and, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { calculateDistance } from '../services/geofencing.service';
import { geminiReceiptService } from '../services/gemini-receipt.service';

// Geofence radius for mobile image uploads
// Note: More lenient than time tracking (100m) since contractors may take photos from nearby
const MOBILE_UPLOAD_GEOFENCE_METERS = 500;

export class AdminImagesController {

  /**
   * Process unassigned photos and match them to projects using geofencing
   * Enhanced with AI analysis and automatic progress update creation
   */
  async processUnassignedPhotos(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Only admins and project managers can process photos
      if (userRole !== 'admin' && userRole !== 'projectManager') {
        return res.status(403).json({ message: 'Access denied. Admin or project manager role required.' });
      }

      // Get all unassigned photos
      const unassignedPhotos = await db
        .select()
        .from(adminImages)
        .where(sql`${adminImages.projectId} IS NULL`)
        .orderBy(desc(adminImages.createdAt));

      console.log(`[Photo Processing] Found ${unassignedPhotos.length} unassigned photos`);

      if (unassignedPhotos.length === 0) {
        return res.status(200).json({
          message: 'No unassigned photos to process',
          processed: 0,
          matched: 0,
        });
      }

      // Get all projects with GPS coordinates
      const { storage } = await import('../storage');
      const allProjects = await storage.projects.getAllProjects();
      const projectsWithGPS = allProjects.filter(p => p.latitude && p.longitude);

      console.log(`[Photo Processing] Found ${projectsWithGPS.length} projects with GPS coordinates`);

      let matchedCount = 0;
      let analyzedCount = 0;
      const matchDetails = [];
      const photosByProject = new Map<number, Array<{ photo: any; analysis: any }>>();

      // Process each unassigned photo
      for (const photo of unassignedPhotos) {
        const metadata = photo.metadata as any;

        // Extract GPS coordinates from metadata (support multiple formats)
        const locationData = metadata?.location?.coords || metadata?.location || metadata?.gps;

        if (!locationData || !locationData.latitude || !locationData.longitude) {
          console.log(`[Photo Processing] Photo ${photo.id} has no GPS data, skipping`);
          continue;
        }

        const photoLat = locationData.latitude;
        const photoLng = locationData.longitude;

        console.log(`[Photo Processing] Processing photo ${photo.id} at ${photoLat}, ${photoLng}`);

        // Find matching projects within geofence
        const projectsWithDistance = projectsWithGPS
          .map(p => {
            const projectLat = parseFloat(p.latitude as string);
            const projectLng = parseFloat(p.longitude as string);
            const distance = calculateDistance(photoLat, photoLng, projectLat, projectLng);
            return { project: p, distance };
          })
          .filter(p => p.distance <= MOBILE_UPLOAD_GEOFENCE_METERS)
          .sort((a, b) => a.distance - b.distance);

        if (projectsWithDistance.length > 0) {
          // Match found! Get the closest project
          const matchedProject = projectsWithDistance[0];

          console.log(`[Photo Processing] ✅ Matched photo ${photo.id} to project "${matchedProject.project.name}" (${matchedProject.distance.toFixed(2)}m away)`);

          // Analyze photo with AI
          let aiAnalysis = null;
          if (geminiReceiptService.isConfigured()) {
            try {
              console.log(`[Photo Processing] 🤖 Analyzing photo ${photo.id} with AI...`);

              // Build project context
              const projectContext = `${matchedProject.project.name}${matchedProject.project.description ? ': ' + matchedProject.project.description : ''}`;

              aiAnalysis = await geminiReceiptService.analyzeConstructionPhoto(
                photo.imageUrl,
                projectContext
              );

              analyzedCount++;
              console.log(`[Photo Processing] ✅ AI analysis complete: "${aiAnalysis.caption}"`);
            } catch (aiError) {
              console.error(`[Photo Processing] ⚠️ AI analysis failed for photo ${photo.id}:`, aiError);
              // Continue without AI analysis
            }
          }

          // Update photo with project assignment and AI analysis
          const updateData: any = {
            projectId: matchedProject.project.id,
            updatedAt: new Date(),
          };

          // Add AI-generated caption and tags if available
          if (aiAnalysis) {
            updateData.title = aiAnalysis.caption;
            updateData.tags = aiAnalysis.suggestedTags;
            updateData.metadata = {
              ...metadata,
              aiAnalysis: {
                detectedElements: aiAnalysis.detectedElements,
                workStatus: aiAnalysis.workStatus,
                analyzedAt: new Date().toISOString(),
              },
            };
          }

          await db
            .update(adminImages)
            .set(updateData)
            .where(eq(adminImages.id, photo.id));

          matchedCount++;
          matchDetails.push({
            photoId: photo.id,
            photoTitle: aiAnalysis?.caption || photo.title,
            projectId: matchedProject.project.id,
            projectName: matchedProject.project.name,
            distance: Math.round(matchedProject.distance),
            aiAnalyzed: !!aiAnalysis,
          });

          // Group photos by project for progress update creation
          if (!photosByProject.has(matchedProject.project.id)) {
            photosByProject.set(matchedProject.project.id, []);
          }
          photosByProject.get(matchedProject.project.id)!.push({
            photo: { ...photo, imageUrl: photo.imageUrl },
            analysis: aiAnalysis,
          });

        } else {
          console.log(`[Photo Processing] ❌ No project match found for photo ${photo.id}`);
        }
      }

      // Create progress updates for each project with matched photos
      let progressUpdatesCreated = 0;
      const progressUpdateDetails = [];

      if (geminiReceiptService.isConfigured() && photosByProject.size > 0) {
        console.log(`[Photo Processing] 📝 Creating progress updates for ${photosByProject.size} projects...`);

        for (const [projectId, photosData] of photosByProject) {
          try {
            const project = projectsWithGPS.find(p => p.id === projectId);
            if (!project) continue;

            // Prepare photo data for AI summary
            const photoSummaries = photosData.map(pd => ({
              url: pd.photo.imageUrl,
              caption: pd.analysis?.caption || 'Construction photo',
            }));

            // Generate project status update using AI
            const statusUpdate = await geminiReceiptService.generateProjectUpdate(
              photoSummaries,
              {
                name: project.name,
                description: project.description || undefined,
              }
            );

            console.log(`[Photo Processing] 📋 Generated update for "${project.name}": ${statusUpdate}`);

            // Create progress update with photos as media
            const mediaItems = photosData.map(pd => ({
              mediaType: 'image' as const,
              mediaUrl: pd.photo.imageUrl,
              caption: pd.analysis?.caption || undefined,
            }));

            const progressUpdate = await storage.progressUpdates.createProgressUpdateWithMedia(
              {
                projectId: projectId,
                content: statusUpdate,
                status: 'approved',
                visibility: 'published',
                createdById: userId,
              },
              mediaItems
            );

            if (progressUpdate) {
              progressUpdatesCreated++;
              progressUpdateDetails.push({
                projectId,
                projectName: project.name,
                updateId: progressUpdate.id,
                photoCount: photosData.length,
              });
              console.log(`[Photo Processing] ✅ Progress update created for "${project.name}" with ${photosData.length} photos`);
            }
          } catch (updateError) {
            console.error(`[Photo Processing] ⚠️ Failed to create progress update for project ${projectId}:`, updateError);
            // Continue with other projects
          }
        }
      }

      return res.status(200).json({
        message: `Processed ${unassignedPhotos.length} photos: matched ${matchedCount} to projects, analyzed ${analyzedCount} with AI, created ${progressUpdatesCreated} progress updates`,
        processed: unassignedPhotos.length,
        matched: matchedCount,
        analyzed: analyzedCount,
        progressUpdatesCreated,
        details: matchDetails,
        progressUpdates: progressUpdateDetails,
      });

    } catch (error) {
      console.error('Error processing unassigned photos:', error);
      return res.status(500).json({
        message: 'Failed to process unassigned photos',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Upload multiple images with metadata preservation
   */
  async uploadImages(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Check authorization - admin, project managers, and contractors can upload
      if (userRole !== 'admin' && userRole !== 'projectManager' && userRole !== 'contractor') {
        return res.status(403).json({ message: 'Access denied. Admin, project manager, or contractor role required.' });
      }

      // Validate that we have files
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'No images provided' });
      }

      const files = req.files as Express.Multer.File[];
      const { title, description, category, tags, projectId, metadata } = req.body;

      // Parse JSON fields
      let parsedTags: string[] = [];
      let parsedMetadata: any = {};

      try {
        if (tags) parsedTags = JSON.parse(tags);
        if (metadata) parsedMetadata = JSON.parse(metadata);
      } catch (error) {
        console.error('Error parsing JSON fields:', error);
      }

      // Parse and validate projectId - handle "default-project" or non-numeric strings
      let validProjectId: number | null = null;
      if (projectId) {
        const parsedProjectId = parseInt(projectId, 10);
        if (!isNaN(parsedProjectId) && parsedProjectId > 0) {
          validProjectId = parsedProjectId;
        }
      }

      // Auto-detect project using GEOFENCING if not provided or invalid
      let matchedProjectName: string | null = null;
      let matchedDistance: number | null = null;

      if (!validProjectId) {
        try {
          const { storage } = await import('../storage');
          const userProjects = await storage.projects.getProjectsForUser(String(userId));

          // Try geofencing first if we have location data
          // Support both formats: location.coords.latitude (iOS) and location.latitude (Android)
          const locationData = parsedMetadata.location?.coords || parsedMetadata.location || parsedMetadata.gps;
          if (locationData && locationData.latitude && locationData.longitude) {
            const photoLat = locationData.latitude;
            const photoLng = locationData.longitude;

            console.log(`[Geofencing] Photo taken at: ${photoLat}, ${photoLng}`);

            // Find projects with location data and calculate distances
            const projectsWithDistance = userProjects
              .filter(p => p.latitude && p.longitude)
              .map(p => {
                const projectLat = parseFloat(p.latitude as string);
                const projectLng = parseFloat(p.longitude as string);
                const distance = calculateDistance(photoLat, photoLng, projectLat, projectLng);
                console.log(`[Geofencing] Project "${p.name}" distance: ${distance.toFixed(2)}m`);
                return { project: p, distance };
              })
              .filter(p => p.distance <= MOBILE_UPLOAD_GEOFENCE_METERS)
              .sort((a, b) => a.distance - b.distance); // Closest first

            if (projectsWithDistance.length > 0) {
              // Found project(s) within geofence
              validProjectId = projectsWithDistance[0].project.id;
              matchedProjectName = projectsWithDistance[0].project.name;
              matchedDistance = projectsWithDistance[0].distance;
              console.log(`[Geofencing] ✅ Matched to project "${matchedProjectName}" (${matchedDistance.toFixed(2)}m away)`);
            } else {
              console.log(`[Geofencing] ❌ No projects found within 500m radius`);
            }
          }

          // Fallback to simple logic if geofencing didn't find a match
          if (!validProjectId) {
            if (userProjects.length === 1) {
              validProjectId = userProjects[0].id;
              console.log(`[Image Upload] Fallback: Auto-assigned to user's only project: ${validProjectId}`);
            } else if (userProjects.length > 1) {
              validProjectId = userProjects[0].id;
              console.log(`[Image Upload] Fallback: Auto-assigned to user's most recent project: ${validProjectId}`);
            } else {
              console.log(`[Image Upload] No projects found for user ${userId}, storing without project`);
            }
          }
        } catch (error) {
          console.error('Error auto-detecting project:', error);
        }
      }

      const uploadedImages = [];

      for (const file of files) {
        // Skip non-image files (e.g., JSON metadata files from mobile app)
        // The metadata is already passed in req.body.metadata, so we don't need the JSON file
        if (!file.mimetype.startsWith('image/')) {
          console.log(`Skipping non-image file: ${file.originalname} (${file.mimetype})`);
          continue;
        }

        // Upload to R2 storage
        const uploadResult = await uploadToR2({
          fileName: file.originalname,
          buffer: file.buffer,
          mimetype: file.mimetype,
          path: 'admin-images/',
        });

        // Extract additional metadata from the file
        const fileMetadata = {
          ...parsedMetadata,
          originalSize: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
          originalMimeType: file.mimetype,
        };

        // Generate a meaningful title from metadata if not provided
        let imageTitle = title;
        if (!imageTitle) {
          const timestamp = parsedMetadata.timestamp || fileMetadata.uploadedAt;
          const date = new Date(timestamp);
          const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          // Build title with project name if matched via geofencing
          let titlePrefix = 'Site photo';
          if (matchedProjectName) {
            titlePrefix = `${matchedProjectName} site`;
          }

          // Try to create a meaningful title from metadata
          const locationData = parsedMetadata.location?.coords || parsedMetadata.location || parsedMetadata.gps;

          if (parsedMetadata.location?.address) {
            // Use location if available
            const address = parsedMetadata.location.address;
            const shortAddress = address.split(',')[0]; // Get first part of address
            imageTitle = `${titlePrefix} at ${shortAddress} - ${formattedDate}`;
          } else if (locationData && locationData.latitude && locationData.longitude) {
            // Use coordinates if no address
            const { latitude, longitude } = locationData;
            imageTitle = `${titlePrefix} (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) - ${formattedDate}`;
          } else {
            // Fallback to timestamp only
            imageTitle = `${titlePrefix} - ${formattedDate}`;
          }
        }

        // Create database record
        const [newImage] = await db
          .insert(adminImages)
          .values({
            title: imageTitle,
            description: description || null,
            imageUrl: uploadResult.url,
            originalFilename: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            metadata: fileMetadata,
            tags: parsedTags,
            category: category || 'general',
            projectId: validProjectId,
            uploadedById: userId,
          })
          .returning();

        uploadedImages.push(newImage);
      }

      res.status(201).json({
        message: `${uploadedImages.length} image(s) uploaded successfully`,
        images: uploadedImages,
      });

    } catch (error) {
      console.error('Error uploading admin images:', error);
      console.error('Request body:', req.body);
      console.error('Files:', req.files ? (req.files as Express.Multer.File[]).map(f => ({ name: f.originalname, size: f.size })) : 'none');
      res.status(500).json({
        message: 'Failed to upload images',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all admin images with filtering and pagination
   */
  async getImages(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Check authorization - allow clients to view project images
      // Contractors cannot view images at all
      if (userRole === 'contractor') {
        return res.status(403).json({ message: 'Contractors cannot view images.' });
      }

      // Admin and PM can see all, clients can only see their project images
      if (userRole === 'client') {
        // Clients must specify a projectId and can only see their assigned projects
        const { projectId } = req.query;
        if (!projectId) {
          return res.status(403).json({ message: 'Project ID required for client access.' });
        }
        // Note: Additional check to verify client has access to this project should be added
      }

      const { 
        page = '1', 
        limit = '20', 
        category, 
        projectId, 
        tags,
        search 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build query conditions
      const conditions = [];

      // Admin gallery should ONLY show unassigned photos by default
      // Once assigned to a project, photos appear in project progress updates instead
      if (projectId) {
        conditions.push(eq(adminImages.projectId, parseInt(projectId as string)));
      } else {
        // Show only unassigned photos in the gallery
        conditions.push(sql`${adminImages.projectId} IS NULL`);
      }

      if (category && category !== 'all') {
        conditions.push(eq(adminImages.category, category as string));
      }

      if (search) {
        conditions.push(
          sql`(${adminImages.title} ILIKE ${'%' + search + '%'} OR ${adminImages.description} ILIKE ${'%' + search + '%'})`
        );
      }

      // Filter by tags if provided
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        conditions.push(
          sql`${adminImages.tags} && ${tagArray}`
        );
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // Get images with pagination
      const images = await db
        .select()
        .from(adminImages)
        .where(whereCondition)
        .orderBy(desc(adminImages.createdAt))
        .limit(limitNum)
        .offset(offset);

      // Get total count for pagination
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(adminImages)
        .where(whereCondition);

      res.json({
        images,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          pages: Math.ceil(count / limitNum),
        },
      });

    } catch (error) {
      console.error('Error fetching admin images:', error);
      res.status(500).json({ 
        message: 'Failed to fetch images', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Update image metadata and tags
   */
  async updateImage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { id } = req.params;

      // Check authorization
      if (userRole !== 'admin' && userRole !== 'projectManager') {
        return res.status(403).json({ message: 'Access denied. Admin or project manager role required.' });
      }

      const { title, description, category, tags, projectId } = req.body;

      // Check if image exists
      const [existingImage] = await db
        .select()
        .from(adminImages)
        .where(eq(adminImages.id, parseInt(id)))
        .limit(1);

      if (!existingImage) {
        return res.status(404).json({ message: 'Image not found' });
      }

      // Update the image
      const [updatedImage] = await db
        .update(adminImages)
        .set({
          title: title || existingImage.title,
          description: description !== undefined ? description : existingImage.description,
          category: category || existingImage.category,
          tags: tags || existingImage.tags,
          projectId: projectId !== undefined ? (projectId ? parseInt(projectId) : null) : existingImage.projectId,
          updatedAt: new Date(),
        })
        .where(eq(adminImages.id, parseInt(id)))
        .returning();

      res.json({
        message: 'Image updated successfully',
        image: updatedImage,
      });

    } catch (error) {
      console.error('Error updating admin image:', error);
      res.status(500).json({ 
        message: 'Failed to update image', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Delete an image
   */
  async deleteImage(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { id } = req.params;

      // Check authorization
      if (userRole !== 'admin' && userRole !== 'projectManager') {
        return res.status(403).json({ message: 'Access denied. Admin or project manager role required.' });
      }

      // Check if image exists
      const [existingImage] = await db
        .select()
        .from(adminImages)
        .where(eq(adminImages.id, parseInt(id)))
        .limit(1);

      if (!existingImage) {
        return res.status(404).json({ message: 'Image not found' });
      }

      // Delete from database
      await db
        .delete(adminImages)
        .where(eq(adminImages.id, parseInt(id)));

      res.json({
        message: 'Image deleted successfully',
      });

    } catch (error) {
      console.error('Error deleting admin image:', error);
      res.status(500).json({ 
        message: 'Failed to delete image', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Get image statistics
   */
  async getImageStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Check authorization
      if (userRole !== 'admin' && userRole !== 'projectManager') {
        return res.status(403).json({ message: 'Access denied. Admin or project manager role required.' });
      }

      // Get total unassigned images count (gallery only shows unassigned photos)
      const [{ totalImages }] = await db
        .select({ totalImages: sql<number>`count(*)` })
        .from(adminImages)
        .where(sql`${adminImages.projectId} IS NULL`);

      // Get unassigned images by category
      const categoryStats = await db
        .select({
          category: adminImages.category,
          count: sql<number>`count(*)`,
        })
        .from(adminImages)
        .where(sql`${adminImages.projectId} IS NULL`)
        .groupBy(adminImages.category);

      // Get total storage used by unassigned photos
      const [{ totalStorage }] = await db
        .select({ totalStorage: sql<number>`sum(${adminImages.fileSize})` })
        .from(adminImages)
        .where(sql`${adminImages.projectId} IS NULL`);

      // Get most used tags from unassigned photos
      const tagStats = await db
        .select({
          tag: sql<string>`unnest(${adminImages.tags})`,
          count: sql<number>`count(*)`,
        })
        .from(adminImages)
        .where(sql`${adminImages.projectId} IS NULL AND ${adminImages.tags} IS NOT NULL AND array_length(${adminImages.tags}, 1) > 0`)
        .groupBy(sql`unnest(${adminImages.tags})`)
        .orderBy(sql`count(*) DESC`)
        .limit(10);

      res.json({
        totalImages: totalImages || 0,
        totalStorage: totalStorage || 0,
        categoryStats,
        popularTags: tagStats,
      });

    } catch (error) {
      console.error('Error fetching image statistics:', error);
      res.status(500).json({ 
        message: 'Failed to fetch statistics', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}