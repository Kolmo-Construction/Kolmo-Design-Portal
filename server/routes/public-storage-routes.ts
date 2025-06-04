// server/routes/public-storage-routes.ts
import { Router, Request, Response } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@server/r2-upload";

const router = Router();

/**
 * Get a signed URL for an image in R2 storage (public access)
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

    // Create a presigned URL for the object
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: decodeURIComponent(key),
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    
    console.log(`Generated signed URL for ${key}: ${signedUrl}`);
    res.json({ url: signedUrl });
  } catch (error) {
    console.error("Error getting signed URL:", error);
    res.status(500).json({ error: "Failed to get image URL" });
  }
});

export { router as publicStorageRoutes };