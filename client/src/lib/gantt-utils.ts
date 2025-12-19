// client/src/lib/gantt-utils.ts (Adapted for gantt-task-react)
import { Task as GanttTaskReact } from 'gantt-task-react'; // Import from the new library
import type { Task as ApiTask } from '@shared/schema'; // Your API Task type
import { parseISO, isValid, differenceInDays, endOfDay } from 'date-fns';

// Define TaskType locally since it might not be exported
type TaskType = 'task' | 'milestone' | 'project';

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
  const tasksWithOriginalDates = new Set<number>(); // Track tasks that have original dates

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

    // Date Parsing and Validation - provide defaults for missing dates
    if (!apiTask.startDate || !apiTask.dueDate) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') is missing original start or due date. Using default dates.`);
    } else {
      tasksWithOriginalDates.add(apiTask.id);
    }
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    try {
      if (apiTask.startDate instanceof Date) {
        startDate = apiTask.startDate;
      } else if (typeof apiTask.startDate === 'string') {
        startDate = parseISO(apiTask.startDate);
      } else if (!apiTask.startDate) {
        // Provide default start date (today)
        startDate = new Date();
      } else {
        throw new Error('Invalid startDate type');
      }
      
      if (apiTask.dueDate instanceof Date) {
        endDate = apiTask.dueDate;
      } else if (typeof apiTask.dueDate === 'string') {
        endDate = parseISO(apiTask.dueDate);
      } else if (!apiTask.dueDate) {
        // Provide default end date (tomorrow)
        endDate = new Date();
        endDate.setDate(endDate.getDate() + 1);
      } else {
        throw new Error('Invalid dueDate type');
      }
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
      // Note: We don't modify the original apiTask object, just use the adjusted endDate
    }

    return true; // Task passed initial validation
  });

  // Second pass: Format valid tasks and handle dependencies
  potentiallyValidTasks.forEach((apiTask) => {
    const taskIdStr = String(apiTask.id);
    
    // Parse dates with proper type checking and null safety
    let startDate: Date;
    let endDate: Date;
    
    if (apiTask.startDate instanceof Date) {
      startDate = apiTask.startDate;
    } else if (typeof apiTask.startDate === 'string') {
      startDate = parseISO(apiTask.startDate);
    } else {
      // Provide default start date for tasks without dates
      startDate = new Date();
    }
    
    if (apiTask.dueDate instanceof Date) {
      endDate = apiTask.dueDate;
    } else if (typeof apiTask.dueDate === 'string') {
      endDate = parseISO(apiTask.dueDate);
    } else {
      // Provide default end date for tasks without dates
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);
    }

    // Progress Calculation & Validation
    // Use the actual progress field if available, otherwise fall back to status-based defaults
    let progress = 0;

    if (typeof apiTask.progress === 'number' && apiTask.progress >= 0 && apiTask.progress <= 100) {
      // Use the actual progress value from the database
      progress = apiTask.progress;
    } else {
      // Fall back to status-based progress if no progress field exists
      switch (apiTask.status?.toLowerCase()) {
        case 'done':
        case 'completed':
          progress = 100;
          break;
        case 'in_progress':
        case 'in progress':
          progress = 50;
          break;
        case 'todo':
        case 'pending':
          progress = 0;
          break;
        case 'blocked':
          progress = 25; // Show minimal progress to indicate it was started but blocked
          break;
        case 'cancelled':
          progress = 0;
          break;
        default:
          progress = 0;
          break;
      }
    }

    if (typeof progress !== 'number' || isNaN(progress) || progress < 0 || progress > 100) {
      console.warn(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has invalid progress value (${progress}). Defaulting to 0.`);
      progress = 0;
    }

    // Determine Task Type & Validation
    let taskType: TaskType = 'task'; // Default for gantt-task-react
    // Only create milestones for tasks that have actual dates (not default generated ones)
    const hasActualDates = tasksWithOriginalDates.has(apiTask.id);
    if (hasActualDates && apiTask.startDate && apiTask.dueDate && differenceInDays(endDate, startDate) === 0) {
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
    // Note: Currently no parent-child relationships in the task schema
    // Dependencies would be handled through a separate task_dependencies table if needed


    // Determine styling based on task status and properties
    let taskStyles: FormattedTask['styles'] = undefined;
    const status = apiTask.status?.toLowerCase();
    
    // Priority: Status-based styling overrides billing status
    switch (status) {
      case 'done':
      case 'completed':
        // Completed tasks - Green with checkmark feel
        taskStyles = {
          backgroundColor: '#059669', // Green-600
          backgroundSelectedColor: '#047857', // Green-700
          progressColor: '#10b981', // Green-500
          progressSelectedColor: '#059669' // Green-600
        };
        break;
        
      case 'in_progress':
      case 'in progress':
        // In Progress tasks - Blue (active work)
        taskStyles = {
          backgroundColor: '#2563eb', // Blue-600
          backgroundSelectedColor: '#1d4ed8', // Blue-700
          progressColor: '#3b82f6', // Blue-500
          progressSelectedColor: '#2563eb' // Blue-600
        };
        break;
        
      case 'blocked':
        // Blocked tasks - Red/Orange (attention needed)
        taskStyles = {
          backgroundColor: '#dc2626', // Red-600
          backgroundSelectedColor: '#b91c1c', // Red-700
          progressColor: '#ef4444', // Red-500
          progressSelectedColor: '#dc2626' // Red-600
        };
        break;
        
      case 'cancelled':
        // Cancelled tasks - Gray (inactive)
        taskStyles = {
          backgroundColor: '#6b7280', // Gray-500
          backgroundSelectedColor: '#4b5563', // Gray-600
          progressColor: '#9ca3af', // Gray-400
          progressSelectedColor: '#6b7280' // Gray-500
        };
        break;
        
      case 'todo':
      case 'pending':
      default:
        // Todo/Pending tasks - Use billing status for distinction
        if (apiTask.isBillable) {
          // Billable tasks - Purple (premium feel)
          taskStyles = {
            backgroundColor: '#7c3aed', // Purple-600
            backgroundSelectedColor: '#6d28d9', // Purple-700
            progressColor: '#8b5cf6', // Purple-500
            progressSelectedColor: '#7c3aed' // Purple-600
          };
        } else {
          // Non-billable tasks - Teal (standard work)
          taskStyles = {
            backgroundColor: '#0891b2', // Cyan-600
            backgroundSelectedColor: '#0e7490', // Cyan-700
            progressColor: '#06b6d4', // Cyan-500
            progressSelectedColor: '#0891b2' // Cyan-600
          };
        }
        break;
    }

    // Add billable indicator to task name for extra clarity
    const displayName = apiTask.isBillable ? `💰 ${apiTask.title}` : apiTask.title;

    // Ensure dates are valid Date objects
    if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date)) {
      console.error(`[gantt-utils-react] Task ID ${taskIdStr} ('${apiTask.title}') has invalid Date objects. Skipping.`);
      return false;
    }

    // Construct the GanttTask Object for gantt-task-react
    const ganttTask: FormattedTask = {
      id: taskIdStr,
      name: displayName,
      start: startDate,
      end: endDate,
      progress: progress,
      type: taskType,
      isDisabled: apiTask.status === 'CANCELLED',
      styles: taskStyles,
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

