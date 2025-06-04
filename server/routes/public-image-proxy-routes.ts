// server/routes/public-image-proxy-routes.ts
import { Router, Request, Response } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "@server/r2-upload";

const router = Router();

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
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    case 'ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Proxy image from R2 storage to avoid CORS issues (public access)
 * This function handles fetching images from R2 and serves them directly
 */
router.get("/:key(*)", async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ error: "Key parameter is required" });
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      console.error("AWS_S3_BUCKET environment variable is not set");
      return res.status(500).json({ error: "Storage configuration error" });
    }

    // Get the object from R2
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: decodeURIComponent(key),
    });

    console.log(`Fetching image from R2: ${key}`);
    const response = await r2Client.send(command);

    if (!response.Body) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Set appropriate content type
    const contentType = getContentType(key);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the image data
    const stream = response.Body as any;
    stream.pipe(res);

  } catch (error: any) {
    console.error("Error proxying image:", error);
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ error: "Image not found" });
    }
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

export { router as publicImageProxyRoutes };