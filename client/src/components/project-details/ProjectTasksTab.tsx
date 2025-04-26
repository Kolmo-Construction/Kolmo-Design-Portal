import React, { useState, useMemo } from 'react';
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
import { Gantt, Task as GanttTask, EventOption } from "wx-react-gantt"; // Alias Task, import EventOption
import "wx-react-gantt/dist/gantt.css"; // Import its CSS

interface ProjectTasksTabProps {
  projectId: number;
}

// Helper to format tasks for the Gantt library
const formatTasksForGantt = (tasks: Task[]): GanttTask[] => {
  return tasks.map(task => {
    // Determine progress based on status
    let progress = 0;
    if (task.status === 'done') {
      progress = 100;
    } else if (task.status === 'in_progress') {
      progress = 50; // Example: In progress is 50%
    } else if (task.status === 'blocked' || task.status === 'cancelled') {
        progress = 0; // Or represent differently if library allows
    }

    // Basic task type
    const type: "task" | "milestone" | "project" = "task"; // Can enhance later

    // Handle potentially null dates gracefully
    const startDate = task.startDate ? new Date(task.startDate) : new Date(); // Default to now if no start date? Risky.
    // If no due date, make it end shortly after start for visualization
    const endDate = task.dueDate ? new Date(task.dueDate) : new Date(startDate.getTime() + 86400000 * 2); // Default 2 days duration

    // Ensure end date is not before start date for Gantt library
    if (endDate < startDate) {
        console.warn(`Task ${task.id} has due date before start date. Adjusting for Gantt.`);
        // Adjust end date to be same as start date or slightly after
        endDate.setTime(startDate.getTime() + 86400000); // Example: 1 day duration minimum
    }


    return {
      id: task.id.toString(), // Gantt library usually expects string IDs
      start: startDate,
      end: endDate,
      text: task.title, // Use 'text' for wx-react-gantt task name display
      progress: progress,
      type: type,
      // dependencies: task.dependencies?.map(dep => dep.predecessorId.toString()) || [], // Map dependencies if fetched
      // Add other relevant fields supported by the library if needed
      // Example: Assignee info could be added to display or tooltip if fetched
      // assignee: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned',
    };
  });
};


export function ProjectTasksTab({ projectId }: ProjectTasksTabProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // --- State for Edit Dialog ---
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // --- State for Delete Confirmation ---
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


  // Fetch tasks for the project
  const tasksQueryKey = [`/api/projects/${projectId}/tasks`];
  const {
    data: tasks = [],
    isLoading,
    error,
    isError,
  } = useQuery<Task[]>({ // Fetching the raw Task data
    queryKey: tasksQueryKey,
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Memoize the formatted tasks for the Gantt chart
  const formattedGanttTasks = useMemo(() => formatTasksForGantt(tasks), [tasks]);

  // --- Create Task Mutation ---
  const createTaskMutation = useMutation({
    mutationFn: (newTaskData: InsertTask) => {
      const { projectId: _pid, ...restData } = newTaskData; // Remove projectId if present
      return apiRequest('POST', `/api/projects/${projectId}/tasks`, restData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task created successfully." });
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
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

  // --- Handlers ---
  const handleAddTaskClick = () => {
    setIsCreateDialogOpen(true);
  };

  // Handler for clicking a task in the Gantt chart
  const handleTaskClick = (ganttTask: GanttTask) => {
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
  };

  // Handler to initiate deletion process
  const handleDeleteClick = (task: Task) => {
      setTaskToDelete(task);
      setIsDeleteDialogOpen(true);
  };

  // Handler for confirming deletion
  const confirmDelete = () => {
      if (taskToDelete) {
          deleteTaskMutation.mutate(taskToDelete.id);
      }
  };

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
        <div className="h-[600px] w-full overflow-auto border rounded-md bg-background"> {/* Ensure container has height & background */}
            <Gantt
                tasks={formattedGanttTasks}
                viewMode="Week" // Default view mode (Day, Week, Month)
                // --- ADDED: Event handler for task clicks ---
                onClick={handleTaskClick}
                // --- You might need other handlers like ---
                // onDateChange={(task, start, end) => console.log('Date Change:', task, start, end)} // For drag/resize updates
                // onProgressChange={(task, progress) => console.log('Progress Change:', task, progress)}
                // onViewChange={(viewMode) => console.log('View Mode Change:', viewMode)}
                // --- Customize appearance ---
                listCellWidth={"150px"} // Adjust width of the task list column if needed
                columnWidth={60} // Adjust width of timeline columns
                rowHeight={40} // Adjust task row height
                ganttHeight={550} // Adjust overall chart height if needed
                // locale="en-US" // Set locale if needed
            />
        </div>
    );
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Project Tasks & Schedule</CardTitle>
          <CardDescription>Manage and visualize project tasks and dependencies.</CardDescription>
        </div>
        <Button size="sm" onClick={handleAddTaskClick} className="gap-1">
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
         // --- Pass delete handler (optional) ---
         // onDelete={(taskId) => handleDeleteClick(tasks.find(t => t.id === taskId)!)}
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