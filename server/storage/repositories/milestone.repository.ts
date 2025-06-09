// server/storage/repositories/milestone.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';

export interface IMilestoneRepository {
  getMilestoneById(id: number): Promise<schema.Milestone | null>;
  getMilestonesByProjectId(projectId: number): Promise<schema.Milestone[]>;
  createMilestone(data: schema.InsertMilestone): Promise<schema.Milestone>;
  updateMilestone(id: number, data: Partial<schema.InsertMilestone>): Promise<schema.Milestone>;
  deleteMilestone(id: number): Promise<void>;
}

export class MilestoneRepository implements IMilestoneRepository {
  constructor(private db: NeonDatabase<typeof schema>) {}

  async getMilestoneById(id: number): Promise<schema.Milestone | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.milestones)
        .where(eq(schema.milestones.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching milestone by ID:', error);
      throw new HttpError(500, 'Failed to fetch milestone');
    }
  }

  async getMilestonesByProjectId(projectId: number): Promise<schema.Milestone[]> {
    try {
      const result = await this.db
        .select()
        .from(schema.milestones)
        .where(eq(schema.milestones.projectId, projectId))
        .orderBy(asc(schema.milestones.orderIndex), asc(schema.milestones.plannedDate));

      return result;
    } catch (error) {
      console.error('Error fetching milestones for project:', error);
      throw new HttpError(500, 'Failed to fetch project milestones');
    }
  }

  async createMilestone(data: schema.InsertMilestone): Promise<schema.Milestone> {
    try {
      // Convert string date to Date object and number billing percentage to string if needed
      const processedData = {
        ...data,
        plannedDate: typeof data.plannedDate === 'string' ? new Date(data.plannedDate) : data.plannedDate,
        billingPercentage: data.billingPercentage !== undefined ? data.billingPercentage.toString() : undefined,
      };

      const result = await this.db
        .insert(schema.milestones)
        .values([processedData])
        .returning();

      if (!result[0]) {
        throw new HttpError(500, 'Failed to create milestone');
      }

      return result[0];
    } catch (error) {
      console.error('Error creating milestone:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to create milestone');
    }
  }

  async updateMilestone(id: number, data: Partial<schema.UpdateMilestone>): Promise<schema.Milestone> {
    try {
      // Convert string dates to Date objects and billing percentage to string if needed
      const processedData: any = { ...data };
      if (processedData.plannedDate && typeof processedData.plannedDate === 'string') {
        processedData.plannedDate = new Date(processedData.plannedDate);
      }
      if (processedData.billingPercentage !== undefined) {
        processedData.billingPercentage = processedData.billingPercentage.toString();
      }
      
      const result = await this.db
        .update(schema.milestones)
        .set({
          ...processedData,
          updatedAt: new Date(),
        })
        .where(eq(schema.milestones.id, id))
        .returning();

      if (!result[0]) {
        throw new HttpError(404, 'Milestone not found');
      }

      return result[0];
    } catch (error) {
      console.error('Error updating milestone:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to update milestone');
    }
  }

  async deleteMilestone(id: number): Promise<void> {
    try {
      const result = await this.db
        .delete(schema.milestones)
        .where(eq(schema.milestones.id, id))
        .returning();

      if (!result[0]) {
        throw new HttpError(404, 'Milestone not found');
      }
    } catch (error) {
      console.error('Error deleting milestone:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to delete milestone');
    }
  }
}

// Create and export singleton instance
export const milestoneRepository = new MilestoneRepository(db);