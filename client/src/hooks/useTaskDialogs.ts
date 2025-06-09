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
        console.log("Available tasks for matching:", tasks.map(t => ({ id: t.id, title: t.title })));
        console.log("Looking for gantt task ID:", ganttTask.id, "type:", typeof ganttTask.id);
        
        // Try multiple ID matching strategies
        let originalTask = tasks.find(t => String(t.id) === String(ganttTask.id));
        
        if (!originalTask) {
            // Try parsing the gantt task ID as number
            const ganttIdAsNumber = parseInt(String(ganttTask.id), 10);
            if (!isNaN(ganttIdAsNumber)) {
                originalTask = tasks.find(t => t.id === ganttIdAsNumber);
            }
        }
        
        if (originalTask) {
            console.log("Found matching task:", originalTask);
            setTaskToEdit(originalTask);
            setIsEditDialogOpen(true);
        } else {
            console.error("Could not find task with ID:", ganttTask.id);
            console.error("Available task IDs:", tasks.map(t => ({ id: t.id, type: typeof t.id })));
            toast({ title: "Error", description: "Could not find task details.", variant: "destructive" });
            setTaskToEdit(null);
            setIsEditDialogOpen(false);
        }
    }, [tasks, toast]);

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