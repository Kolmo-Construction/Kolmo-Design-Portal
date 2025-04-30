// client/src/lib/gantt-utils.ts
import { Task, TaskDependency } from "@shared/schema";
import { Task as GanttTask } from "wx-react-gantt";

/**
 * Helper to format tasks for the wx-react-gantt library.
 * Includes progress and dependencies.
 *
 * @param tasks - Array of Task objects from the database.
 * @param dependencies - Array of TaskDependency objects from the database.
 * @returns Array of GanttTask objects compatible with the library.
 */
export const formatTasksForGantt = (tasks: Task[], dependencies: TaskDependency[] = []): GanttTask[] => {
    // --- ADDED: Filter out any potentially invalid/undefined task objects ---
    // This prevents errors if the API somehow returns null/undefined within the array
    const validTasks = tasks.filter(task => task && typeof task === 'object' && task.id !== undefined);
    if (validTasks.length !== tasks.length) {
        console.warn('[gantt-utils] Filtered out invalid/undefined task objects from input array.');
    }
    // --- END ADDED FILTER ---

    // Create a map for quick lookup of dependencies for each task (successor)
    const successorDependenciesMap = new Map<number, number[]>();
    dependencies.forEach(dep => {
        const successors = successorDependenciesMap.get(dep.successorId) ?? [];
        successors.push(dep.predecessorId);
        successorDependenciesMap.set(dep.successorId, successors);
    });

    // --- MODIFIED: Use validTasks instead of tasks for mapping ---
    return validTasks.map(task => {
      // Use the progress field from the task data if it exists, otherwise default to 0
      // TypeScript note: we're checking for an optional field that might be added by backend
      const progress = (task as any).progress ?? 0; 

      const type: "task" | "milestone" | "project" = "task"; // Default type

      // --- Date Handling ---
      let startDate: Date;
      let endDate: Date;
      if (task.startDate) { startDate = new Date(task.startDate); }
      else {
        // Fallback if start date is missing (consider logging a warning)
        console.warn(`Task ID ${task.id} ('${task.title}') missing start date, using current date as fallback for Gantt.`);
        startDate = new Date();
      }

      if (task.dueDate) { endDate = new Date(task.dueDate); }
      else {
        // Fallback if due date is missing (consider logging a warning)
        console.warn(`Task ID ${task.id} ('${task.title}') missing due date, using start date + 1 day as fallback for Gantt.`);
        endDate = new Date(startDate.getTime() + 86400000); // Fallback to 1 day duration
      }

      // Ensure end date is not before start date
      if (endDate < startDate) {
        console.warn(`Task ID ${task.id} ('${task.title}') has due date before start date, adjusting end date for Gantt.`);
        endDate = new Date(startDate.getTime() + 86400000); // Adjust if end < start
      }
      // --- End Date Handling ---

      // Get dependencies for this task (where this task is the successor)
      const taskDependencies = successorDependenciesMap.get(task.id)?.map(String) ?? []; // Convert IDs to strings

      // Create Gantt task with all required properties explicitly set
      // This helps prevent "Cannot read properties of undefined (reading 'type')" errors
      const ganttTask: GanttTask = {
        id: task.id.toString(),
        start: startDate,
        end: endDate,
        text: task.title || `Task ${task.id}`, // Ensure text is never empty
        progress: progress, // Use the actual progress value
        type: type, // Always "task" as defined above
        dependencies: taskDependencies, // Add formatted dependencies
        // Additional properties with default values to ensure they're never undefined
        // Some of these might be internal to wx-react-gantt but adding them can prevent errors
        hidden: false,
        styles: {}, // Ensure styles object exists
        isDisabled: false, // Default to not disabled
        // _original: task, // Optional: Keep original data reference if needed later
      };

      // console.log(`[gantt-utils] Mapped task ${task.id}:`, JSON.stringify(ganttTask, null, 2)); // Optional debug log
      return ganttTask;
    }).filter(gt => {
        // Ensure dates are valid before including in the final array
        const isValid = !isNaN(gt.start.getTime()) && !isNaN(gt.end.getTime());
        if (!isValid) {
            console.warn(`Task ID ${gt.id} filtered out from Gantt due to invalid dates.`);
        }
        return isValid;
    });
};