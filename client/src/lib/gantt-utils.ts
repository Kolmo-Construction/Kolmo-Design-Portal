// client/src/lib/gantt-utils.ts (Adapted for gantt-task-react)
import { Task as GanttTaskReact, TaskType } from 'gantt-task-react'; // Import from the new library
import type { Task as ApiTask } from '../../server/storage/types'; // Your API Task type
import { parseISO, isValid, differenceInDays, endOfDay } from 'date-fns';

// Define the structure expected by gantt-task-react Task type
// (Based on common usage - verify with library's actual types if needed)
// Note: gantt-task-react handles dependencies within the task object itself.
interface FormattedTask extends GanttTaskReact {
  // Required fields by gantt-task-react:
  id: string;
  name: string;
  start: Date;
  end: Date;
  type: TaskType; // 'task', 'milestone', 'project'
  progress: number; // 0-100

  // Optional fields:
  isDisabled?: boolean;
  styles?: {
    backgroundColor?: string;
    backgroundSelectedColor?: string;
    progressColor?: string;
    progressSelectedColor?: string;
  };
  dependencies?: string[]; // Array of predecessor task IDs
  project?: string; // Optional project grouping ID
  displayOrder?: number; // Optional display order
  // hideChildren?: boolean; // For project type
}

/**
 * Transforms API tasks into the format required by gantt-task-react.
 * Filters out tasks that lack valid core properties.
 * @param apiTasks - Array of tasks fetched from the API.
 * @returns An array of formatted tasks suitable for gantt-task-react.
 */
export function formatTasksForGanttReact(
  apiTasks: ApiTask[] | undefined | null
): FormattedTask[] {
  if (!apiTasks || apiTasks.length === 0) {
    return [];
  }

  console.log('[gantt-utils-react] Input API Tasks:', JSON.parse(JSON.stringify(apiTasks)));

  const formattedTasks: FormattedTask[] = [];
  const taskMap = new Map<number, ApiTask>(); // Map API task ID to task
  const validTaskIds = new Set<string>(); // Keep track of valid task IDs (using string)

  // First pass: Create map and validate basic structure + dates
  const potentiallyValidTasks = apiTasks.filter((apiTask) => {
    // Basic Object Validation
    if (!apiTask || typeof apiTask.id === 'undefined' || apiTask.id === null) {
      console.warn('[gantt-utils-react] Skipping task with missing or invalid ID:', apiTask);
      return false;
    }
    const taskIdStr = String(apiTask.id); // Use string IDs consistently

    // Ensure name is valid
    if (typeof apiTask.title !== 'string' || apiTask.title.trim() === '') {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} has missing or empty title. Skipping.`);
      return false;
    }

    taskMap.set(apiTask.id, apiTask); // Add to map

    // Date Parsing and Validation
    if (!apiTask.startDate || !apiTask.dueDate) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') is missing original start or due date. Filtering out.`);
      return false;
    }
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    try {
      startDate = parseISO(apiTask.startDate);
      endDate = parseISO(apiTask.dueDate);
    } catch (e) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') failed basic date parsing. Error: ${e}. Skipping.`);
      return false;
    }

    if (!isValid(startDate)) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has invalid start date after parsing: ${apiTask.startDate}. Filtering out.`);
      return false;
    }
    if (!isValid(endDate)) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has invalid end date after parsing: ${apiTask.dueDate}. Filtering out.`);
      return false;
    }

    // Date Adjustment (End before Start)
    if (endDate < startDate) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has due date before start date, adjusting end date.`);
      endDate = endOfDay(startDate);
      if (!isValid(endDate)) {
        console.error(`[gantt-utils-react] CRITICAL: Task ID ${taskIdStr} ('${apiTask.title}') has invalid end date *after adjustment*. Skipping.`);
        return false;
      }
      // Store adjusted date back temporarily if needed, or handle in next step
      apiTask.dueDate = endDate.toISOString(); // Example: updatedueDate for consistency if needed later
    }

    return true; // Task passed initial validation
  });

  // Second pass: Format valid tasks and handle dependencies
  potentiallyValidTasks.forEach((apiTask) => {
    const taskIdStr = String(apiTask.id);
    const startDate = parseISO(apiTask.startDate!); // We know these are valid now
    const endDate = parseISO(apiTask.dueDate!);   // We know these are valid now

    // Progress Calculation & Validation
    let progress = 0;
    switch (apiTask.status) {
      case 'COMPLETED': progress = 100; break;
      case 'IN_PROGRESS': progress = 50; break; // Placeholder
      default: progress = 0; break;
    }
    if (typeof progress !== 'number' || isNaN(progress) || progress < 0 || progress > 100) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has invalid progress value (${progress}). Defaulting to 0.`);
      progress = 0;
    }

    // Determine Task Type & Validation
    let taskType: TaskType = 'task'; // Default for gantt-task-react
    // Example: Identify milestones (if start and end date are the same day)
    if (differenceInDays(endDate, startDate) === 0) {
      taskType = 'milestone';
    }
    // Add logic for 'project' type if applicable based on your data (e.g., apiTask.isSummary)

    // Validate type against TaskType enum values
    const validTypes: TaskType[] = ['task', 'milestone', 'project'];
    if (!validTypes.includes(taskType)) {
        console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has invalid type (${taskType}). Defaulting to 'task'.`);
        taskType = 'task';
    }


    // Handle Dependencies (gantt-task-react uses `dependencies` array)
    let dependencies: string[] = [];
    if (apiTask.parentId !== null && typeof apiTask.parentId !== 'undefined') {
        // Check if the parent task also passed validation
        const parentIdStr = String(apiTask.parentId);
        if (potentiallyValidTasks.some(t => String(t.id) === parentIdStr)) {
            dependencies.push(parentIdStr);
        } else {
             console.warn(`[gantt-utils-react] Task ID ${taskIdStr} dependency parent ID ${parentIdStr} was filtered out. Skipping dependency.`);
        }
    }
    // Add logic here if dependencies are stored differently (e.g., an array field on apiTask)


    // Construct the GanttTask Object for gantt-task-react
    const ganttTask: FormattedTask = {
      id: taskIdStr,
      name: apiTask.title,
      start: startDate,
      end: endDate,
      progress: progress,
      type: taskType,
      isDisabled: apiTask.status === 'CANCELLED',
      styles: apiTask.status === 'CANCELLED' ? { progressColor: '#aaaaaa', progressSelectedColor: '#888888', backgroundColor: '#e0e0e0', backgroundSelectedColor: '#d0d0d0' } : undefined,
      dependencies: dependencies, // Add dependencies array
      // project: String(apiTask.projectId), // Optional: Assign project ID if needed for grouping
      // displayOrder: apiTask.displayOrder ?? undefined // Optional: Assign display order
    };

    // Final check (optional, as filtering done above)
    if (!ganttTask.id || !ganttTask.name || !ganttTask.start || !ganttTask.end || typeof ganttTask.progress !== 'number' || !ganttTask.type) {
         console.error(`[gantt-utils-react] CRITICAL: Task ID ${ganttTask.id} failed final validation check before push. Skipping.`, ganttTask);
         return; // Skip push
    }

    validTaskIds.add(taskIdStr); // Add to set of valid IDs
    formattedTasks.push(ganttTask);
  });


  console.log('[gantt-utils-react] Output Formatted Tasks:', JSON.parse(JSON.stringify(formattedTasks)));

  return formattedTasks; // gantt-task-react typically takes tasks array directly
}

