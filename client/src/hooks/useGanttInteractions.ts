// client/src/hooks/useGanttInteractions.ts
import { useCallback } from 'react';
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Task as GanttTask } from "wx-react-gantt"; // Type for Gantt callback arguments
// Assuming UseProjectTaskMutationsResult structure is available or import specific mutation types
// If UseProjectTaskMutationsResult isn't exported, import mutation types directly:
// import { UseMutationResult } from '@tanstack/react-query';
// import { Task, InsertTask } from "@shared/schema";
// type UpdateTaskDatePayload = ... etc

// Define the types for the mutations this hook depends on
// (Alternatively, import UseProjectTaskMutationsResult if exported)
interface GanttInteractionMutations {
    updateTaskDateMutation: { mutate: (payload: { taskId: number; startDate: Date; dueDate: Date }) => void };
    updateTaskProgressMutation: { mutate: (payload: { taskId: number; progress: number }) => void };
    createDependencyMutation: { mutate: (payload: { predecessorId: number; successorId: number; type?: string }) => void };
    deleteDependencyMutation: { mutate: (dependencyId: number) => void };
}

interface UseGanttInteractionsProps extends GanttInteractionMutations {
    tasksQueryKey: QueryKey; // For cache invalidation on date change errors
}

interface UseGanttInteractionsResult {
    handleDateChange: (ganttTask: GanttTask, newStartDate: Date, newEndDate: Date) => void;
    handleProgressChange: (ganttTask: GanttTask, progress: number) => void;
    handleDependencyLink: (fromTaskIdStr: string, toTaskIdStr: string) => void;
    handleDependencyUnlink: (dependencyId: number) => void; // Assuming ID is available somehow
}

export function useGanttInteractions({
    updateTaskDateMutation,
    updateTaskProgressMutation,
    createDependencyMutation,
    deleteDependencyMutation,
    tasksQueryKey,
}: UseGanttInteractionsProps): UseGanttInteractionsResult {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const handleDateChange = useCallback((ganttTask: GanttTask, newStartDate: Date, newEndDate: Date) => {
        console.log(`Gantt Date Change: Task ID ${ganttTask.id}, Start: ${newStartDate}, End: ${newEndDate}`);
        const taskId = parseInt(ganttTask.id);
        if (isNaN(taskId) || newEndDate < newStartDate) {
            toast({ title: "Invalid Dates", description: "Invalid task ID or end date before start date.", variant: "warning" });
            // Invalidate query to revert optimistic updates or visual state if needed
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            return;
        }
        updateTaskDateMutation.mutate({ taskId, startDate: newStartDate, dueDate: newEndDate });
    }, [updateTaskDateMutation, queryClient, tasksQueryKey, toast]);

    const handleProgressChange = useCallback((ganttTask: GanttTask, progress: number) => {
        console.log(`Gantt Progress Change: Task ID ${ganttTask.id}, Progress: ${progress}`);
        const taskId = parseInt(ganttTask.id);
        if (isNaN(taskId)) {
            toast({ title: "Error", description: "Invalid task ID encountered.", variant: "destructive" });
            return;
        }
        // Ensure progress is within bounds
        const validProgress = Math.max(0, Math.min(100, Math.round(progress)));
        updateTaskProgressMutation.mutate({ taskId, progress: validProgress });
    }, [updateTaskProgressMutation, toast]);

    const handleDependencyLink = useCallback((fromTaskIdStr: string, toTaskIdStr: string) => {
        console.log(`Attempting Link: from task ${fromTaskIdStr} to ${toTaskIdStr}`);
        const predecessorId = parseInt(fromTaskIdStr);
        const successorId = parseInt(toTaskIdStr);
        if (!isNaN(predecessorId) && !isNaN(successorId)) {
            // Basic check to prevent self-linking (if needed)
            if (predecessorId === successorId) {
                toast({ title: "Invalid Link", description: "Cannot link a task to itself.", variant: "warning" });
                return;
            }
            // Assumes 'FS' type by default, backend handles it if type isn't passed
            createDependencyMutation.mutate({ predecessorId, successorId });
        } else {
             toast({ title: "Error", description: "Invalid task IDs for dependency.", variant: "destructive" });
        }
    }, [createDependencyMutation, toast]);

    // This handler needs a way to get the dependencyId.
    // The Gantt chart might not provide this directly on unlink interaction.
    // It might need to be triggered from another UI element (e.g., an "X" button on the link).
    // For now, we include it assuming the ID can be obtained.
    const handleDependencyUnlink = useCallback((dependencyId: number) => {
        console.log(`Attempting Unlink: dependency ID ${dependencyId}`);
        deleteDependencyMutation.mutate(dependencyId);
    }, [deleteDependencyMutation]);

    return {
        handleDateChange,
        handleProgressChange,
        handleDependencyLink,
        handleDependencyUnlink,
    };
}