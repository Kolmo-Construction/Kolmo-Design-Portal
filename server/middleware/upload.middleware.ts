// server/middleware/upload.middleware.ts
import multer from 'multer';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit (adjust as needed)
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain',
    'application/zip', // Allow zip files
    // Add other allowed types as needed
];

const storageEngine = multer.memoryStorage(); // Store files in memory temporarily

/**
 * Multer instance configured for handling file uploads with size and type limits.
 * Use `.single(fieldName)` or `.array(fieldName, maxCount)` as middleware in routes.
 */
export const upload = multer({
    storage: storageEngine,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true); // Accept file
        } else {
            // Reject file with a specific error message
            const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
            // Extend the error object or use the message property if available and standardized
            (err as any).message = `Invalid file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`;
            cb(err);
            // Note: Express error handler should catch this MulterError
        }
    }
});