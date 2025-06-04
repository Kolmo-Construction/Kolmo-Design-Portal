import { Router } from "express";
import multer from "multer";
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "../r2-upload";

const upload = multer({ storage: multer.memoryStorage() });

function getContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
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

/**
 * Get a signed URL for an image in R2 storage
 */
storageRoutes.get("/signed-url/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;
    const { expiresIn = 3600 } = req.query;

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: Number(expiresIn),
    });

    res.json({ signedUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
});

/**
 * Proxy image from R2 storage to avoid CORS issues
 * This function handles fetching images from R2 with extensive fallbacks
 */
storageRoutes.get("/proxy/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      return res.status(404).json({ error: "File not found" });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', response.ContentType || getContentType(fileName));
    res.setHeader('Content-Length', response.ContentLength || 0);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    // Stream the file
    const stream = response.Body as NodeJS.ReadableStream;
    stream.pipe(res);
  } catch (error) {
    console.error("Error proxying file:", error);
    res.status(404).json({ error: "File not found" });
  }
});

/**
 * Check if a file exists in R2 storage
 */
storageRoutes.head("/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;

    const command = new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
    });

    const response = await r2Client.send(command);
    
    res.setHeader('Content-Type', response.ContentType || getContentType(fileName));
    res.setHeader('Content-Length', response.ContentLength || 0);
    res.status(200).end();
  } catch (error) {
    res.status(404).end();
  }
});

/**
 * Upload a quote image
 */
storageRoutes.post("/upload/quote-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { originalname, buffer, mimetype } = req.file;
    const timestamp = Date.now();
    const fileName = `quotes/${timestamp}-${originalname}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: mimetype,
      ContentLength: buffer.length,
    });

    await r2Client.send(command);

    const imageUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    res.json({
      success: true,
      fileName,
      imageUrl,
      size: buffer.length,
      contentType: mimetype
    });
  } catch (error) {
    console.error("Error uploading quote image:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

/**
 * Upload a file to R2 storage
 */
storageRoutes.post("/upload", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { folder = 'general' } = req.body;
    const timestamp = Date.now();
    const fileName = `${folder}/${timestamp}-${originalname}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: mimetype,
      ContentLength: buffer.length,
    });

    await r2Client.send(command);

    const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    res.json({
      success: true,
      fileName,
      fileUrl,
      size: buffer.length,
      contentType: mimetype
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

/**
 * Upload a local file to R2 storage
 */
storageRoutes.post("/upload-local", async (req, res) => {
  try {
    const { filePath, fileName, contentType } = req.body;

    if (!filePath || !fileName) {
      return res.status(400).json({ error: "File path and name are required" });
    }

    // This would be used for server-side file uploads
    // Implementation depends on specific requirements

    res.json({ message: "Local file upload endpoint ready" });
  } catch (error) {
    console.error("Error uploading local file:", error);
    res.status(500).json({ error: "Failed to upload local file" });
  }
});

/**
 * List all objects in R2 storage
 */
storageRoutes.get("/list", async (req, res) => {
  try {
    const { prefix, maxKeys = 100 } = req.query;

    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: prefix as string,
      MaxKeys: Number(maxKeys),
    });

    const response = await r2Client.send(command);

    const files = response.Contents?.map(object => ({
      key: object.Key,
      lastModified: object.LastModified,
      size: object.Size,
      url: `${process.env.R2_PUBLIC_URL}/${object.Key}`
    })) || [];

    res.json({
      files,
      hasMore: response.IsTruncated || false,
      nextToken: response.NextContinuationToken
    });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});