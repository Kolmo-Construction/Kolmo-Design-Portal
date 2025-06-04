import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  uploadToR2, 
  getSignedR2Url, 
  objectExistsInR2,
  verifyR2Configuration,
  listObjectsInR2
} from '../../utils/r2-storage';

// Function to determine content type based on file extension
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

export const storageRoutes = Router();

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store files in uploads directory
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

/**
 * Get a signed URL for an image in R2 storage
 */
storageRoutes.get('/image-url/:path(*)', async (req, res) => {
  try {
    const imagePath = req.params.path;
    
    // First check if R2 is configured
    const isConfigured = await verifyR2Configuration();
    if (!isConfigured) {
      return res.json({
        url: null,
        r2Available: false
      });
    }
    
    // Check if image exists in R2
    try {
      const signedUrl = await getSignedR2Url(imagePath);
      return res.json({
        url: signedUrl,
        r2Available: true
      });
    } catch (r2Error) {
      // Image not found in R2, return null URL
      return res.json({
        url: null,
        r2Available: true
      });
    }
  } catch (error) {
    console.error('Error getting image URL:', error);
    return res.status(500).json({
      error: 'Failed to get image URL',
      r2Available: false
    });
  }
});

/**
 * Proxy image from R2 storage to avoid CORS issues
 * This function handles fetching images from R2 with extensive fallbacks
 */
storageRoutes.get('/proxy-image/:path(*)', async (req, res) => {
  try {
    const imagePath = req.params.path;
    
    // Handle external URLs (like unsplash) directly
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      try {
        console.log(`Proxying external URL: ${imagePath}`);
        const response = await fetch(imagePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch external image: ${response.statusText}`);
        }
        
        // Get content type and buffer
        const contentType = response.headers.get('Content-Type') || 'image/jpeg';
        const buffer = await response.arrayBuffer();
        
        // Cache external images for performance
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        
        return res.send(Buffer.from(buffer));
      } catch (externalError) {
        console.error(`Failed to proxy external image: ${imagePath}`, externalError);
        return res.status(404).send('External image not found');
      }
    }
    
    // First check if R2 is configured
    const isConfigured = await verifyR2Configuration();
    
    // Try to serve from local file system first regardless of R2 configuration
    // This ensures development environments work without R2
    const decodedPath = decodeURIComponent(imagePath);
    const cleanPath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
    
    // Try with and without 'uploads/' prefix for local files
    const localPaths = [
      path.join(process.cwd(), decodedPath),
      path.join(process.cwd(), cleanPath),
      path.join(process.cwd(), 'uploads', cleanPath),
      path.join(process.cwd(), cleanPath.replace('uploads/', ''))
    ];
    
    // Log debug info about what we're looking for
    console.log(`Attempting to proxy image: ${imagePath}`);
    console.log(`Normalized paths to check locally: ${localPaths.join(', ')}`);
    
    // Try each local path
    for (const localPath of localPaths) {
      if (fs.existsSync(localPath)) {
        console.log(`Serving local file: ${localPath}`);
        return res.sendFile(localPath);
      }
    }
    
    // If R2 is not configured or we couldn't find the file locally, try to find a placeholder
    if (!isConfigured) {
      console.log('R2 not configured, looking for a placeholder image');
      const defaultImagePath = path.join(process.cwd(), 'public', 'placeholder-image.svg');
      if (fs.existsSync(defaultImagePath)) {
        console.log(`Using placeholder image: ${defaultImagePath}`);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.sendFile(defaultImagePath);
      }
      return res.status(404).send('Image not found and R2 not configured');
    }
    
    // If we get here, R2 is configured and local file doesn't exist
    // Extract the base name pattern to find similar files
    const pathParts = cleanPath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const fileBase = fileName.split('.')[0];
    const fileExt = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    
    // Generate variations of the path to try with R2
    const pathsToTry = [];
    
    // Always try the normalized path first
    pathsToTry.push(cleanPath);
    
    // Handle both folder structures - with and without "uploads/"
    if (cleanPath.startsWith('uploads/')) {
      // If path starts with "uploads/", add a version without it
      pathsToTry.push(cleanPath.replace('uploads/', ''));
    } else {
      // If path doesn't have uploads prefix, try with it
      pathsToTry.push(`uploads/${cleanPath}`);
      
      // Also try with site-assets for clarity
      if (cleanPath.includes('site-assets/')) {
        pathsToTry.push(cleanPath.replace('site-assets/', ''));
      } else if (!cleanPath.startsWith('site-assets/')) {
        pathsToTry.push(`site-assets/${cleanPath}`);
      }
    }
    
    console.log(`R2 paths to try: ${pathsToTry.join(', ')}`);
    
    // Get all objects in R2 for matching
    const allObjects = await listObjectsInR2();
    console.log(`Total objects in R2: ${allObjects.length}`);
    
    // Try exact matches first
    let exactMatch = null;
    for (const pathToTry of pathsToTry) {
      if (allObjects.includes(pathToTry)) {
        exactMatch = pathToTry;
        console.log(`Found exact match in R2: ${exactMatch}`);
        break;
      }
    }
    
    // If no exact match, try looking for similar filenames
    if (!exactMatch) {
      console.log('No exact match found, searching for similar files...');
      for (const pathToTry of pathsToTry) {
        const tryPathParts = pathToTry.split('/');
        const tryPathFileName = tryPathParts[tryPathParts.length - 1];
        const tryPathBase = tryPathParts.slice(0, tryPathParts.length - 1).join('/');
        
        // Try to find a matching file with the same base name in the same folder
        const similarMatch = allObjects.find(obj => {
          const objParts = obj.split('/');
          const objFileName = objParts[objParts.length - 1];
          const objPathBase = objParts.slice(0, objParts.length - 1).join('/');
          
          return objPathBase === tryPathBase && 
                 objFileName.startsWith(fileBase) && 
                 objFileName.endsWith(fileExt);
        });
        
        if (similarMatch) {
          exactMatch = similarMatch;
          console.log(`Found similar match in R2 (same folder): ${exactMatch}`);
          break;
        }
      }
    }
    
    // If still no match, try a more lenient search across all objects
    if (!exactMatch) {
      console.log('No folder match found, searching across all objects...');
      // Look for any object with similar filename pattern regardless of folder
      const anyMatch = allObjects.find(obj => {
        const objParts = obj.split('/');
        const objFileName = objParts[objParts.length - 1];
        
        return objFileName.startsWith(fileBase) && objFileName.endsWith(fileExt);
      });
      
      if (anyMatch) {
        exactMatch = anyMatch;
        console.log(`Found lenient match in R2: ${exactMatch}`);
      } else {
        console.log(`No matches found for ${fileBase}${fileExt} in any folder`);
      }
    }
    
    // Use best match if found, otherwise use original path
    const r2Path = exactMatch || cleanPath;
    console.log(`Using R2 path: ${r2Path}`);
    
    try {
      // Get a signed URL
      const signedUrl = await getSignedR2Url(r2Path);
      console.log(`Generated signed URL for R2 object`);
      
      // Fetch the image content from R2
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from R2: ${response.statusText}`);
      }
      
      // Get the image content type
      const contentType = response.headers.get('Content-Type') || getContentType(imagePath);
      
      // Get the image buffer
      const buffer = await response.arrayBuffer();
      
      // Set the content type header
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      
      // Send the image buffer
      console.log(`Successfully served image from R2: ${r2Path}`);
      return res.send(Buffer.from(buffer));
    } catch (r2Error) {
      console.error('Error proxying image from R2:', r2Error);
      
      // If we reach here, neither local nor R2 file exists
      // Try a default placeholder image as last resort
      const defaultImagePath = path.join(process.cwd(), 'public', 'placeholder-image.svg');
      if (fs.existsSync(defaultImagePath)) {
        console.log('Using default placeholder image');
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.sendFile(defaultImagePath);
      }
      
      // Last resort - return 404
      return res.status(404).send('Image not found in local storage or R2');
    }
  } catch (error) {
    console.error('Error in proxy-image route:', error);
    return res.status(500).send('Failed to proxy image');
  }
});

/**
 * Check if a file exists in R2 storage
 */
storageRoutes.get('/check-file/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    
    // First check if R2 is configured
    const isConfigured = await verifyR2Configuration();
    if (!isConfigured) {
      return res.json({
        exists: false,
        r2Available: false
      });
    }
    
    // Check if file exists in R2
    const exists = await objectExistsInR2(filePath);
    
    return res.json({
      exists,
      r2Available: true
    });
  } catch (error) {
    console.error('Error checking file existence:', error);
    return res.status(500).json({
      error: 'Failed to check file existence',
      r2Available: false
    });
  }
});

/**
 * Upload a quote image
 */
storageRoutes.post('/upload/quote-image', upload.single('file'), async (req, res) => {
  let tempFilePath: string | null = null;
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided'
      });
    }

    tempFilePath = req.file.path;
    
    // Check if R2 is configured - REQUIRED for quote images
    const isConfigured = await verifyR2Configuration();
    
    if (!isConfigured) {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.error(`Error removing temporary quote image file ${tempFilePath}:`, unlinkError);
      }
      
      return res.status(500).json({
        error: 'R2 storage not configured. Quote images require cloud storage.',
        success: false
      });
    }
    
    try {
      // Upload to R2 with quotes prefix
      const fileBuffer = fs.readFileSync(tempFilePath);
      const key = await uploadToR2(fileBuffer, req.file.originalname, {
        prefix: 'quotes',
      });
      
      console.log(`Uploaded quote image to R2: ${key}`);
      
      // Clean up local file after successful upload
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Successfully removed temporary quote image file: ${tempFilePath}`);
      } catch (unlinkError) {
        console.error(`Error removing temporary quote image file ${tempFilePath}:`, unlinkError);
      }
      
      // Return the R2 key as the URL (will be proxied through our API)
      return res.status(201).json({ 
        url: `/api/storage/proxy-image/${key}`,
        r2Key: key,
        success: true 
      });
    } catch (r2Error: any) {
      console.error('Failed to upload quote image to R2:', r2Error);
      
      // Clean up temp file on error
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.error(`Error removing temporary quote image file ${tempFilePath}:`, unlinkError);
      }
      
      return res.status(500).json({
        error: 'Failed to upload image to R2 storage',
        details: r2Error?.message || 'Unknown error',
        success: false
      });
    }
  } catch (error) {
    console.error('Error uploading quote image:', error);
    
    // Cleanup on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file after error: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary file ${tempFilePath}:`, cleanupError);
      }
    }
    
    return res.status(500).json({
      error: 'Failed to upload quote image'
    });
  }
});

/**
 * Upload a file to R2 storage
 */
storageRoutes.post('/upload', upload.single('file'), async (req, res) => {
  let tempFilePath: string | null = null; // Keep track of temp file path
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided'
      });
    }
    
    tempFilePath = req.file.path; // Store path for potential cleanup
    
    // First check if R2 is configured
    const isConfigured = await verifyR2Configuration();
    if (!isConfigured) {
      return res.status(400).json({
        error: 'R2 storage is not properly configured',
        r2Available: false
      });
    }
    
    // Get file path
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    
    // Get optional prefix
    const prefix = req.body.prefix || '';
    
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Upload to R2
    const key = await uploadToR2(fileBuffer, fileName, {
      prefix: prefix
    });
    
    // Get signed URL
    const url = await getSignedR2Url(key);
    
    // Clean up local file after successful upload
    try {
      fs.unlinkSync(filePath);
      tempFilePath = null; // Reset path after successful deletion
      console.log(`Successfully removed temporary file: ${filePath}`);
    } catch (unlinkError) {
      console.error(`Error removing temporary file ${filePath}:`, unlinkError);
      // Proceed even if cleanup fails, but log the error
    }
    
    return res.json({
      success: true,
      message: 'File uploaded successfully',
      key,
      url,
      r2Available: true
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    
    // Attempt cleanup even on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temporary file after error: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary file ${tempFilePath} after upload error:`, cleanupError);
      }
    }
    
    return res.status(500).json({
      error: 'Failed to upload file',
      r2Available: false
    });
  }
});

/**
 * Upload a local file to R2 storage
 */
storageRoutes.post('/upload-local', async (req, res) => {
  try {
    const { filePath, prefix, deleteAfterUpload } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        error: 'No file path provided'
      });
    }
    
    // First check if R2 is configured
    const isConfigured = await verifyR2Configuration();
    if (!isConfigured) {
      return res.status(400).json({
        error: 'R2 storage is not properly configured',
        r2Available: false
      });
    }
    
    // Check if file exists
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        error: 'File not found'
      });
    }
    
    // Get file name
    const fileName = path.basename(absolutePath);
    
    // Upload to R2
    const key = await uploadToR2(absolutePath, fileName, {
      prefix: prefix
    });
    
    // Clean up local file if requested
    if (deleteAfterUpload === true) {
      try {
        fs.unlinkSync(absolutePath);
        console.log(`Successfully removed file after upload: ${absolutePath}`);
      } catch (unlinkError) {
        console.error(`Error removing file ${absolutePath} after upload:`, unlinkError);
        // Continue even if cleanup fails
      }
    }
    
    return res.json({
      success: true,
      message: 'File uploaded successfully',
      key,
      r2Available: true
    });
  } catch (error) {
    console.error('Error uploading local file:', error);
    return res.status(500).json({
      error: 'Failed to upload local file',
      r2Available: false
    });
  }
});

/**
 * List all objects in R2 storage
 */
storageRoutes.get('/list-objects', async (req, res) => {
  try {
    // First check if R2 is configured
    const isConfigured = await verifyR2Configuration();
    if (!isConfigured) {
      return res.status(400).json({
        error: 'R2 storage is not properly configured',
        r2Available: false,
        objects: []
      });
    }
    
    // Get all objects
    const objects = await listObjectsInR2();
    
    return res.json({
      success: true,
      r2Available: true,
      objects,
      count: objects.length
    });
  } catch (error) {
    console.error('Error listing R2 objects:', error);
    return res.status(500).json({
      error: 'Failed to list R2 objects',
      r2Available: false,
      objects: []
    });
  }
});