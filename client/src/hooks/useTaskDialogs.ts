// client/src/hooks/useTaskDialogs.ts
import { useState, useCallback } from 'react';
import { Task } from "@shared/schema";
import { Task as GanttTask } from "wx-react-gantt"; // Type for Gantt callback arguments
import { useToast } from "@/hooks/use-toast"; // Needed for handleTaskClick error

// Define the shape of the state and handlers returned by the hook
interface UseTaskDialogsResult {
    isCreateDialogOpen: boolean;
    setIsCreateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isEditDialogOpen: boolean;
    setIsEditDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isDeleteDialogOpen: boolean;
    setIsDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    taskToEdit: Task | null;
    taskToDelete: Task | null;
    handleAddTaskClick: () => void;
    handleTaskClick: (ganttTask: GanttTask) => void; // Opens Edit Dialog
    handleDeleteTrigger: (task: Task) => void; // Opens Delete Confirmation
    // Optional: Add a function to close all dialogs if needed elsewhere
    // closeAllDialogs: () => void;
}

/**
 * Custom hook to manage the state and handlers for task-related dialogs
 * (Create, Edit, Delete Confirmation).
 * @param tasks - The array of tasks, needed to find the original task on click.
 */
export function useTaskDialogs(tasks: Task[]): UseTaskDialogsResult {
    const { toast } = useToast();

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

    // Handler to open the Create Task dialog
    const handleAddTaskClick = useCallback(() => {
        setIsCreateDialogOpen(true);
    }, []); // No dependencies

    // Handler to open the Edit Task dialog when a Gantt task is clicked
    const handleTaskClick = useCallback((ganttTask: GanttTask) => {
        console.log("Gantt Task Clicked (hook):", ganttTask);
        // Find the original task data based on the Gantt task ID
        const originalTask = tasks.find(t => t.id.toString() === ganttTask.id);
        if (originalTask) {
            setTaskToEdit(originalTask);
            setIsEditDialogOpen(true);
        } else {
            // Handle case where the original task isn't found (should ideally not happen)
            toast({ title: "Error", description: "Could not find task details.", variant: "destructive" });
            setTaskToEdit(null); // Ensure state is cleared
            setIsEditDialogOpen(false);
        }
    }, [tasks, toast]); // Depends on the tasks array and toast

    // Handler to set the task to delete and open the confirmation dialog
    const handleDeleteTrigger = useCallback((task: Task) => {
        setTaskToDelete(task);
        setIsDeleteDialogOpen(true);
    }, []); // No dependencies

    // Optional: Function to explicitly close all dialogs and clear states
    // const closeAllDialogs = useCallback(() => {
    //     setIsCreateDialogOpen(false);
    //     setIsEditDialogOpen(false);
    //     setIsDeleteDialogOpen(false);
    //     setTaskToEdit(null);
    //     setTaskToDelete(null);
    // }, []);

    // Reset taskToDelete when delete dialog closes (avoids stale state)
    // This can also be handled within the component using the setter if preferred
    const controlledSetIsDeleteDialogOpen = useCallback((open: boolean) => {
        setIsDeleteDialogOpen(open);
        if (!open) {
            setTaskToDelete(null); // Clear selection when dialog closes
        }
    }, []);


    return {
        isCreateDialogOpen,
        setIsCreateDialogOpen,
        isEditDialogOpen,
        setIsEditDialogOpen,
        // Use the controlled setter for the delete dialog
        isDeleteDialogOpen,
        setIsDeleteDialogOpen: controlledSetIsDeleteDialogOpen,
        taskToEdit,
        taskToDelete,
        handleAddTaskClick,
        handleTaskClick,
        handleDeleteTrigger,
        // closeAllDialogs, // Uncomment if needed
    };
}