/**
 * RAG (Retrieval Augmented Generation) Service
 * Provides functionality for AI-assisted task generation for construction projects
 */
import { db } from '../db';
import {
  projectVersions,
  generationPrompts,
  ragTasks,
  ragTaskDependencies,
  taskChunks,
  taskFeedback,
  users,
  projects,
  ProjectVersion,
  InsertProjectVersion,
  GenerationPrompt,
  InsertGenerationPrompt,
  RagTask,
  InsertRagTask,
  RagTaskDependency,
  InsertRagTaskDependency,
  TaskFeedback,
  InsertTaskFeedback,
  feedbackTypeEnum,
} from '@shared/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { createNotFoundError, createBadRequestError } from '../errors';

/**
 * Create a new project version
 */
export async function createProjectVersion(data: { projectId: number, notes: string | null }): Promise<ProjectVersion> {
  try {
    // Check if project exists
    const projectExists = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });

    if (!projectExists) {
      throw createNotFoundError(`Project with ID ${data.projectId} not found`);
    }

    // Get the latest version number for this project
    const latestVersion = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.projectId, data.projectId),
      orderBy: [desc(projectVersions.versionNumber)],
    });

    // Create a new version with incremented version number
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    
    const [newVersion] = await db
      .insert(projectVersions)
      .values({
        projectId: data.projectId,
        notes: data.notes,
        versionNumber,
      })
      .returning();

    return newVersion;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to create project version');
  }
}

/**
 * Get all versions for a project
 */
export async function getProjectVersions(projectId: number): Promise<ProjectVersion[]> {
  try {
    // Check if project exists
    const projectExists = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!projectExists) {
      throw createNotFoundError(`Project with ID ${projectId} not found`);
    }

    const versions = await db.query.projectVersions.findMany({
      where: eq(projectVersions.projectId, projectId),
      orderBy: [desc(projectVersions.versionNumber)],
    });

    return versions;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get project versions');
  }
}

/**
 * Get a specific project version
 */
export async function getProjectVersion(versionId: string): Promise<ProjectVersion> {
  try {
    const version = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.id, versionId),
    });

    if (!version) {
      throw createNotFoundError(`Project version with ID ${versionId} not found`);
    }

    return version;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get project version');
  }
}

/**
 * Create a new generation prompt
 */
export async function createGenerationPrompt(data: InsertGenerationPrompt): Promise<GenerationPrompt> {
  try {
    // Check if project version exists
    const versionExists = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.id, data.projectVersionId),
    });

    if (!versionExists) {
      throw createNotFoundError(`Project version with ID ${data.projectVersionId} not found`);
    }

    const [newPrompt] = await db
      .insert(generationPrompts)
      .values(data)
      .returning();

    return newPrompt;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to create generation prompt');
  }
}

/**
 * Get generation prompts for a project version
 */
export async function getGenerationPrompts(versionId: string): Promise<GenerationPrompt[]> {
  try {
    const prompts = await db.query.generationPrompts.findMany({
      where: eq(generationPrompts.projectVersionId, versionId),
      orderBy: [desc(generationPrompts.createdAt)],
    });

    return prompts;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get generation prompts');
  }
}

/**
 * Create a new RAG task
 */
export async function createRagTask(data: InsertRagTask): Promise<RagTask> {
  try {
    // Check if project version exists
    const versionExists = await db.query.projectVersions.findFirst({
      where: eq(projectVersions.id, data.projectVersionId),
    });

    if (!versionExists) {
      throw createNotFoundError(`Project version with ID ${data.projectVersionId} not found`);
    }

    const [newTask] = await db
      .insert(ragTasks)
      .values(data)
      .returning();

    return newTask;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to create RAG task');
  }
}

/**
 * Get RAG tasks for a project version
 */
export async function getRagTasks(versionId: string): Promise<RagTask[]> {
  try {
    const tasks = await db.query.ragTasks.findMany({
      where: eq(ragTasks.projectVersionId, versionId),
      orderBy: [asc(ragTasks.phase), asc(ragTasks.trade)],
    });

    return tasks;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get RAG tasks');
  }
}

/**
 * Create a RAG task dependency
 */
export async function createRagTaskDependency(data: InsertRagTaskDependency): Promise<RagTaskDependency> {
  try {
    // Check if task exists
    const taskExists = await db.query.ragTasks.findFirst({
      where: eq(ragTasks.id, data.taskId),
    });

    if (!taskExists) {
      throw createNotFoundError(`Task with ID ${data.taskId} not found`);
    }

    // Check if dependency task exists
    const dependsOnTaskExists = await db.query.ragTasks.findFirst({
      where: eq(ragTasks.id, data.dependsOnTaskId),
    });

    if (!dependsOnTaskExists) {
      throw createNotFoundError(`Dependency task with ID ${data.dependsOnTaskId} not found`);
    }

    // Check if they belong to the same project version
    if (taskExists.projectVersionId !== dependsOnTaskExists.projectVersionId) {
      throw createBadRequestError('Tasks must belong to the same project version');
    }

    // Check if dependency already exists
    const dependencyExists = await db.query.ragTaskDependencies.findFirst({
      where: and(
        eq(ragTaskDependencies.taskId, data.taskId),
        eq(ragTaskDependencies.dependsOnTaskId, data.dependsOnTaskId)
      ),
    });

    if (dependencyExists) {
      throw createBadRequestError('Dependency already exists');
    }

    const [newDependency] = await db
      .insert(ragTaskDependencies)
      .values(data)
      .returning();

    return newDependency;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to create RAG task dependency');
  }
}

/**
 * Get RAG task dependencies for a task
 */
export async function getRagTaskDependencies(taskId: string): Promise<RagTaskDependency[]> {
  try {
    const dependencies = await db.query.ragTaskDependencies.findMany({
      where: eq(ragTaskDependencies.taskId, taskId),
    });

    return dependencies;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get RAG task dependencies');
  }
}

/**
 * Create task feedback
 */
export async function createTaskFeedback(data: InsertTaskFeedback): Promise<TaskFeedback> {
  try {
    // Check if task exists
    const taskExists = await db.query.ragTasks.findFirst({
      where: eq(ragTasks.id, data.taskId),
    });

    if (!taskExists) {
      throw createNotFoundError(`Task with ID ${data.taskId} not found`);
    }

    // Check if user exists
    const userExists = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    });

    if (!userExists) {
      throw createNotFoundError(`User with ID ${data.userId} not found`);
    }

    const [newFeedback] = await db
      .insert(taskFeedback)
      .values(data)
      .returning();

    return newFeedback;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to create task feedback');
  }
}

/**
 * Get task feedback for a task
 */
export async function getTaskFeedback(taskId: string): Promise<TaskFeedback[]> {
  try {
    const feedback = await db.query.taskFeedback.findMany({
      where: eq(taskFeedback.taskId, taskId),
      orderBy: [desc(taskFeedback.createdAt)],
    });

    return feedback;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get task feedback');
  }
}

/**
 * Get task feedback with user information
 */
export async function getTaskFeedbackWithUserInfo(taskId: string): Promise<(TaskFeedback & { userInfo: { firstName: string; lastName: string } })[]> {
  try {
    const feedback = await db.query.taskFeedback.findMany({
      where: eq(taskFeedback.taskId, taskId),
      with: {
        user: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [desc(taskFeedback.createdAt)],
    });

    return feedback.map(fb => ({
      ...fb,
      userInfo: {
        firstName: fb.user.firstName,
        lastName: fb.user.lastName,
      },
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to get task feedback with user info');
  }
}

/**
 * Convert RAG tasks to regular project tasks
 * This function will create regular tasks from RAG tasks that can be used in the project's task list
 */
export async function convertRagTasksToProjectTasks(versionId: string, projectId: number): Promise<void> {
  try {
    // Check if project exists
    const projectExists = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!projectExists) {
      throw createNotFoundError(`Project with ID ${projectId} not found`);
    }

    // Check if version exists and belongs to the project
    const version = await db.query.projectVersions.findFirst({
      where: and(
        eq(projectVersions.id, versionId),
        eq(projectVersions.projectId, projectId)
      ),
    });

    if (!version) {
      throw createNotFoundError(`Project version with ID ${versionId} not found or does not belong to project ${projectId}`);
    }

    // Get all RAG tasks for this version
    const ragTasksList = await db.query.ragTasks.findMany({
      where: eq(ragTasks.projectVersionId, versionId),
      orderBy: [asc(ragTasks.phase), asc(ragTasks.trade)],
    });

    if (ragTasksList.length === 0) {
      throw createBadRequestError('No RAG tasks found for this version');
    }

    // Begin a transaction
    await db.transaction(async (tx) => {
      // Insert regular tasks for each RAG task
      const taskInserts = ragTasksList.map(ragTask => ({
        projectId: projectId,
        title: `${ragTask.phase} - ${ragTask.trade} - ${ragTask.taskName}`,
        description: ragTask.description,
        status: 'todo',
        priority: 'medium',
        estimatedHours: ragTask.durationDays * 8, // Convert days to hours (8-hour days)
        // Don't set publishedAt - tasks start unpublished
      }));

      const insertedTasks = await tx.insert(db.tasks).values(taskInserts).returning({
        id: db.tasks.id,
        title: db.tasks.title,
      });

      // Get RAG task dependencies
      // Create a mapping from RAG task ID to regular task ID
      const ragTaskToTaskMap = new Map();
      
      for (let i = 0; i < ragTasksList.length; i++) {
        ragTaskToTaskMap.set(ragTasksList[i].id, insertedTasks[i].id);
      }

      // For each RAG task, get its dependencies and create regular task dependencies
      for (const ragTask of ragTasksList) {
        const dependencies = await db.query.ragTaskDependencies.findMany({
          where: eq(ragTaskDependencies.taskId, ragTask.id),
        });

        // Skip if no dependencies
        if (dependencies.length === 0) continue;

        // Create regular task dependencies
        const taskDependencyInserts = dependencies.map(dep => {
          const successorTaskId = ragTaskToTaskMap.get(dep.taskId);
          const predecessorTaskId = ragTaskToTaskMap.get(dep.dependsOnTaskId);

          return {
            successorId: successorTaskId,
            predecessorId: predecessorTaskId,
            type: 'FS', // Finish-to-Start is the default
          };
        });

        // Insert task dependencies if any
        if (taskDependencyInserts.length > 0) {
          await tx.insert(db.taskDependencies).values(taskDependencyInserts);
        }
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw createBadRequestError('Failed to convert RAG tasks to project tasks');
  }
}