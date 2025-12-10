// server/domain.config.ts
/**
 * Centralized domain configuration for kolmo.design
 * Handles all URL generation consistently across the application
 */

/**
 * Get the base URL for the application
 * Prioritizes BASE_URL environment variable, then kolmo.design for production
 */
export function getBaseUrl(): string {
  // Check for explicit BASE_URL environment variable first
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  // Production environment or Replit deployment
  if (process.env.NODE_ENV === 'production' || process.env.REPLIT_SLUG) {
    return 'https://www.kolmo.design';
  }

  // Development environment
  return 'http://localhost:3000';
}

/**
 * Generate URLs for specific paths
 */
export function generateUrl(path: string): string {
  const baseUrl = getBaseUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Generate magic link URLs
 */
export function generateMagicLinkUrl(token: string): string {
  return generateUrl(`/auth/magic-link/${token}`);
}

/**
 * Generate project URLs
 */
export function generateProjectUrl(projectId: number, tab?: string): string {
  const basePath = `/projects/${projectId}`;
  return tab ? generateUrl(`${basePath}?tab=${tab}`) : generateUrl(basePath);
}

/**
 * Generate payment success URLs
 */
export function generatePaymentSuccessUrl(): string {
  return generateUrl('/payment-success');
}

/**
 * Generate Stripe webhook URLs
 */
export function generateStripeWebhookUrl(): string {
  return generateUrl('/api/webhooks/stripe');
}