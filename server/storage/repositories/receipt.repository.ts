// server/storage/repositories/receipt.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';

// Interface for Receipt Repository
export interface IReceiptRepository {
  findById(id: number): Promise<schema.Receipt | null>;
  findByProjectId(projectId: number, filters?: ReceiptFilters): Promise<schema.Receipt[]>;
  findByUploader(uploaderId: number, filters?: ReceiptFilters): Promise<schema.Receipt[]>;
  create(data: schema.NewReceipt): Promise<schema.Receipt>;
  update(id: number, data: Partial<schema.NewReceipt>): Promise<schema.Receipt | null>;
  delete(id: number): Promise<boolean>;
  getExpenseSummary(projectId: number): Promise<ExpenseSummary>;
}

export interface ReceiptFilters {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  isVerified?: boolean;
}

export interface ExpenseSummary {
  totalAmount: number;
  totalReceipts: number;
  byCategory: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
  byVendor: Array<{
    vendor: string;
    amount: number;
    count: number;
  }>;
  verified: number;
  unverified: number;
}

// Implementation of the Receipt Repository
class ReceiptRepository implements IReceiptRepository {
  private dbOrTx: NeonDatabase<typeof schema> | any;

  constructor(databaseOrTx: NeonDatabase<typeof schema> | any = db) {
    this.dbOrTx = databaseOrTx;
  }

  /**
   * Find receipt by ID
   */
  async findById(id: number): Promise<schema.Receipt | null> {
    try {
      const receipt = await this.dbOrTx.query.receipts.findFirst({
        where: eq(schema.receipts.id, id),
        with: {
          uploader: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          project: {
            columns: {
              id: true,
              name: true,
            },
          },
          verifier: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });

      return receipt || null;
    } catch (error) {
      console.error(`Error finding receipt by ID ${id}:`, error);
      throw new Error('Database error while finding receipt.');
    }
  }

  /**
   * Find receipts by project ID with optional filters
   */
  async findByProjectId(
    projectId: number,
    filters?: ReceiptFilters
  ): Promise<schema.Receipt[]> {
    try {
      const conditions = [eq(schema.receipts.projectId, projectId)];

      // Filter by date range
      if (filters?.startDate) {
        conditions.push(gte(schema.receipts.receiptDate, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(schema.receipts.receiptDate, filters.endDate));
      }

      // Filter by category
      if (filters?.category) {
        conditions.push(eq(schema.receipts.category, filters.category));
      }

      // Filter by verification status
      if (filters?.isVerified !== undefined) {
        conditions.push(eq(schema.receipts.isVerified, filters.isVerified));
      }

      const receipts = await this.dbOrTx.query.receipts.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.receipts.receiptDate), desc(schema.receipts.createdAt)],
        with: {
          uploader: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          verifier: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });

      return receipts;
    } catch (error) {
      console.error(`Error finding receipts for project ${projectId}:`, error);
      throw new Error('Database error while finding receipts.');
    }
  }

  /**
   * Find receipts by uploader ID with optional filters
   */
  async findByUploader(
    uploaderId: number,
    filters?: ReceiptFilters
  ): Promise<schema.Receipt[]> {
    try {
      const conditions = [eq(schema.receipts.uploadedBy, uploaderId)];

      // Apply same filters as findByProjectId
      if (filters?.startDate) {
        conditions.push(gte(schema.receipts.receiptDate, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(schema.receipts.receiptDate, filters.endDate));
      }
      if (filters?.category) {
        conditions.push(eq(schema.receipts.category, filters.category));
      }
      if (filters?.isVerified !== undefined) {
        conditions.push(eq(schema.receipts.isVerified, filters.isVerified));
      }

      const receipts = await this.dbOrTx.query.receipts.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.receipts.receiptDate), desc(schema.receipts.createdAt)],
        with: {
          project: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return receipts;
    } catch (error) {
      console.error(`Error finding receipts for uploader ${uploaderId}:`, error);
      throw new Error('Database error while finding receipts.');
    }
  }

  /**
   * Create a new receipt
   */
  async create(data: schema.NewReceipt): Promise<schema.Receipt> {
    try {
      const [receipt] = await this.dbOrTx
        .insert(schema.receipts)
        .values(data)
        .returning();

      if (!receipt) {
        throw new Error('Failed to create receipt');
      }

      return receipt;
    } catch (error) {
      console.error('Error creating receipt:', error);
      throw new Error('Database error while creating receipt.');
    }
  }

  /**
   * Update a receipt
   */
  async update(
    id: number,
    data: Partial<schema.NewReceipt>
  ): Promise<schema.Receipt | null> {
    try {
      const [updated] = await this.dbOrTx
        .update(schema.receipts)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.receipts.id, id))
        .returning();

      return updated || null;
    } catch (error) {
      console.error(`Error updating receipt ${id}:`, error);
      throw new Error('Database error while updating receipt.');
    }
  }

  /**
   * Delete a receipt
   */
  async delete(id: number): Promise<boolean> {
    try {
      const result = await this.dbOrTx
        .delete(schema.receipts)
        .where(eq(schema.receipts.id, id));

      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting receipt ${id}:`, error);
      throw new Error('Database error while deleting receipt.');
    }
  }

  /**
   * Get expense summary for a project
   */
  async getExpenseSummary(projectId: number): Promise<ExpenseSummary> {
    try {
      // Get all receipts for the project
      const receipts = await this.findByProjectId(projectId);

      // Calculate totals
      const totalAmount = receipts.reduce((sum, receipt) => {
        const amount = receipt.totalAmount ? parseFloat(receipt.totalAmount.toString()) : 0;
        return sum + amount;
      }, 0);

      const totalReceipts = receipts.length;

      // Group by category
      const categoryMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(receipt => {
        const category = receipt.category || 'uncategorized';
        const amount = receipt.totalAmount ? parseFloat(receipt.totalAmount.toString()) : 0;

        if (categoryMap.has(category)) {
          const existing = categoryMap.get(category)!;
          categoryMap.set(category, {
            amount: existing.amount + amount,
            count: existing.count + 1,
          });
        } else {
          categoryMap.set(category, { amount, count: 1 });
        }
      });

      const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        amount: Math.round(data.amount * 100) / 100,
        count: data.count,
      }));

      // Group by vendor
      const vendorMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(receipt => {
        const vendor = receipt.vendorName || 'Unknown Vendor';
        const amount = receipt.totalAmount ? parseFloat(receipt.totalAmount.toString()) : 0;

        if (vendorMap.has(vendor)) {
          const existing = vendorMap.get(vendor)!;
          vendorMap.set(vendor, {
            amount: existing.amount + amount,
            count: existing.count + 1,
          });
        } else {
          vendorMap.set(vendor, { amount, count: 1 });
        }
      });

      const byVendor = Array.from(vendorMap.entries())
        .map(([vendor, data]) => ({
          vendor,
          amount: Math.round(data.amount * 100) / 100,
          count: data.count,
        }))
        .sort((a, b) => b.amount - a.amount) // Sort by amount descending
        .slice(0, 10); // Top 10 vendors

      // Count verified/unverified
      const verified = receipts.filter(r => r.isVerified).length;
      const unverified = receipts.filter(r => !r.isVerified).length;

      return {
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalReceipts,
        byCategory,
        byVendor,
        verified,
        unverified,
      };
    } catch (error) {
      console.error(`Error getting expense summary for project ${projectId}:`, error);
      throw new Error('Database error while getting expense summary.');
    }
  }
}

// Export singleton instance
export const receiptRepository = new ReceiptRepository();
