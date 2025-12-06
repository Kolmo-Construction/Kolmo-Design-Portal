// server/r2-upload.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from 'crypto';
import path from 'path';
import { HttpError } from './errors';

// --- R2 Configuration ---
// Try multiple environment variable names for flexibility
const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET;
const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;

// Debug: log all environment variables that start with R2_ or AWS_
console.log('Environment variables check:');
console.log('R2_ACCOUNT_ID exists:', !!process.env.R2_ACCOUNT_ID);
console.log('R2_ACCESS_KEY_ID exists:', !!process.env.R2_ACCESS_KEY_ID);
console.log('R2_SECRET_ACCESS_KEY exists:', !!process.env.R2_SECRET_ACCESS_KEY);
console.log('R2_BUCKET_NAME exists:', !!process.env.R2_BUCKET_NAME);
console.log('AWS_ACCESS_KEY_ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_SECRET_ACCESS_KEY exists:', !!process.env.AWS_SECRET_ACCESS_KEY);
console.log('AWS_S3_BUCKET exists:', !!process.env.AWS_S3_BUCKET);
console.log('CLOUDFLARE_ACCOUNT_ID exists:', !!process.env.CLOUDFLARE_ACCOUNT_ID);

// Log the configuration status (mask sensitive values)
console.log('R2 Configuration:', {
  hasAccessKeyId: !!accessKeyId,
  hasSecretAccessKey: !!secretAccessKey,
  hasBucketName: !!bucketName,
  hasAccountId: !!accountId,
  bucketName,
  accountId,
  accessKeyIdPrefix: accessKeyId ? accessKeyId.substring(0, 5) + '...' : 'none',
  secretAccessKeyPrefix: secretAccessKey ? secretAccessKey.substring(0, 5) + '...' : 'none'
});

if (!accessKeyId || !secretAccessKey || !bucketName || !accountId) {
  const missing = [];
  if (!accessKeyId) missing.push('ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('SECRET_ACCESS_KEY');
  if (!bucketName) missing.push('BUCKET_NAME');
  if (!accountId) missing.push('ACCOUNT_ID');
  
  console.error(
    `ERROR: R2 storage configuration is incomplete. Missing: ${missing.join(', ')}`
  );
  console.error('Please set the following environment variables:');
  console.error('- R2_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID');
  console.error('- R2_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID');
  console.error('- R2_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY');
  console.error('- R2_BUCKET_NAME or AWS_S3_BUCKET');
  
  // Don't throw here, let it fail at runtime with a better error message
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
  fileName: string;
  buffer: Buffer;
  mimetype: string;
  path?: string;
}): Promise<UploadResult> {
  // Check configuration at runtime
  if (!bucketName || !accessKeyId || !secretAccessKey || !accountId) {
    const missing = [];
    if (!bucketName) missing.push('BUCKET_NAME');
    if (!accessKeyId) missing.push('ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('SECRET_ACCESS_KEY');
    if (!accountId) missing.push('ACCOUNT_ID');
    
    const errorMsg = `R2 storage is not properly configured. Missing: ${missing.join(', ')}. ` +
                     `Please check your environment variables.`;
    console.error(errorMsg);
    throw new HttpError(500, errorMsg);
  }

  // Use provided path or default to general uploads
  const destinationPath = options.path || 'uploads/';

  // Generate a unique filename to avoid collisions but keep original extension
  const uniqueSuffix = randomBytes(16).toString('hex');
  const fileExtension = path.extname(options.fileName);
  const baseName = path.basename(options.fileName, fileExtension);
  // Sanitize baseName slightly - replace spaces and keep it reasonably short
  const sanitizedBaseName = baseName.replace(/\s+/g, '_').substring(0, 50);
  const uniqueFilename = `${sanitizedBaseName}-${uniqueSuffix}${fileExtension}`;

  // Construct the full key including the path
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
  if (!bucketName || !accessKeyId || !secretAccessKey || !accountId) {
    throw new HttpError(500, "R2 storage is not configured. Please check environment variables.");
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
  if (!bucketName || !accessKeyId || !secretAccessKey || !accountId) {
    throw new HttpError(500, "R2 storage is not configured. Please check environment variables.");
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
