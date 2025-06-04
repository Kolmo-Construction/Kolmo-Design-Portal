// server/r2-upload.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from 'crypto';
import path from 'path';
import { HttpError } from './errors';

// --- R2 Configuration ---
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || "auto";
const bucketName = process.env.AWS_S3_BUCKET;

if (!accessKeyId || !secretAccessKey || !bucketName) {
  console.warn(
    "WARNING: AWS S3/R2 environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET) are not fully set. File uploads will fail."
  );
}

// For Cloudflare R2, we need the account ID to construct the endpoint
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!accountId) {
  console.warn(
    "WARNING: CLOUDFLARE_ACCOUNT_ID environment variable is not set. R2 uploads will fail."
  );
}

// For Cloudflare R2, we use auto region and S3-compatible endpoint
export const r2Client = new S3Client({
  region: "auto",
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

const R2 = r2Client;

// Define the return type for the uploadToR2 function
interface UploadResult {
  url: string;
  key: string;
}

/**
 * Uploads a file to R2 storage
 * @param options Options for the upload
 * @returns Object with the URL and storage key of the uploaded file
 */
export async function uploadToR2(options: {
  quoteId: number;
  fileName: string;
  buffer: Buffer;
  mimetype: string;
  imageType?: string;
}): Promise<UploadResult> {
  if (!bucketName || !accessKeyId || !secretAccessKey) {
    throw new HttpError(500, "R2 storage is not configured.");
  }

  // Construct the destination path using quoteId
  const destinationPath = `quotes/${options.quoteId}/images/`;

  // Generate a unique filename to avoid collisions but keep original extension
  const uniqueSuffix = randomBytes(16).toString('hex');
  const fileExtension = path.extname(options.fileName);
  const baseName = path.basename(options.fileName, fileExtension);
  // Sanitize baseName slightly - replace spaces and keep it reasonably short
  const sanitizedBaseName = baseName.replace(/\s+/g, '_').substring(0, 50);
  const uniqueFilename = `${sanitizedBaseName}-${uniqueSuffix}${fileExtension}`;

  // Construct the full key including the project path
  const key = `${destinationPath}${uniqueFilename}`;

  console.log(`Attempting to upload to R2: Bucket=${bucketName}, Key=${key}, Type=${options.mimetype}`);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: options.buffer,
    ContentType: options.mimetype,
    // Consider adding CacheControl for browser caching
    // CacheControl: 'public, max-age=31536000, immutable',
  });

  try {
    await R2.send(command);

    // Use server proxy URL that serves actual image data instead of JSON
    const fileUrl = `/api/storage/proxy/${encodeURIComponent(key)}`;

    console.log(`Successfully uploaded ${options.fileName} to ${fileUrl}`);
    return {
      url: fileUrl,
      key: key
    };
  } catch (error) {
    console.error(`Error uploading to R2 (Bucket: ${bucketName}, Key: ${key}):`, error);
    // Log more details from the error if available
    if (error instanceof Error) {
        console.error("AWS SDK Error Name:", (error as any).name);
        console.error("AWS SDK Error Message:", error.message);
        console.error("AWS SDK Error Stack:", error.stack);
    }
    throw new HttpError(500, "Failed to upload file to R2 storage.");
  }
}

/**
 * Deletes a file from Cloudflare R2 storage
 * @param key The storage key of the file to delete
 * @returns Promise that resolves when the file is deleted
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!bucketName || !accessKeyId || !secretAccessKey) {
    throw new HttpError(500, "R2 storage is not configured.");
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await R2.send(command);
    console.log(`Successfully deleted file with key ${key} from R2`);
  } catch (error) {
    console.error(`Error deleting file with key ${key} from R2:`, error);
    if (error instanceof Error) {
      console.error("AWS SDK Error Details:", error.message);
    }
    throw new HttpError(500, "Failed to delete file from R2 storage.");
  }
}

/**
 * Generates a signed URL for downloading a file from R2
 * @param key The storage key of the file
 * @param originalFilename The original filename to use in Content-Disposition
 * @returns Promise that resolves to the signed download URL
 */
export async function getR2DownloadUrl(key: string, originalFilename?: string): Promise<string> {
  if (!bucketName || !accessKeyId || !secretAccessKey) {
    throw new HttpError(500, "R2 storage is not configured.");
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      // Add Content-Disposition header if original filename is provided
      ...(originalFilename && {
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
      }),
    });

    // Generate a signed URL that expires in 15 minutes
    const signedUrl = await getSignedUrl(R2, command, { expiresIn: 15 * 60 });
    return signedUrl;
  } catch (error) {
    console.error(`Error generating signed URL for file with key ${key}:`, error);
    if (error instanceof Error) {
      console.error("AWS SDK Error Details:", error.message);
    }
    throw new HttpError(500, "Failed to generate download URL.");
  }
}