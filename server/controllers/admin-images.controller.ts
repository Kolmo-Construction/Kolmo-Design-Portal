// server/controllers/admin-images.controller.ts
import { Request, Response } from 'express';
import { db } from '../db';
import { adminImages } from '../../shared/schema';
import { uploadToR2 } from '../r2-upload';
import { eq, desc, and, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AdminImagesController {
  
  /**
   * Upload multiple images with metadata preservation
   */
  async uploadImages(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Check authorization - only admin and project managers can upload
      if (userRole !== 'admin' && userRole !== 'projectManager') {
        return res.status(403).json({ message: 'Access denied. Admin or project manager role required.' });
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

      const uploadedImages = [];

      for (const file of files) {
        // Validate file type
        if (!file.mimetype.startsWith('image/')) {
          return res.status(400).json({ 
            message: `Invalid file type: ${file.mimetype}. Only images are allowed.` 
          });
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

        // Create database record
        const [newImage] = await db
          .insert(adminImages)
          .values({
            title: title || file.originalname.replace(/\.[^/.]+$/, ''),
            description: description || null,
            imageUrl: uploadResult.url,
            originalFilename: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
            metadata: fileMetadata,
            tags: parsedTags,
            category: category || 'general',
            projectId: projectId ? parseInt(projectId) : null,
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

      if (category && category !== 'all') {
        conditions.push(eq(adminImages.category, category as string));
      }

      if (projectId) {
        conditions.push(eq(adminImages.projectId, parseInt(projectId as string)));
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

      // Get total images count
      const [{ totalImages }] = await db
        .select({ totalImages: sql<number>`count(*)` })
        .from(adminImages);

      // Get images by category
      const categoryStats = await db
        .select({
          category: adminImages.category,
          count: sql<number>`count(*)`,
        })
        .from(adminImages)
        .groupBy(adminImages.category);

      // Get total storage used
      const [{ totalStorage }] = await db
        .select({ totalStorage: sql<number>`sum(${adminImages.fileSize})` })
        .from(adminImages);

      // Get most used tags
      const tagStats = await db
        .select({
          tag: sql<string>`unnest(${adminImages.tags})`,
          count: sql<number>`count(*)`,
        })
        .from(adminImages)
        .where(sql`${adminImages.tags} IS NOT NULL AND array_length(${adminImages.tags}, 1) > 0`)
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