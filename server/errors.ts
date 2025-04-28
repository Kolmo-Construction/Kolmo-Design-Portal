/**
 * Custom HTTP Error class for the application
 * Extends the native Error class with HTTP status code and optional details
 */
export class HttpError extends Error {
  statusCode: number;
  details?: any;
  
  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
    
    // Preserve the proper stack trace for the error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}

/**
 * Create a standard 404 Not Found error
 */
export function createNotFoundError(resource: string): HttpError {
  return new HttpError(404, `${resource} not found`);
}

/**
 * Create a standard 400 Bad Request error
 */
export function createBadRequestError(message: string, details?: any): HttpError {
  return new HttpError(400, message, details);
}

/**
 * Create a standard 401 Unauthorized error
 */
export function createUnauthorizedError(message: string = 'Unauthorized'): HttpError {
  return new HttpError(401, message);
}

/**
 * Create a standard 403 Forbidden error
 */
export function createForbiddenError(message: string = 'Forbidden'): HttpError {
  return new HttpError(403, message);
}

/**
 * Create a standard 500 Internal Server Error
 */
export function createInternalServerError(message: string = 'Internal server error'): HttpError {
  return new HttpError(500, message);
}