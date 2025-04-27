import React, { useState, useMemo, useCallback } from 'react'; // Added useCallback
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Task, InsertTask } from "@shared/schema"; // Import Task and InsertTask types
import { getQueryFn, apiRequest } from "@/lib/queryClient"; // Import query helpers
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // For error state
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Import Alert Dialog for delete confirmation
import { Loader2, PlusCircle, ClipboardList, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast"; // Assuming useToast is set up
import { CreateTaskDialog } from "./CreateTaskDialog"; // Import the Create dialog
import { EditTaskDialog } from "./EditTaskDialog"; // Import the Edit dialog

// Import the Gantt library and its CSS
// Note: 'Task' alias from Gantt conflicts with schema Task, be mindful or rename schema import
import { Gantt, Task as GanttTask, EventOption } from "wx-react-gantt"; // Alias Gantt's Task, import EventOption
import "wx-react-gantt/dist/gantt.css"; // Import its CSS

// Define ViewMode constants since they're not exported from the library
const ViewMode = {
  Day: "Day",
  Week: "Week",
  Month: "Month"
};

// Define payload for task date update mutation
type UpdateTaskDatePayload = {
    taskId: number;
    startDate: Date;
    dueDate: Date;
};

interface ProjectTasksTabProps {
  projectId: number;
}

// Helper to format tasks for the Gantt library (handles potentially null dates)
const formatTasksForGantt = (tasks: Task[]): GanttTask[] => {
  return tasks.map(task => {
    let progress = 0;
    if (task.status === 'done') {
      progress = 100;
    } else if (task.status === 'in_progress') {
      // TODO: Consider calculating progress based on actual vs estimated hours if available
      progress = 50; // Placeholder for in-progress
    } // 'todo', 'blocked', 'cancelled' remain 0

    const type: "task" | "milestone" | "project" = "task"; // Could enhance if task schema supports type

    // Handle potentially null dates: Fallback needed, but might skew visualization.
    // Gantt libraries usually *require* valid start/end dates.
    let startDate: Date;
    let endDate: Date;

    if (task.startDate) {
        startDate = new Date(task.startDate);
    } else {
        // Fallback: Use creation date or today? Requires careful consideration.
        // Forcing a date might be visually misleading. Maybe filter out tasks without dates?
        console.warn(`Task ${task.id} ('${task.title}') missing start date for Gantt.`);
        startDate = new Date(); // Using 'now' as a shaky fallback
    }

    if (task.dueDate) {
        endDate = new Date(task.dueDate);
    } else {
        // Fallback: Default duration (e.g., 1 day) if no due date?
        console.warn(`Task ${task.id} ('${task.title}') missing due date for Gantt.`);
        endDate = new Date(startDate.getTime() + 86400000); // 1 day after start as fallback
    }

    // Ensure end date is not before start date
    if (endDate < startDate) {
        console.warn(`Task ${task.id} ('${task.title}') has due date before start date. Adjusting end date for Gantt.`);
        endDate = new Date(startDate.getTime() + 86400000); // Adjust to 1 day duration minimum
    }

    return {
      id: task.id.toString(), // Gantt library usually expects string IDs
      start: startDate,
      end: endDate,
      text: task.title, // Use 'text' for wx-react-gantt task name display
      progress: progress,
      type: type,
      // dependencies: task.dependencies?.map(dep => dep.predecessorId.toString()) || [], // Map dependencies if fetched & available
      // project: projectId.toString(), // Associate with a project ID if library supports it
      // Add custom data if needed and library supports it
      // _original: task, // Keep reference to original task data if useful
    };
  }).filter(gt => gt.start && gt.end); // Ensure tasks have valid dates after formatting/fallbacks
};


export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch tasks for the project
  const tasksQueryKey = [`/api/projects/${projectId}/tasks`];
  const {
    data: tasks = [],
    isLoading,
    error,
    isError,
  } = useQuery<Task[]>({
    queryKey: tasksQueryKey,
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!projectId, // Ensure projectId is valid
  });

  // Memoize the formatted tasks for the Gantt chart
  const formattedGanttTasks = useMemo(() => formatTasksForGantt(tasks), [tasks]);

  // --- Create Task Mutation ---
  const createTaskMutation = useMutation({
    mutationFn: (newTaskData: InsertTask) => {
       // API expects data without projectId in body for this route
      const { projectId: _pid, ...restData } = newTaskData;
      // Ensure dates are ISO strings if needed by backend API (apiRequest should handle Date objects)
      return apiRequest<Task>('POST', `/api/projects/${projectId}/tasks`, restData);
    },
    onSuccess: (newTask) => {
      toast({ title: "Success", description: "Task created successfully." });
      // Update cache immediately instead of just invalidating
      queryClient.setQueryData<Task[]>(tasksQueryKey, (oldTasks = []) => [...oldTasks, newTask]);
      setIsCreateDialogOpen(false);
    },
    onError: (err) => {
       toast({ title: "Error Creating Task", description: err instanceof Error ? err.message : "An unknown error occurred.", variant: "destructive" });
    },
  });

  // --- Delete Task Mutation ---
   const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => {
      return apiRequest('DELETE', `/api/projects/${projectId}/tasks/${taskId}`);
    },
    onSuccess: (_, taskId) => {
      toast({ title: "Success", description: `Task #${taskId} deleted.` });
      // Optimistic update or invalidation
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      // queryClient.setQueryData<Task[]>(tasksQueryKey, (oldTasks = []) =>
      //    oldTasks.filter(task => task.id !== taskId)
      // );
      setIsDeleteDialogOpen(false); // Close confirmation dialog
      setTaskToDelete(null); // Clear the task targeted for deletion
    },
     onError: (err, taskId) => {
      console.error(`Error deleting task ${taskId}:`, err);
      toast({
        title: "Error Deleting Task",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
    },
  });

  // --- **NEW**: Mutation for Updating Task Dates from Gantt ---
  const updateTaskDateMutation = useMutation({
      mutationFn: ({ taskId, startDate, dueDate }: UpdateTaskDatePayload) => {
          const updateData: Partial<InsertTask> = {
              startDate: startDate, // Pass Date objects directly if apiRequest handles them
              dueDate: dueDate,
              // Convert to ISO string if backend expects string:
              // startDate: startDate.toISOString(),
              // dueDate: dueDate.toISOString(),
          };
          return apiRequest<Task>('PUT', `/api/projects/${projectId}/tasks/${taskId}`, updateData);
      },
      onSuccess: (updatedTask) => {
          toast({ title: "Task Updated", description: `Dates updated for task "${updatedTask.title}".` });
          // Update the specific task in the query cache for a smoother UX
          queryClient.setQueryData<Task[]>(tasksQueryKey, (oldTasks = []) =>
              oldTasks.map(task => task.id === updatedTask.id ? updatedTask : task)
          );
          // Optionally invalidate the specific task query if you have one
          // queryClient.invalidateQueries({ queryKey: [...tasksQueryKey, updatedTask.id] });
      },
      onError: (err, variables) => {
          console.error(`Error updating dates for task ${variables.taskId}:`, err);
          toast({
              title: "Error Updating Task Dates",
              description: err instanceof Error ? err.message : "Could not save date changes.",
              variant: "destructive",
          });
          // Invalidate to refetch and revert optimistic changes if any were made
          queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      },
  });

  // --- Handlers ---
  const handleAddTaskClick = () => {
    setIsCreateDialogOpen(true);
  };

  // Handler for clicking a task bar in the Gantt chart
  const handleTaskClick = useCallback((ganttTask: GanttTask) => {
    console.log("Gantt Task Clicked:", ganttTask);
    // Find the original Task data based on the ID from the Gantt task
    const originalTask = tasks.find(t => t.id.toString() === ganttTask.id);
    if (originalTask) {
      setTaskToEdit(originalTask);
      setIsEditDialogOpen(true);
    } else {
      console.warn(`Original task data not found for Gantt task ID: ${ganttTask.id}`);
      toast({ title: "Error", description: "Could not find task details.", variant: "destructive" });
    }
  }, [tasks]); // Dependency: tasks array

  // Handler to initiate deletion process (can be triggered from Edit dialog or elsewhere)
  const handleDeleteTrigger = useCallback((task: Task) => {
      setTaskToDelete(task);
      setIsDeleteDialogOpen(true);
  }, []); // No dependencies needed

  // Handler for confirming deletion
  const confirmDelete = useCallback(() => {
      if (taskToDelete) {
          deleteTaskMutation.mutate(taskToDelete.id);
      }
  }, [taskToDelete, deleteTaskMutation]); // Dependencies

  // --- **NEW**: Handler for Gantt Date Changes (Drag/Resize) ---
  const handleDateChange = useCallback((ganttTask: GanttTask, newStartDate: Date, newEndDate: Date) => {
      console.log(`Gantt Date Change: Task ID ${ganttTask.id}, Start: ${newStartDate}, End: ${newEndDate}`);

      const taskId = parseInt(ganttTask.id); // Convert string ID back to number
      if (isNaN(taskId)) {
          console.error("Invalid task ID from Gantt:", ganttTask.id);
          toast({ title: "Error", description: "Invalid task ID encountered.", variant: "destructive" });
          return;
      }

      // Optional: Add validation if needed (e.g., prevent end date being before start date)
      if (newEndDate < newStartDate) {
          console.warn("End date cannot be before start date. Reverting change.");
          toast({ title: "Invalid Dates", description: "End date cannot be before start date.", variant: "warning" });
          // Optionally force a refetch to reset the Gantt view
          queryClient.invalidateQueries({ queryKey: tasksQueryKey });
          return;
      }

      // Call the mutation to update the task dates
      updateTaskDateMutation.mutate({
          taskId: taskId,
          startDate: newStartDate,
          dueDate: newEndDate,
      });

  }, [updateTaskDateMutation, queryClient, tasksQueryKey]); // Dependencies


  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-[500px] w-full" /> {/* Placeholder for Gantt chart */}
        </div>
      );
    }

    if (isError || error) {
      return (
         <Alert variant="destructive" className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Tasks</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "An unknown error occurred."}
            </AlertDescription>
          </Alert>
      );
    }

     // Filter tasks without valid dates before checking length for empty state
     const displayableTasks = formattedGanttTasks.length > 0;

     if (!displayableTasks && tasks.length > 0) {
         return (
             <Alert variant="warning" className="m-4">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Tasks Cannot Be Displayed</AlertTitle>
                 <AlertDescription>
                     Some tasks are missing start or due dates required for the schedule view. Please edit the tasks to add dates.
                 </AlertDescription>
             </Alert>
         );
     }


     if (tasks.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg mt-4">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <ClipboardList className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Tasks Created Yet</h3>
                <p className="text-muted-foreground mb-4">Add the first task for this project's schedule.</p>
                 <Button size="sm" onClick={handleAddTaskClick} className="gap-1">
                   <PlusCircle className="h-4 w-4" />
                   Add First Task
                </Button>
            </div>
        );
     }

    // --- Render Gantt Chart ---
    return (
        // Container needs defined height for Gantt chart to render correctly
        <div className="h-[600px] w-full overflow-auto border rounded-md bg-background relative">
            {updateTaskDateMutation.isPending && (
                 <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2">Saving date changes...</span>
                 </div>
            )}
            <Gantt
                tasks={formattedGanttTasks}
                viewMode={ViewMode.Week} // Default view mode (Day, Week, Month)
                // --- ADDED: Event handlers ---
                onClick={handleTaskClick}
                onDateChange={handleDateChange} // Handle drag/resize updates
                // onProgressChange={(task, progress) => console.log('Progress Change:', task, progress)} // Future: Handle progress updates
                // onViewChange={(viewMode) => console.log('View Mode Change:', viewMode)}
                // --- Customize appearance ---
                listCellWidth={"180px"} // Adjust width of the task list column
                columnWidth={65} // Adjust width of timeline columns (pixels for day width in week/day view)
                rowHeight={40} // Adjust task row height
                ganttHeight={580} // Adjust internal chart height (leave space for headers)
                locale="en-US" // Set locale if needed
                // Optional: Disable interactions while mutation is pending
                barProgressColor={updateTaskDateMutation.isPending ? '#cccccc' : undefined} // Example: Gray out progress during update
                barProgressSelectedColor={updateTaskDateMutation.isPending ? '#cccccc' : undefined}
                // Consider disabling drag/resize if needed, though optimistic updates are usually preferred
                // readonly={updateTaskDateMutation.isPending} // Check if library supports readonly prop
            />
        </div>
    );
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Project Tasks & Schedule</CardTitle>
          <CardDescription>Visualize and manage project tasks. Drag or resize bars to adjust dates.</CardDescription>
        </div>
        <Button size="sm" onClick={handleAddTaskClick} className="gap-1" disabled={isLoading}>
           <PlusCircle className="h-4 w-4" />
           Add Task
        </Button>
      </CardHeader>
      <CardContent>
         {renderContent()}
      </CardContent>

      {/* Render the Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isCreateDialogOpen}
        setIsOpen={setIsCreateDialogOpen}
        projectId={projectId}
        onSubmit={(values) => {
          createTaskMutation.mutate(values);
        }}
        isPending={createTaskMutation.isPending}
      />

       {/* Render the Edit Task Dialog */}
       <EditTaskDialog
         isOpen={isEditDialogOpen}
         setIsOpen={setIsEditDialogOpen}
         taskToEdit={taskToEdit}
         projectId={projectId}
         // --- Pass delete handler (optional, can be triggered from edit dialog) ---
         onDeleteRequest={handleDeleteTrigger} // Pass handler to trigger deletion process
       />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the task
                    <span className="font-medium"> "{taskToDelete?.title}"</span>.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={confirmDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteTaskMutation.isPending}
                >
                     {deleteTaskMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                    Yes, delete task
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </Card>
  );
}