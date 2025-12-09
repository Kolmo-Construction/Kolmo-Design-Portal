// server/storage/repositories/apikey.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';

// Interface for ApiKey Repository
export interface IApiKeyRepository {
  findByPrefix(prefix: string): Promise<schema.ApiKey | null>;
  findById(id: number): Promise<schema.ApiKey | null>;
  findByUserId(userId: number): Promise<schema.ApiKey[]>;
  create(data: schema.NewApiKey): Promise<schema.ApiKey>;
  updateLastUsed(id: number): Promise<void>;
  deactivate(id: number): Promise<void>;
  update(id: number, data: Partial<schema.NewApiKey>): Promise<schema.ApiKey | null>;
}

// Implementation of the ApiKey Repository
class ApiKeyRepository implements IApiKeyRepository {
  private dbOrTx: NeonDatabase<typeof schema> | any;

  constructor(databaseOrTx: NeonDatabase<typeof schema> | any = db) {
    this.dbOrTx = databaseOrTx;
  }

  /**
   * Find API key by prefix (first 10 chars)
   */
  async findByPrefix(prefix: string): Promise<schema.ApiKey | null> {
    try {
      const apiKey = await this.dbOrTx.query.apiKeys.findFirst({
        where: eq(schema.apiKeys.keyPrefix, prefix),
      });

      return apiKey || null;
    } catch (error) {
      console.error(`Error finding API key by prefix ${prefix}:`, error);
      throw new Error('Database error while finding API key.');
    }
  }

  /**
   * Find API key by ID
   */
  async findById(id: number): Promise<schema.ApiKey | null> {
    try {
      const apiKey = await this.dbOrTx.query.apiKeys.findFirst({
        where: eq(schema.apiKeys.id, id),
      });

      return apiKey || null;
    } catch (error) {
      console.error(`Error finding API key by ID ${id}:`, error);
      throw new Error('Database error while finding API key.');
    }
  }

  /**
   * Find all API keys for a user
   */
  async findByUserId(userId: number): Promise<schema.ApiKey[]> {
    try {
      const apiKeys = await this.dbOrTx.query.apiKeys.findMany({
        where: eq(schema.apiKeys.userId, userId),
        orderBy: [desc(schema.apiKeys.createdAt)],
      });

      return apiKeys;
    } catch (error) {
      console.error(`Error finding API keys for user ${userId}:`, error);
      throw new Error('Database error while finding API keys.');
    }
  }

  /**
   * Create a new API key
   */
  async create(data: schema.NewApiKey): Promise<schema.ApiKey> {
    try {
      const [apiKey] = await this.dbOrTx
        .insert(schema.apiKeys)
        .values(data)
        .returning();

      if (!apiKey) {
        throw new Error('Failed to create API key');
      }

      return apiKey;
    } catch (error) {
      console.error('Error creating API key:', error);
      throw new Error('Database error while creating API key.');
    }
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: number): Promise<void> {
    try {
      await this.dbOrTx
        .update(schema.apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.apiKeys.id, id));
    } catch (error) {
      console.error(`Error updating last used for API key ${id}:`, error);
      // Don't throw - this is a fire-and-forget operation
    }
  }

  /**
   * Deactivate an API key
   */
  async deactivate(id: number): Promise<void> {
    try {
      await this.dbOrTx
        .update(schema.apiKeys)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.apiKeys.id, id));
    } catch (error) {
      console.error(`Error deactivating API key ${id}:`, error);
      throw new Error('Database error while deactivating API key.');
    }
  }

  /**
   * Update API key metadata
   */
  async update(
    id: number,
    data: Partial<schema.NewApiKey>
  ): Promise<schema.ApiKey | null> {
    try {
      const [updated] = await this.dbOrTx
        .update(schema.apiKeys)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.apiKeys.id, id))
        .returning();

      return updated || null;
    } catch (error) {
      console.error(`Error updating API key ${id}:`, error);
      throw new Error('Database error while updating API key.');
    }
  }

  /**
   * Find active API key by user ID and name
   */
  async findActiveByUserIdAndName(
    userId: number,
    name: string
  ): Promise<schema.ApiKey | null> {
    try {
      const apiKey = await this.dbOrTx.query.apiKeys.findFirst({
        where: and(
          eq(schema.apiKeys.userId, userId),
          eq(schema.apiKeys.name, name),
          eq(schema.apiKeys.isActive, true)
        ),
      });

      return apiKey || null;
    } catch (error) {
      console.error(`Error finding active API key for user ${userId}:`, error);
      throw new Error('Database error while finding API key.');
    }
  }

  /**
   * Find API key by full key string
   */
  async findByFullKey(fullKey: string): Promise<schema.ApiKey | null> {
    try {
      const apiKey = await this.dbOrTx.query.apiKeys.findFirst({
        where: eq(schema.apiKeys.fullKey, fullKey),
      });

      return apiKey || null;
    } catch (error) {
      console.error('Error finding API key by full key:', error);
      throw new Error('Database error while finding API key.');
    }
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revoke(id: number): Promise<void> {
    return this.deactivate(id);
  }
}

// Export singleton instance
export const apiKeyRepository = new ApiKeyRepository();
