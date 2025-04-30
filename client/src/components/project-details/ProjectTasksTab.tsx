// client/src/components/project-details/ProjectTasksTab.tsx
import React, { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Task, InsertTask, TaskDependency } from "@shared/schema";
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
} from "@/components/ui/alert-dialog";
import { Loader2, PlusCircle, ClipboardList, AlertTriangle, Trash2 } from "lucide-react";
// Removed toast import if only used in hooks now
import { CreateTaskDialog } from "./CreateTaskDialog"; // Assuming this component exists
import { EditTaskDialog } from "./EditTaskDialog";     // Assuming this component exists
import { Gantt, Task as GanttTask } from "wx-react-gantt";
import "wx-react-gantt/dist/gantt.css";
import { formatTasksForGantt } from "@/lib/gantt-utils"; // Assuming this util exists
import { useProjectTaskMutations } from "@/hooks/useProjectTaskMutations"; // Assuming this hook exists
import { useGanttInteractions } from "@/hooks/useGanttInteractions";       // Assuming this hook exists
// --- ADDED: Import the new dialogs hook ---
import { useTaskDialogs } from "@/hooks/useTaskDialogs";                   // Assuming this hook exists
// --- END ADDED ---


// Define ViewMode enum based on required library values
const ViewMode = {
  Day: "Day",
  Week: "Week", 
  Month: "Month"
} as const;

// Create a type from the enum values
type ViewModeType = typeof ViewMode[keyof typeof ViewMode];
interface ProjectTasksTabProps {
  projectId: number;
}

export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  // --- Keep QueryClient if needed for direct cache interaction ---
  // const queryClient = useQueryClient();
  // --- REMOVED: Dialog and task state useState hooks ---

  // Fetch tasks and dependencies - using proper API URLs as first element
  const tasksQueryKey = [`/api/projects/${projectId}/tasks`];
  const dependenciesQueryKey = [`/api/projects/${projectId}/tasks/dependencies`];

  const {
    data: tasks = [], // Provide default value
    isLoading: isLoadingTasks,
    error: errorTasks,
    isError: isErrorTasks,
    isFetching: isFetchingTasks, // Added for more detailed logging
    status: tasksStatus        // Added for more detailed logging
  } = useQuery<Task[]>({ queryKey: tasksQueryKey, queryFn: getQueryFn({ on401: "throw" }), enabled: !!projectId });

  const {
      data: dependencies = [], // Provide default value
      isLoading: isLoadingDeps,
      error: errorDeps,
      isError: isErrorDeps,
      isFetching: isFetchingDeps, // Added for more detailed logging
      status: depsStatus          // Added for more detailed logging
  } = useQuery<TaskDependency[]>({ queryKey: dependenciesQueryKey, queryFn: getQueryFn({ on401: "throw" }), enabled: !!projectId && !isLoadingTasks });

  // Format tasks for Gantt
  const formattedGanttTasks = useMemo(() => formatTasksForGantt(tasks, dependencies), [tasks, dependencies]);

  // Loading and Error states
  const isLoading = isLoadingTasks || isLoadingDeps;
  const isError = isErrorTasks || isErrorDeps;
  const error = errorTasks || errorDeps;

  // Get mutations from the hook
  const {
      createTaskMutation,
      deleteTaskMutation,
      updateTaskDateMutation,
      updateTaskProgressMutation,
      createDependencyMutation,
      deleteDependencyMutation,
  } = useProjectTaskMutations(projectId);

  // Get Gantt interaction handlers from the hook
  const {
      handleDateChange,
      handleProgressChange,
      handleDependencyLink,
      // handleDependencyUnlink, // Only include if actually used by Gantt props
  } = useGanttInteractions({
      updateTaskDateMutation,
      updateTaskProgressMutation,
      createDependencyMutation,
      deleteDependencyMutation,
      tasksQueryKey,
  });

  // --- ADDED: Get Dialog state and handlers from the hook ---
  // Pass the fetched tasks array to the hook
  const {
      isCreateDialogOpen,
      setIsCreateDialogOpen,
      isEditDialogOpen,
      setIsEditDialogOpen,
      isDeleteDialogOpen,
      setIsDeleteDialogOpen, // This setter now clears taskToDelete on close
      taskToEdit,
      taskToDelete, // Still needed for Delete Dialog content
      handleAddTaskClick, // Opens Create Dialog
      handleTaskClick,    // Opens Edit Dialog (passed to Gantt onClick)
      handleDeleteTrigger // Opens Delete Confirmation (passed down to Edit Dialog)
  } = useTaskDialogs(tasks);
  // --- END ADDED ---


  // --- Handler for confirming delete action ---
  // This still needs the deleteTaskMutation and the dialog state management
  const confirmDelete = useCallback(() => {
      if (taskToDelete) {
          deleteTaskMutation.mutate(taskToDelete.id, {
              // Let the hook handle toast/invalidation
              // Use onSuccess/onError here primarily for local state changes (closing dialog)
              onSuccess: () => {
                  // The hook's setIsDeleteDialogOpen setter handles clearing taskToDelete
                  setIsDeleteDialogOpen(false);
              },
              onError: () => {
                  // Also ensure dialog closes on error
                  setIsDeleteDialogOpen(false);
              }
          });
      }
  }, [taskToDelete, deleteTaskMutation, setIsDeleteDialogOpen]);
  // Dependencies updated

  // --- REMOVED: useCallback definitions for handleAddTaskClick, handleTaskClick, handleDeleteTrigger ---


  // --- **** ADDED DEBUG LOGGING **** ---
  React.useEffect(() => {
    console.log('ProjectTasksTab State:', {
      projectId,
      isLoading,
      isError,
      error: error ? (error instanceof Error ? error.message : String(error)) : null,
      tasksStatus,
      isFetchingTasks,
      isErrorTasks,
      errorTasks: errorTasks ? (errorTasks instanceof Error ? errorTasks.message : String(errorTasks)) : null,
      tasksCount: tasks?.length,
      depsStatus,
      isFetchingDeps,
      isErrorDeps,
      errorDeps: errorDeps ? (errorDeps instanceof Error ? errorDeps.message : String(errorDeps)) : null,
      depsCount: dependencies?.length,
      formattedGanttTasksCount: formattedGanttTasks?.length,
    });
  }, [
      projectId, isLoading, isError, error, tasksStatus, isFetchingTasks, isErrorTasks, errorTasks, tasks,
      depsStatus, isFetchingDeps, isErrorDeps, errorDeps, dependencies, formattedGanttTasks
  ]);
  // --- **** END DEBUG LOGGING **** ---


  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading && !(isFetchingTasks || isFetchingDeps)) { // Show skeleton only on initial load
      return ( /* Skeleton */
         <div className="space-y-4 p-4">
             <Skeleton className="h-8 w-1/4" />
             <Skeleton className="h-[500px] w-full" />
         </div>
       );
    }
    if (isError) {
      // Error message now includes status code and potentially server message thanks to queryClient changes
      const errorMessage = error instanceof Error ? error.message : "Could not load tasks or dependencies.";
      return ( /* Error Alert */
          <Alert variant="destructive" className="m-4">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Data</AlertTitle>
             <AlertDescription>
                {errorMessage}
             </AlertDescription>
           </Alert>
      );
     }
     // Keep checks for missing dates or empty tasks
     if (!formattedGanttTasks.length && tasks.length > 0 && !isLoading) {
         return ( /* Warning Alert for missing dates */
             <Alert className="m-4">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Tasks Cannot Be Displayed</AlertTitle>
                 <AlertDescription>
                     Some tasks are missing start or due dates required for the schedule view. Please edit the tasks to add dates.
                 </AlertDescription>
             </Alert>
          );
     }
     if (tasks.length === 0 && !isLoading) {
        return ( /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg mt-4">
                 <div className="rounded-full bg-muted p-4 mb-4"><ClipboardList className="h-8 w-8 text-muted-foreground" /></div>
                 <h3 className="text-lg font-semibold mb-1">No Tasks Created Yet</h3>
                 <p className="text-muted-foreground mb-4">Add the first task for this project's schedule.</p>
                 {/* --- MODIFIED: Use handler from hook --- */}
                 <Button size="sm" onClick={handleAddTaskClick} className="gap-1"><PlusCircle className="h-4 w-4" />Add First Task</Button>
                 {/* --- END MODIFIED --- */}
             </div>
         );
     }

    // Check pending status for mutations that block Gantt interaction
    const isMutatingGantt = updateTaskDateMutation.isPending ||
                           updateTaskProgressMutation.isPending ||
                           createDependencyMutation.isPending ||
                           deleteDependencyMutation.isPending;
    return (
        <div className="h-[600px] w-full overflow-auto border rounded-md bg-background relative">
            {isMutatingGantt && ( /* Loading overlay */
                 <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                     <Loader2 className="h-6 w-6 animate-spin text-primary" />
                     <span className="ml-2">Saving changes...</span>
                 </div>
            )}
            {/* Render Gantt only if there are tasks to display */}
            {formattedGanttTasks.length > 0 && (
              <Gantt
                  tasks={formattedGanttTasks}
                  viewMode={ViewMode.Week}
                  // --- MODIFIED: Use handlers from hooks ---
                  onClick={handleTaskClick} // From useTaskDialogs
                  onDateChange={handleDateChange} // From useGanttInteractions
                  onProgressChange={handleProgressChange} // From useGanttInteractions
                  onRelationChange={handleDependencyLink} // From useGanttInteractions
                  // --- END MODIFIED ---
                  listCellWidth={"180px"}
                  columnWidth={65}
                  rowHeight={40}
                  ganttHeight={580}
                  locale="en-US"
                  readonly={isMutatingGantt}
              />
            )}
             <div className="p-2 text-xs text-muted-foreground border-t">
                 Note: Edit tasks by clicking on them. Change dates by dragging or resizing bars. Change progress using the handle inside bars. Link tasks by dragging from one task circle to another.
             </div>
        </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Project Tasks & Schedule</CardTitle>
          <CardDescription>Visualize tasks, update dates (drag/resize) and progress (drag handle).</CardDescription>
        </div>
        {/* --- MODIFIED: Use handler from hook --- */}
        <Button size="sm" onClick={handleAddTaskClick} className="gap-1" disabled={isLoading && !tasks?.length}> {/* Disable button during initial load */}
            <PlusCircle className="h-4 w-4" /> Add Task
        </Button>
        {/* --- END MODIFIED --- */}
      </CardHeader>
      <CardContent>
         {renderContent()}
      </CardContent>

      {/* --- MODIFIED: Use state and setters from hook --- */}
      {/* Assuming CreateTaskDialog and EditTaskDialog components exist */}
       <CreateTaskDialog
         isOpen={isCreateDialogOpen}
         setIsOpen={setIsCreateDialogOpen} // Pass setter from hook
         projectId={projectId}
         onSubmit={(values) => createTaskMutation.mutate(values, {
             onSuccess: () => setIsCreateDialogOpen(false) // Close dialog
         })}
         isPending={createTaskMutation.isPending}
       />
       <EditTaskDialog
         isOpen={isEditDialogOpen}
         setIsOpen={setIsEditDialogOpen} // Pass setter from hook
         taskToEdit={taskToEdit} // Pass selected task from hook state
         projectId={projectId}
         onDeleteRequest={handleDeleteTrigger} // Pass delete trigger handler from hook
       />
       <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen} // Pass controlled setter from hook
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the task <span className="font-medium">"{taskToDelete?.title}"</span> and any associated dependencies. {/* Use taskToDelete from hook state */}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                     {/* Cancel still uses the setter from the hook implicitly via onOpenChange */}
                     <AlertDialogCancel disabled={deleteTaskMutation.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirmDelete} // Use confirmDelete defined above
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteTaskMutation.isPending}
                    >
                         {deleteTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Yes, delete task
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      {/* --- END MODIFIED --- */}
    </Card>
  );
}