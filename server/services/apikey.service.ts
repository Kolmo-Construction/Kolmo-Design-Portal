import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { storage } from '../storage';
import type { User } from '@shared/schema';

const BCRYPT_ROUNDS = 12;
const KEY_PREFIX = 'kolmo_';
const KEY_LENGTH_BYTES = 32; // 32 bytes = 64 hex chars

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKeyId?: number;
  user?: User;
}

/**
 * API Key Service
 * Handles generation, validation, and management of API keys for mobile/external access
 */
export class ApiKeyService {
  private initialized: boolean = true;

  constructor() {
    console.log('[ApiKeyService] Initialized successfully');
  }

  /**
   * Generate a new API key
   * Format: kolmo_<64 hex chars>
   * @returns Full key (shown only once) and prefix (for display)
   */
  generateKey(): { fullKey: string; prefix: string; hash: string } {
    // Generate 32 cryptographically secure random bytes
    const keyBytes = randomBytes(KEY_LENGTH_BYTES);
    const keyHex = keyBytes.toString('hex'); // 64 hex chars

    // Create full key with prefix
    const fullKey = `${KEY_PREFIX}${keyHex}`;

    // Extract prefix (first 10 chars including prefix)
    const prefix = fullKey.substring(0, 10);

    // Hash the full key for storage
    const hash = bcrypt.hashSync(fullKey, BCRYPT_ROUNDS);

    return { fullKey, prefix, hash };
  }

  /**
   * Validate API key against stored hash
   * @param providedKey - The API key provided in request
   * @returns Validation result with user if valid
   */
  async validateKey(providedKey: string): Promise<ApiKeyValidationResult> {
    try {
      if (!providedKey || !providedKey.startsWith(KEY_PREFIX)) {
        return { valid: false };
      }

      // Extract prefix to quickly find potential matches
      const prefix = providedKey.substring(0, 10);

      // Get all active API keys with this prefix
      const apiKey = await storage.apiKeys.findByPrefix(prefix);

      if (!apiKey) {
        console.log(`[ApiKeyService] No API key found with prefix: ${prefix}`);
        return { valid: false };
      }

      // Check if key is active
      if (!apiKey.isActive) {
        console.log(`[ApiKeyService] API key is inactive: ${prefix}`);
        return { valid: false };
      }

      // Check expiration
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        console.log(`[ApiKeyService] API key expired: ${prefix}`);
        return { valid: false };
      }

      // Verify hash
      const hashMatches = await bcrypt.compare(providedKey, apiKey.keyHash);
      if (!hashMatches) {
        console.log(`[ApiKeyService] Invalid API key hash for prefix: ${prefix}`);
        return { valid: false };
      }

      // Get associated user
      const user = await storage.users.getUserById(apiKey.userId.toString());
      if (!user) {
        console.log(`[ApiKeyService] User not found for API key: ${prefix}`);
        return { valid: false };
      }

      console.log(`[ApiKeyService] Valid API key for user: ${user.username}`);

      return {
        valid: true,
        apiKeyId: apiKey.id,
        user,
      };
    } catch (error) {
      console.error('[ApiKeyService] Validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Update last used timestamp for an API key
   * Fire and forget - don't block request
   */
  async updateLastUsed(apiKeyId: number): Promise<void> {
    try {
      await storage.apiKeys.updateLastUsed(apiKeyId);
    } catch (error) {
      console.error('[ApiKeyService] Failed to update last used:', error);
    }
  }

  /**
   * Create a new API key for a user
   */
  async createApiKey(
    userId: number,
    name: string,
    description?: string,
    expiresInDays?: number
  ): Promise<{
    id: number;
    fullKey: string;
    keyPrefix: string;
    name: string;
    expiresAt: Date | null;
    createdAt: Date;
  }> {
    try {
      // Generate key
      const { fullKey, prefix, hash } = this.generateKey();

      // Calculate expiration
      let expiresAt: Date | null = null;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      // Store in database
      const apiKey = await storage.apiKeys.create({
        userId,
        keyHash: hash,
        keyPrefix: prefix,
        name,
        description: description || null,
        expiresAt,
        isActive: true,
      });

      console.log(`[ApiKeyService] Created API key: ${prefix} for user ${userId}`);

      return {
        id: apiKey.id,
        fullKey, // Return full key ONLY on creation
        keyPrefix: prefix,
        name: apiKey.name,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      };
    } catch (error) {
      console.error('[ApiKeyService] Failed to create API key:', error);
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: number, userId: number): Promise<boolean> {
    try {
      // Verify ownership
      const apiKey = await storage.apiKeys.findById(apiKeyId);
      if (!apiKey || apiKey.userId !== userId) {
        console.log(`[ApiKeyService] API key not found or unauthorized: ${apiKeyId}`);
        return false;
      }

      // Mark as inactive
      await storage.apiKeys.deactivate(apiKeyId);
      console.log(`[ApiKeyService] Revoked API key: ${apiKey.keyPrefix}`);

      return true;
    } catch (error) {
      console.error('[ApiKeyService] Failed to revoke API key:', error);
      return false;
    }
  }

  /**
   * List all API keys for a user (masked)
   */
  async listUserApiKeys(userId: number) {
    try {
      const apiKeys = await storage.apiKeys.findByUserId(userId);

      // Return masked keys (never include hash)
      return apiKeys.map((key) => ({
        id: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name,
        description: key.description,
        isActive: key.isActive,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
      }));
    } catch (error) {
      console.error('[ApiKeyService] Failed to list API keys:', error);
      return [];
    }
  }

  /**
   * Health check
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
