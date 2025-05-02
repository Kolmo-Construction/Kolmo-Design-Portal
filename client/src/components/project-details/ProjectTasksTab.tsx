// client/src/components/project-details/ProjectTasksTab.tsx
import React, { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { Task as ApiTask, InsertTask, TaskDependency, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, PlusCircle, ClipboardList, AlertTriangle, Trash2, Eye } from "lucide-react";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { EditTaskDialog } from "./EditTaskDialog";

// --- NEW LIBRARY IMPORTS ---
import { Gantt, Task, EventOption, StylingOption, ViewMode, DisplayOption } from 'gantt-task-react';
import "gantt-task-react/dist/index.css"; // Import the CSS for the new library
// --- END NEW LIBRARY IMPORTS ---

// Import the updated utility function
import { formatTasksForGanttReact } from "@/lib/gantt-utils"; // Use the function adapted for gantt-task-react

// Hooks
import { useProjectTaskMutations } from "@/hooks/useProjectTaskMutations";
import { useTaskDialogs } from "@/hooks/useTaskDialogs";

interface ProjectTasksTabProps {
  projectId: number;
  user?: User; // Make user optional since it's passed from parent
}

// Type alias for the new library's Task type for clarity
type GanttReactTask = Task;

export function ProjectTasksTab({ projectId, user }: ProjectTasksTabProps) {
  // Fetch tasks and dependencies (remains the same)
  const tasksQueryKey = [`/api/projects/${projectId}/tasks`];
  const dependenciesQueryKey = [`/api/projects/${projectId}/tasks/dependencies`]; // Keep if needed for formatting

  const {
    data: tasks = [],
    isLoading: isLoadingTasks,
    error: errorTasks,
    isError: isErrorTasks,
    status: tasksStatus
  } = useQuery<ApiTask[]>({ queryKey: tasksQueryKey, queryFn: getQueryFn({ on401: "throw" }), enabled: !!projectId });

  // Fetch dependencies if your formatter uses them (formatTasksForGanttReact currently uses parentId)
  const {
      data: dependencies = [], // Or however dependencies are fetched/structured
      isLoading: isLoadingDeps,
      error: errorDeps,
      isError: isErrorDeps,
      status: depsStatus
  } = useQuery<TaskDependency[]>({ queryKey: dependenciesQueryKey, queryFn: getQueryFn({ on401: "throw" }), enabled: !!projectId && !isLoadingTasks });


  // --- Format tasks using the NEW utility function ---
  const formattedGanttTasks: GanttReactTask[] = useMemo(
      () => formatTasksForGanttReact(tasks), // Call the correct formatter
      [tasks] // Dependencies might be needed if formatter changes: [tasks, dependencies]
  );
  // --- END FORMATTING ---


  // Overall Loading and Error states (remains the same)
  const isLoading = isLoadingTasks || isLoadingDeps;
  const isError = isErrorTasks || isErrorDeps;
  const error = errorTasks || errorDeps;

  // Mutations hook
  const {
      createTaskMutation,
      deleteTaskMutation,
      updateTaskDateMutation,
      updateTaskProgressMutation,
      // Dependency mutations might be needed if library supports link creation via UI
      // createDependencyMutation,
      // deleteDependencyMutation,
  } = useProjectTaskMutations(projectId);

  // Dialogs hook (remains the same)
  const {
      isCreateDialogOpen,
      setIsCreateDialogOpen,
      isEditDialogOpen,
      setIsEditDialogOpen,
      isDeleteDialogOpen,
      setIsDeleteDialogOpen,
      taskToEdit,
      taskToDelete,
      handleAddTaskClick,
      handleTaskClick, // Used by handleDblClick below
      handleDeleteTrigger // Used by handleTaskDelete below
  } = useTaskDialogs(tasks);

  // Delete confirmation handler (remains the same)
  const confirmDelete = useCallback(() => {
      if (taskToDelete) {
          deleteTaskMutation.mutate(taskToDelete.id, {
              onSuccess: () => setIsDeleteDialogOpen(false),
              onError: () => setIsDeleteDialogOpen(false)
          });
      }
  }, [taskToDelete, deleteTaskMutation, setIsDeleteDialogOpen]);

  // --- Interaction Handlers for gantt-task-react ---

  /**
   * Handles date changes from dragging/resizing bars.
   * IMPORTANT: This library might trigger this continuously during drag.
   * Check the library's documentation if you only want to trigger on drag end.
   * We also check if dates actually changed before mutating.
   */
  const handleTaskChange = useCallback((task: GanttReactTask) => {
    console.log("[gantt-task-react] onDateChange:", task);
    const originalTask = tasks.find(t => String(t.id) === task.id);

    // Check if dates actually changed to avoid unnecessary mutations during drag
    const startDateChanged = originalTask?.startDate !== task.start.toISOString().split('T')[0]; // Compare YYYY-MM-DD part
    const dueDateChanged = originalTask?.dueDate !== task.end.toISOString().split('T')[0]; // Compare YYYY-MM-DD part

    if (originalTask && (startDateChanged || dueDateChanged)) {
        console.log(`[gantt-task-react] Dates changed for task ${task.id}. Mutating.`);
        updateTaskDateMutation.mutate({
            taskId: parseInt(task.id, 10), // Convert ID back to number if API expects number
            startDate: task.start.toISOString(),
            dueDate: task.end.toISOString(),
        });
    } else {
        // console.log(`[gantt-task-react] Dates did not change for task ${task.id}. Skipping mutation.`);
    }
  }, [tasks, updateTaskDateMutation]); // Include dependencies

  /**
   * Handles task deletion triggered by the library's UI (if available).
   */
  const handleTaskDelete = useCallback((task: GanttReactTask) => {
     console.log("[gantt-task-react] onDelete:", task);
     // Find original task to show name in dialog and trigger confirmation
     const originalTask = tasks.find(t => String(t.id) === task.id);
     if (originalTask) {
         handleDeleteTrigger(originalTask); // Use existing dialog trigger
     } else {
         console.warn(`Could not find original task with ID ${task.id} for deletion.`);
     }
  }, [tasks, handleDeleteTrigger]); // Include dependencies

  /**
   * Handles progress changes from dragging the progress handle.
   */
  const handleProgressChange = useCallback((task: GanttReactTask) => {
    console.log("[gantt-task-react] onProgressChange:", task);
    const originalTask = tasks.find(t => String(t.id) === task.id);
    // Optional: Check if progress actually changed
    if (originalTask && originalTask.progress !== task.progress) {
         updateTaskProgressMutation.mutate({
             taskId: parseInt(task.id, 10), // Convert ID back to number if API expects number
             progress: task.progress,
             // Include other fields if your mutation requires them (like status)
             // status: task.progress === 100 ? 'COMPLETED' : (task.progress > 0 ? 'IN_PROGRESS' : 'PENDING') // Example status update
         });
    }
  }, [tasks, updateTaskProgressMutation]); // Include dependencies

  /**
   * Handles double-clicking on a task bar or list item. Opens Edit Dialog.
   */
  const handleDblClick = useCallback((task: GanttReactTask) => {
    console.log("[gantt-task-react] onDoubleClick:", task);
    const originalTask = tasks.find(t => String(t.id) === task.id);
    if (originalTask && handleTaskClick) { // handleTaskClick opens the Edit Dialog
        handleTaskClick(originalTask);
    } else {
         console.warn(`Could not find original task with ID ${task.id} for double click.`);
    }
  }, [tasks, handleTaskClick]); // Include dependencies

  /**
   * Handles single-clicking on a task bar or list item. (Optional action)
   */
  const handleClick = useCallback((task: GanttReactTask) => {
    console.log("[gantt-task-react] onClick:", task.id);
    // Implement single-click behavior if needed (e.g., highlighting, showing details)
    // Currently does nothing.
  }, []); // No dependencies needed if it does nothing

  /**
   * Handles task selection change. (Optional action)
   */
  const handleSelect = useCallback((task: GanttReactTask, isSelected: boolean) => {
    console.log(`[gantt-task-react] onSelect: ${task.name} ${isSelected ? 'selected' : 'unselected'}`);
    // Implement selection behavior if needed (e.g., managing selected task state)
  }, []); // No dependencies needed if it does nothing

  /**
   * Handles clicking the expander icon for project tasks. (Optional action)
   */
  const handleExpanderClick = useCallback((task: GanttReactTask) => {
    console.log("[gantt-task-react] onExpanderClick:", task);
    // Implement expand/collapse logic if using 'project' type tasks with children
    // This usually involves managing local state to update the 'hideChildren' property
    // and potentially re-rendering or passing updated tasks to the Gantt component.
  }, []); // Dependencies would include state setter if managing expansion

  // --- End Interaction Handlers ---


  // Debug logging effect (optional)
  React.useEffect(() => {
    console.log('ProjectTasksTab State (gantt-task-react):', {
      projectId, isLoading, isError, error: error ? (error instanceof Error ? error.message : String(error)) : null,
      tasksStatus, tasksCount: tasks?.length, formattedGanttTasksCount: formattedGanttTasks?.length,
    });
  }, [ projectId, isLoading, isError, error, tasksStatus, tasks, formattedGanttTasks ]);


  // --- Render Logic ---
  const renderContent = () => {
    // Initial loading check
    if (isLoading && tasksStatus !== 'success') {
      return ( /* Skeleton */
         <div className="space-y-4 p-4">
             <Skeleton className="h-8 w-1/4" />
             <Skeleton className="h-[500px] w-full" />
         </div>
       );
    }
    // API error check
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : "Could not load tasks or dependencies.";
      return ( /* Error Alert */
          <Alert variant="destructive" className="m-4">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Data</AlertTitle>
             <AlertDescription>{errorMessage}</AlertDescription>
           </Alert>
      );
     }

     // Empty state if initial fetch resulted in zero tasks
     if (tasks.length === 0 && !isLoading && tasksStatus === 'success') {
        return ( /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg mt-4">
                 <div className="rounded-full bg-muted p-4 mb-4"><ClipboardList className="h-8 w-8 text-muted-foreground" /></div>
                 <h3 className="text-lg font-semibold mb-1">No Tasks Created Yet</h3>
                 <p className="text-muted-foreground mb-4">Add the first task for this project's schedule.</p>
                 <Button size="sm" onClick={handleAddTaskClick} className="gap-1"><PlusCircle className="h-4 w-4" />Add First Task</Button>
             </div>
         );
     }

    // Check pending status for mutations
    const isMutating = createTaskMutation.isPending || deleteTaskMutation.isPending || updateTaskDateMutation.isPending || updateTaskProgressMutation.isPending;

    // Render Gantt container
    return (
        <div className="h-[600px] w-full overflow-auto border rounded-md bg-background relative">
            {isMutating && ( /* Loading overlay */
                 <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                     <Loader2 className="h-6 w-6 animate-spin text-primary" />
                     <span className="ml-2">Processing...</span>
                 </div>
            )}
            {/* Render Gantt directly only if there are formatted tasks */}
            {formattedGanttTasks.length > 0 ? (
              <div className="gantt-container relative">
                {console.log('[ProjectTasksTab] Rendering gantt-task-react with tasks:', JSON.parse(JSON.stringify(formattedGanttTasks)))}

                {/* --- Use gantt-task-react Component with Interaction Handlers --- */}
                <Gantt
                    tasks={formattedGanttTasks} // Pass formatted tasks
                    viewMode={ViewMode.Week} // Example view mode
                    // --- Event Handlers for gantt-task-react ---
                    // Only add mutation handlers for non-client users
                    onDateChange={!isClient ? handleTaskChange : undefined} // Handles drag/resize
                    onDelete={!isClient ? handleTaskDelete : undefined} // Handles delete action
                    onProgressChange={!isClient ? handleProgressChange : undefined} // Handles progress
                    onDoubleClick={!isClient ? handleDblClick : undefined} // Handles double click
                    onClick={handleClick} // Always allow single click (view only)
                    onSelect={handleSelect} // Always allow selection (view only)
                    onExpanderClick={handleExpanderClick} // Always allow expand/collapse (view only)

                    // --- Styling & Config Props (Examples - check docs) ---
                    listCellWidth={"150px"} // Adjust width of the task list column
                    // columnWidth={60} // Adjust width of date columns in timeline
                    // ganttHeight={580} // Optional: Set explicit height
                    // barCornerRadius={4} // Optional: Styling
                    // handleWidth={8} // Optional: Styling
                    // Other relevant props:
                    // locale="en-US" // Set locale for date formatting
                    // timeStep={3600000} // Example: Set minimum time step (1 hour)
                    // Tooltip props if needed:
                    // TooltipContent={({ task, fontSize, fontFamily }) => <div>Custom: {task.name}</div>}
                />
                {/* --- End gantt-task-react Component --- */}
              </div>
            ) : (
                // Show message if tasks were fetched but all were filtered out by formatter
                tasks.length > 0 && !isLoading && tasksStatus === 'success' && (
                     <div className="flex flex-col items-center justify-center py-16 text-center">
                         <AlertTriangle className="h-8 w-8 text-muted-foreground mb-4" />
                         <h3 className="text-lg font-semibold mb-1">No Tasks to Display</h3>
                         <p className="text-muted-foreground">
                             Tasks were found, but none have valid start and end dates for the schedule view.
                         </p>
                     </div>
                )
            )}
             <div className="p-2 text-xs text-muted-foreground border-t">
                 {isClient 
                   ? "Note: View-only mode. Tasks are displayed in read-only format."
                   : "Note: Using gantt-task-react library. Drag tasks to adjust dates and progress."}
             </div>
        </div>
    );
  };

  // Check if user is a client
  const isClient = user?.role === 'client';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Project Tasks & Schedule</CardTitle>
          <CardDescription>
            {isClient 
              ? "View project tasks and schedule timeline." 
              : "Visualize tasks, update dates (drag/resize) and progress (drag handle)."}
          </CardDescription>
        </div>
        {/* Only show Add Task button for non-client users */}
        {!isClient && (
          <Button size="sm" onClick={handleAddTaskClick} className="gap-1" disabled={isLoading && !tasks?.length}>
              <PlusCircle className="h-4 w-4" /> Add Task
          </Button>
        )}
        {/* Show view-only indicator for clients */}
        {isClient && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Eye className="h-4 w-4 mr-1" /> View Only
          </div>
        )}
      </CardHeader>
      <CardContent>
         {renderContent()}
      </CardContent>

      {/* Only render dialogs for non-client users */}
      {!isClient && (
        <>
          <CreateTaskDialog
            isOpen={isCreateDialogOpen}
            setIsOpen={setIsCreateDialogOpen}
            projectId={projectId}
            onSubmit={(values) => createTaskMutation.mutate(values, {
                onSuccess: () => setIsCreateDialogOpen(false)
            })}
         isPending={createTaskMutation.isPending}
       />
       <EditTaskDialog
         isOpen={isEditDialogOpen}
         setIsOpen={setIsEditDialogOpen}
         taskToEdit={taskToEdit}
         projectId={projectId}
         onDeleteRequest={handleDeleteTrigger}
       />

       {/* --- Ensure AlertDialog Structure is Correct --- */}
       <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the task <span className="font-medium">"{taskToDelete?.title}"</span> and any associated dependencies.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                     <AlertDialogCancel disabled={deleteTaskMutation.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirmDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteTaskMutation.isPending}
                    >
                         {deleteTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Yes, delete task
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
       {/* --- End AlertDialog --- */}
        </>
      )}
    </Card>
  );
}
