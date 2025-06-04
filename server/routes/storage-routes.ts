import { Router } from 'express';
import multer from 'multer';
import { uploadToR2, deleteFromR2, getR2DownloadUrl } from '../r2-upload';
import { isAuthenticated } from '../middleware/auth.middleware';
import { HttpError, createBadRequestError, createNotFoundError } from '../errors';

function getContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export const storageRoutes = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDFs are allowed.'));
    }
  },
});

/**
 * Get a signed URL for an image in R2 storage
 */
storageRoutes.get('/image/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      throw createBadRequestError('Image key is required');
    }

    const signedUrl = await getR2DownloadUrl(key);
    res.json({ url: signedUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * Proxy image from R2 storage to avoid CORS issues
 * This function handles fetching images from R2 with extensive fallbacks
 */
storageRoutes.get('/proxy/:key(*)', async (req, res, next) => {
  try {
    const key = req.params.key;
    
    if (!key) {
      throw createBadRequestError('Image key is required');
    }

    // Get signed URL and fetch the image
    const signedUrl = await getR2DownloadUrl(key);
    
    // Fetch the image from R2
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      throw createNotFoundError('Image not found');
    }

    // Set appropriate headers
    const contentType = getContentType(key);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600', // 1 hour cache
    });

    // Stream the image data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

/**
 * Check if a file exists in R2 storage
 */
storageRoutes.head('/check/:key(*)', async (req, res, next) => {
  try {
    const key = req.params.key;
    
    if (!key) {
      throw createBadRequestError('Image key is required');
    }

    const signedUrl = await getR2DownloadUrl(key);
    const response = await fetch(signedUrl, { method: 'HEAD' });
    
    if (response.ok) {
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    res.status(404).end();
  }
});

/**
 * Upload a quote image
 */
storageRoutes.post('/upload/quote/:quoteId', isAuthenticated, upload.single('image'), async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    const { imageType, caption } = req.body;
    
    if (!req.file) {
      throw createBadRequestError('No file uploaded');
    }

    if (!quoteId || isNaN(parseInt(quoteId))) {
      throw createBadRequestError('Valid quote ID is required');
    }

    const result = await uploadToR2({
      quoteId: parseInt(quoteId),
      fileName: req.file.originalname,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      imageType: imageType || 'general',
    });

    // Update database with the R2 URL based on image type
    const { db } = await import('../db');
    const { quoteImages, customerQuotes } = await import('../../shared/schema');
    const { eq, and } = await import('drizzle-orm');

    if (imageType === 'before') {
      // Update the before image URL in the quote
      await db.update(customerQuotes)
        .set({ beforeImageUrl: result.url })
        .where(eq(customerQuotes.id, parseInt(quoteId)));
      
      // Also update the before image record
      await db.update(quoteImages)
        .set({ imageUrl: result.url, caption: caption || null })
        .where(and(
          eq(quoteImages.quoteId, parseInt(quoteId)),
          eq(quoteImages.imageType, 'before')
        ));
    } else if (imageType === 'after') {
      // Update the after image URL in the quote
      await db.update(customerQuotes)
        .set({ afterImageUrl: result.url })
        .where(eq(customerQuotes.id, parseInt(quoteId)));
      
      // Also update the after image record
      await db.update(quoteImages)
        .set({ imageUrl: result.url, caption: caption || null })
        .where(and(
          eq(quoteImages.quoteId, parseInt(quoteId)),
          eq(quoteImages.imageType, 'after')
        ));
    } else {
      // For other image types, update the corresponding image record
      await db.update(quoteImages)
        .set({ imageUrl: result.url, caption: caption || null })
        .where(and(
          eq(quoteImages.quoteId, parseInt(quoteId)),
          eq(quoteImages.imageType, imageType || 'general')
        ));
    }

    res.json({
      success: true,
      url: result.url,
      key: result.key,
      imageType: imageType || 'general',
      caption: caption || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload a file to R2 storage
 */
storageRoutes.post('/upload', isAuthenticated, upload.single('file'), async (req, res, next) => {
  try {
    const { quoteId, imageType } = req.body;
    
    if (!req.file) {
      throw createBadRequestError('No file uploaded');
    }

    if (!quoteId || isNaN(parseInt(quoteId))) {
      throw createBadRequestError('Valid quote ID is required');
    }

    const result = await uploadToR2({
      quoteId: parseInt(quoteId),
      fileName: req.file.originalname,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      imageType: imageType || 'general',
    });

    res.json({
      success: true,
      url: result.url,
      key: result.key,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload a local file to R2 storage
 */
storageRoutes.post('/upload-local', isAuthenticated, async (req, res, next) => {
  try {
    const { quoteId, fileName, base64Data, mimeType, imageType } = req.body;
    
    if (!quoteId || !fileName || !base64Data) {
      throw createBadRequestError('Quote ID, file name, and base64 data are required');
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    const result = await uploadToR2({
      quoteId: parseInt(quoteId),
      fileName,
      buffer,
      mimetype: mimeType || 'application/octet-stream',
      imageType: imageType || 'general',
    });

    res.json({
      success: true,
      url: result.url,
      key: result.key,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List all objects in R2 storage
 */
storageRoutes.get('/list', isAuthenticated, async (req, res, next) => {
  try {
    // This would require additional S3 ListObjects implementation
    // For now, return empty list as this feature isn't critical
    res.json({ objects: [] });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a file from R2 storage
 */
storageRoutes.delete('/delete/:key(*)', isAuthenticated, async (req, res, next) => {
  try {
    const key = req.params.key;
    
    if (!key) {
      throw createBadRequestError('File key is required');
    }

    await deleteFromR2(key);
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});