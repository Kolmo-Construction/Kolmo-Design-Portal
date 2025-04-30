// server/storage/repositories/task.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { PgTransaction } from 'drizzle-orm/pg-core';
// --- ADD 'inArray' TO THIS IMPORT ---
import { eq, and, or, sql, desc, asc, not, inArray } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { TaskWithAssignee } from '../types'; // Import shared types

// --- UPDATE THE INTERFACE ---
export interface ITaskRepository {
    getTasksForProject(projectId: number): Promise<TaskWithAssignee[]>;
    createTask(taskData: schema.InsertTask): Promise<TaskWithAssignee | null>;
    updateTask(taskId: number, taskData: Partial<Omit<schema.InsertTask, 'id' | 'projectId' | 'createdBy'>>): Promise<TaskWithAssignee | null>;
    deleteTask(taskId: number): Promise<boolean>;
    addTaskDependency(predecessorId: number, successorId: number): Promise<schema.TaskDependency | null>;
    removeTaskDependency(predecessorId: number, successorId: number): Promise<boolean>;
    getTaskById(taskId: number): Promise<TaskWithAssignee | null>;
    // --- ADD THIS LINE ---
    getDependenciesForProject(projectId: number): Promise<schema.TaskDependency[]>;
}

// Implementation
class TaskRepository implements ITaskRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    private async getTaskWithDetails(taskId: number): Promise<TaskWithAssignee | null> {
        // ... (existing method - no changes needed here)
        const task = await this.dbOrTx.query.tasks.findFirst({
            where: eq(schema.tasks.id, taskId),
            with: {
                assignee: { columns: { id: true, firstName: true, lastName: true, email: true } }
            }
        });

        if (!task) return null;
        return task as TaskWithAssignee;
    }

    async getTaskById(taskId: number): Promise<TaskWithAssignee | null> {
        // ... (existing method - no changes needed here)
         try {
            return await this.getTaskWithDetails(taskId);
         } catch (error) {
             console.error(`Error fetching task ${taskId}:`, error);
             throw new Error('Database error while fetching task.');
         }
    }

    async getTasksForProject(projectId: number): Promise<TaskWithAssignee[]> {
        // ... (existing method - no changes needed here)
        try {
            const tasks = await this.dbOrTx.query.tasks.findMany({
                where: eq(schema.tasks.projectId, projectId),
                orderBy: [asc(schema.tasks.createdAt)],
                with: {
                    assignee: { columns: { id: true, firstName: true, lastName: true, email: true } }
                }
            });
            return tasks as TaskWithAssignee[];
        } catch (error) {
            console.error(`Error fetching tasks for project ${projectId}:`, error);
            throw new Error('Database error while fetching tasks.');
        }
    }

    async createTask(taskData: schema.InsertTask): Promise<TaskWithAssignee | null> {
        // ... (existing method - no changes needed here)
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
       // ... (existing method - no changes needed here)
        if (Object.keys(taskData).length === 0) {
             console.warn("Update task called with empty data.");
             return this.getTaskWithDetails(taskId);
        }
        try {
            const result = await this.dbOrTx.update(schema.tasks)
                .set({ ...taskData, updatedAt: new Date() })
                .where(eq(schema.tasks.id, taskId))
                .returning({ id: schema.tasks.id });

            if (!result || result.length === 0) return null;
            return await this.getTaskWithDetails(taskId);
        } catch (error) {
            console.error(`Error updating task ${taskId}:`, error);
            throw new Error('Database error while updating task.');
        }
    }

    async deleteTask(taskId: number): Promise<boolean> {
        // ... (existing method - no changes needed here)
         const runDelete = async (tx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>) => {
            await tx.delete(schema.taskDependencies)
                .where(or(
                    eq(schema.taskDependencies.predecessorId, taskId),
                    eq(schema.taskDependencies.successorId, taskId)
                ));
            const result = await tx.delete(schema.tasks)
                .where(eq(schema.tasks.id, taskId))
                .returning({ id: schema.tasks.id });
            return result.length > 0;
         };

         try {
             if ('_.isTransaction' in this.dbOrTx && (this.dbOrTx as any)._.isTransaction) {
                  return await runDelete(this.dbOrTx);
             } else {
                 return await (this.dbOrTx as NeonDatabase<typeof schema>).transaction(runDelete);
             }
         } catch (error) {
             console.error(`Error deleting task ${taskId}:`, error);
             throw new Error('Database error while deleting task.');
         }
    }

    // --- ADD THIS ENTIRE METHOD ---
    async getDependenciesForProject(projectId: number): Promise<schema.TaskDependency[]> {
        try {
            // Fetch tasks belonging to the project first
            const projectTasks = await this.dbOrTx.select({ id: schema.tasks.id })
                .from(schema.tasks)
                .where(eq(schema.tasks.projectId, projectId));

            if (projectTasks.length === 0) {
                return []; // No tasks, so no dependencies
            }

            const taskIds = projectTasks.map(t => t.id);

            // Fetch dependencies where *both* predecessor and successor are in this project
            // This prevents fetching dependencies related to tasks outside the current project scope
            const dependencies = await this.dbOrTx.query.taskDependencies.findMany({
                where: and(
                    inArray(schema.taskDependencies.predecessorId, taskIds),
                    inArray(schema.taskDependencies.successorId, taskIds)
                )
            });
            return dependencies;
        } catch (error) {
            console.error(`Error fetching dependencies for project ${projectId}:`, error);
            throw new Error('Database error while fetching task dependencies.');
        }
    }
    // --- END OF ADDED METHOD ---


    async addTaskDependency(predecessorId: number, successorId: number): Promise<schema.TaskDependency | null> {
        // ... (existing method - no changes needed here)
        if (predecessorId === successorId) throw new Error("Task cannot depend on itself.");

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
                return existing ?? null;
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
        // ... (existing method - no changes needed here)
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

export const taskRepository = new TaskRepository();