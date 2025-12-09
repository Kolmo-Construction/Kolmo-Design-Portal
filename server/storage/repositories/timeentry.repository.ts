// server/storage/repositories/timeentry.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, desc, isNull, gte, lte, sql } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';

// Interface for TimeEntry Repository
export interface ITimeEntryRepository {
  findById(id: number): Promise<schema.TimeEntry | null>;
  findActiveByUserId(userId: number): Promise<schema.TimeEntry | null>;
  findByUserId(userId: number, filters?: TimeEntryFilters): Promise<schema.TimeEntry[]>;
  findByProjectId(projectId: number, filters?: TimeEntryFilters): Promise<schema.TimeEntry[]>;
  create(data: schema.NewTimeEntry): Promise<schema.TimeEntry>;
  update(id: number, data: Partial<schema.NewTimeEntry>): Promise<schema.TimeEntry | null>;
  delete(id: number): Promise<boolean>;
}

export interface TimeEntryFilters {
  startDate?: Date;
  endDate?: Date;
  includeActive?: boolean;
}

// Implementation of the TimeEntry Repository
class TimeEntryRepository implements ITimeEntryRepository {
  private dbOrTx: NeonDatabase<typeof schema> | any;

  constructor(databaseOrTx: NeonDatabase<typeof schema> | any = db) {
    this.dbOrTx = databaseOrTx;
  }

  /**
   * Find time entry by ID
   */
  async findById(id: number): Promise<schema.TimeEntry | null> {
    try {
      const timeEntry = await this.dbOrTx.query.timeEntries.findFirst({
        where: eq(schema.timeEntries.id, id),
        with: {
          user: {
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
              address: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });

      return timeEntry || null;
    } catch (error) {
      console.error(`Error finding time entry by ID ${id}:`, error);
      throw new Error('Database error while finding time entry.');
    }
  }

  /**
   * Find active time entry for a user (no end time)
   */
  async findActiveByUserId(userId: number): Promise<schema.TimeEntry | null> {
    try {
      const activeEntry = await this.dbOrTx.query.timeEntries.findFirst({
        where: and(
          eq(schema.timeEntries.userId, userId),
          isNull(schema.timeEntries.endTime)
        ),
        with: {
          project: {
            columns: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      });

      return activeEntry || null;
    } catch (error) {
      console.error(`Error finding active time entry for user ${userId}:`, error);
      throw new Error('Database error while finding active time entry.');
    }
  }

  /**
   * Find time entries by user ID with optional filters
   */
  async findByUserId(
    userId: number,
    filters?: TimeEntryFilters
  ): Promise<schema.TimeEntry[]> {
    try {
      const conditions = [eq(schema.timeEntries.userId, userId)];

      // Filter by date range
      if (filters?.startDate) {
        conditions.push(gte(schema.timeEntries.startTime, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(schema.timeEntries.startTime, filters.endDate));
      }

      // Exclude active entries if requested
      if (filters?.includeActive === false) {
        conditions.push(sql`${schema.timeEntries.endTime} IS NOT NULL`);
      }

      const timeEntries = await this.dbOrTx.query.timeEntries.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.timeEntries.startTime)],
        with: {
          project: {
            columns: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      });

      return timeEntries;
    } catch (error) {
      console.error(`Error finding time entries for user ${userId}:`, error);
      throw new Error('Database error while finding time entries.');
    }
  }

  /**
   * Find time entries by project ID with optional filters
   */
  async findByProjectId(
    projectId: number,
    filters?: TimeEntryFilters
  ): Promise<schema.TimeEntry[]> {
    try {
      const conditions = [eq(schema.timeEntries.projectId, projectId)];

      // Filter by date range
      if (filters?.startDate) {
        conditions.push(gte(schema.timeEntries.startTime, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(schema.timeEntries.startTime, filters.endDate));
      }

      // Exclude active entries if requested
      if (filters?.includeActive === false) {
        conditions.push(sql`${schema.timeEntries.endTime} IS NOT NULL`);
      }

      const timeEntries = await this.dbOrTx.query.timeEntries.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.timeEntries.startTime)],
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });

      return timeEntries;
    } catch (error) {
      console.error(`Error finding time entries for project ${projectId}:`, error);
      throw new Error('Database error while finding time entries.');
    }
  }

  /**
   * Create a new time entry
   */
  async create(data: schema.NewTimeEntry): Promise<schema.TimeEntry> {
    try {
      const [timeEntry] = await this.dbOrTx
        .insert(schema.timeEntries)
        .values(data)
        .returning();

      if (!timeEntry) {
        throw new Error('Failed to create time entry');
      }

      return timeEntry;
    } catch (error) {
      console.error('Error creating time entry:', error);
      throw new Error('Database error while creating time entry.');
    }
  }

  /**
   * Update a time entry
   */
  async update(
    id: number,
    data: Partial<schema.NewTimeEntry>
  ): Promise<schema.TimeEntry | null> {
    try {
      const [updated] = await this.dbOrTx
        .update(schema.timeEntries)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.timeEntries.id, id))
        .returning();

      return updated || null;
    } catch (error) {
      console.error(`Error updating time entry ${id}:`, error);
      throw new Error('Database error while updating time entry.');
    }
  }

  /**
   * Delete a time entry
   */
  async delete(id: number): Promise<boolean> {
    try {
      const result = await this.dbOrTx
        .delete(schema.timeEntries)
        .where(eq(schema.timeEntries.id, id));

      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting time entry ${id}:`, error);
      throw new Error('Database error while deleting time entry.');
    }
  }
}

// Export singleton instance
export const timeEntryRepository = new TimeEntryRepository();
