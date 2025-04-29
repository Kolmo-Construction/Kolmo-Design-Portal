// server/storage/repositories/task.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { eq, and, or, sql, desc, asc, not } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { TaskWithAssignee } from '../types'; // Import shared types

// Interface for Task Repository
export interface ITaskRepository {
    getTasksForProject(projectId: number): Promise<TaskWithAssignee[]>;
    createTask(taskData: schema.InsertTask): Promise<TaskWithAssignee | null>;
    // Note: Omitted fields like id, projectId, createdBy from update type
    updateTask(taskId: number, taskData: Partial<Omit<schema.InsertTask, 'id' | 'projectId' | 'createdBy'>>): Promise<TaskWithAssignee | null>;
    deleteTask(taskId: number): Promise<boolean>;
    addTaskDependency(predecessorId: number, successorId: number): Promise<schema.TaskDependency | null>;
    removeTaskDependency(predecessorId: number, successorId: number): Promise<boolean>;
    getTaskById(taskId: number): Promise<TaskWithAssignee | null>; // Added getter for convenience
}

// Implementation
class TaskRepository implements ITaskRepository {
    // Use transaction type for flexibility
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    // Allow injecting db instance or transaction
    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    // Helper to fetch task with relations using the correct db/tx instance
    private async getTaskWithDetails(taskId: number): Promise<TaskWithAssignee | null> {
        const task = await this.dbOrTx.query.tasks.findFirst({
            where: eq(schema.tasks.id, taskId),
            with: {
                assignee: { columns: { id: true, firstName: true, lastName: true, email: true } }
                // Note: There is no createdBy relation as the tasks table doesn't have a created_by column
            }
        });

        if (!task) return null;
        return task as TaskWithAssignee;
    }

    async getTaskById(taskId: number): Promise<TaskWithAssignee | null> {
         try {
            return await this.getTaskWithDetails(taskId);
         } catch (error) {
             console.error(`Error fetching task ${taskId}:`, error);
             throw new Error('Database error while fetching task.');
         }
    }

    async getTasksForProject(projectId: number): Promise<TaskWithAssignee[]> {
        try {
            const tasks = await this.dbOrTx.query.tasks.findMany({
                where: eq(schema.tasks.projectId, projectId),
                orderBy: [asc(schema.tasks.createdAt)], // Removed displayOrder as it doesn't exist
                with: {
                    assignee: { columns: { id: true, firstName: true, lastName: true, email: true } }
                    // Note: There is no createdBy relation as the tasks table doesn't have a created_by column
                }
            });
            return tasks as TaskWithAssignee[];
        } catch (error) {
            console.error(`Error fetching tasks for project ${projectId}:`, error);
            throw new Error('Database error while fetching tasks.');
        }
    }

    async createTask(taskData: schema.InsertTask): Promise<TaskWithAssignee | null> {
        try {
            const result = await this.dbOrTx.insert(schema.tasks)
                .values(taskData)
                .returning({ id: schema.tasks.id });

            if (!result || result.length === 0) throw new Error("Failed to insert task.");
            return await this.getTaskWithDetails(result[0].id);
        } catch (error) {
            console.error('Error creating task:', error);
            throw new Error('Database error while creating task.');
        }
    }

    async updateTask(taskId: number, taskData: Partial<Omit<schema.InsertTask, 'id' | 'projectId' | 'createdBy'>>): Promise<TaskWithAssignee | null> {
        if (Object.keys(taskData).length === 0) {
             console.warn("Update task called with empty data.");
             return this.getTaskWithDetails(taskId); // Return current data if nothing to update
        }
        try {
            const result = await this.dbOrTx.update(schema.tasks)
                .set({ ...taskData, updatedAt: new Date() })
                .where(eq(schema.tasks.id, taskId))
                .returning({ id: schema.tasks.id });

            if (!result || result.length === 0) return null; // Not found
            return await this.getTaskWithDetails(taskId);
        } catch (error) {
            console.error(`Error updating task ${taskId}:`, error);
            throw new Error('Database error while updating task.');
        }
    }

    async deleteTask(taskId: number): Promise<boolean> {
         // Requires a transaction to ensure dependencies are deleted first
         // If called within another transaction, it should use the provided tx instance
         const runDelete = async (tx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>) => {
            // Delete dependencies involving this task first
            await tx.delete(schema.taskDependencies)
                .where(or(
                    eq(schema.taskDependencies.predecessorId, taskId),
                    eq(schema.taskDependencies.successorId, taskId)
                ));
            // Delete the task
            const result = await tx.delete(schema.tasks)
                .where(eq(schema.tasks.id, taskId))
                .returning({ id: schema.tasks.id });
            return result.length > 0;
         };

         try {
             // If dbOrTx is already a transaction, use it directly
             if ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction) {
                  return await runDelete(this.dbOrTx);
             } else {
                 // Otherwise, create a new transaction
                 return await (this.dbOrTx as NeonDatabase<typeof schema>).transaction(runDelete);
             }
         } catch (error) {
             console.error(`Error deleting task ${taskId}:`, error);
             throw new Error('Database error while deleting task.');
         }
    }

    async addTaskDependency(predecessorId: number, successorId: number): Promise<schema.TaskDependency | null> {
        if (predecessorId === successorId) throw new Error("Task cannot depend on itself.");

        // Basic cycle check (A->B, B->A)
        const existingReverse = await this.dbOrTx.query.taskDependencies.findFirst({
            where: and(
                eq(schema.taskDependencies.predecessorId, successorId),
                eq(schema.taskDependencies.successorId, predecessorId)
            )
        });
        if (existingReverse) {
            throw new HttpError(409, `Cyclic dependency detected: Task ${successorId} already depends on Task ${predecessorId}.`);
        }

        try {
            const result = await this.dbOrTx.insert(schema.taskDependencies)
                .values({ predecessorId, successorId })
                .onConflictDoNothing()
                .returning();

            if (!result || result.length === 0) {
                const existing = await this.dbOrTx.query.taskDependencies.findFirst({
                    where: and(
                        eq(schema.taskDependencies.predecessorId, predecessorId),
                        eq(schema.taskDependencies.successorId, successorId)
                    )
                });
                return existing ?? null; // Return existing if duplicate
            }
            return result[0];
        } catch (error: any) {
            console.error(`Error adding dependency ${predecessorId} -> ${successorId}:`, error);
            if (error.code === '23503') throw new HttpError(404, 'One or both tasks involved in the dependency do not exist.');
            if (error.code === '23505') throw new HttpError(409, 'This dependency already exists.');
            throw new Error('Database error while adding task dependency.');
        }
    }

    async removeTaskDependency(predecessorId: number, successorId: number): Promise<boolean> {
        try {
            const result = await this.dbOrTx.delete(schema.taskDependencies)
                .where(and(
                    eq(schema.taskDependencies.predecessorId, predecessorId),
                    eq(schema.taskDependencies.successorId, successorId)
                ))
                .returning({ pId: schema.taskDependencies.predecessorId });
            return result.length > 0;
        } catch (error) {
            console.error(`Error removing dependency ${predecessorId} -> ${successorId}:`, error);
            throw new Error('Database error while removing task dependency.');
        }
    }
}

// Export an instance for convenience
export const taskRepository = new TaskRepository();