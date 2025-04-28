// client/src/hooks/useProjectTaskMutations.ts
import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient"; // Assuming apiRequest handles response parsing/errors
import { useToast } from "@/hooks/use-toast";
import { Task, InsertTask } from "@shared/schema";

// Define payload types (can be shared or defined here if specific to these mutations)
type UpdateTaskDatePayload = { taskId: number; startDate: Date; dueDate: Date };
type UpdateTaskProgressPayload = { taskId: number; progress: number };
type CreateDependencyPayload = { predecessorId: number; successorId: number; type?: string };

// Define the structure of what the hook returns
interface UseProjectTaskMutationsResult {
    createTaskMutation: ReturnType<typeof useMutation<Task, Error, InsertTask>>;
    deleteTaskMutation: ReturnType<typeof useMutation<void, Error, number>>;
    updateTaskDateMutation: ReturnType<typeof useMutation<Task, Error, UpdateTaskDatePayload>>;
    updateTaskProgressMutation: ReturnType<typeof useMutation<Task, Error, UpdateTaskProgressPayload>>;
    createDependencyMutation: ReturnType<typeof useMutation<unknown, Error, CreateDependencyPayload>>; // Use unknown if response isn't used
    deleteDependencyMutation: ReturnType<typeof useMutation<void, Error, number>>;
}

export function useProjectTaskMutations(projectId: number): UseProjectTaskMutationsResult {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Define query keys used for invalidation
    const tasksQueryKey: QueryKey = ['projects', projectId, 'tasks'];
    const dependenciesQueryKey: QueryKey = ['projects', projectId, 'tasks', 'dependencies'];

    // Create Task Mutation
    const createTaskMutation = useMutation<Task, Error, InsertTask>({
        mutationFn: (newTaskData: InsertTask) => {
            const updatedData = { ...newTaskData, projectId };
            // Assuming apiRequest returns the created Task object after parsing JSON
            return apiRequest('POST', `/api/projects/${projectId}/tasks`, updatedData);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Task created successfully." });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            // Note: Dialog closing is handled in the component where the mutation is called
        },
        onError: (err: Error) => {
            toast({ title: "Error Creating Task", description: err.message, variant: "destructive" });
        },
    });

    // Delete Task Mutation
    const deleteTaskMutation = useMutation<void, Error, number>({
        mutationFn: (taskId: number) => {
            return apiRequest('DELETE', `/api/projects/${projectId}/tasks/${taskId}`);
        },
        onSuccess: (_, taskId) => {
            toast({ title: "Success", description: `Task #${taskId} deleted.` });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            queryClient.invalidateQueries({ queryKey: dependenciesQueryKey });
            // Note: Dialog closing/state reset handled in the component
        },
        onError: (err: Error, taskId) => {
            console.error(`Error deleting task ${taskId}:`, err);
            toast({ title: "Error Deleting Task", description: err.message, variant: "destructive" });
            // Note: Dialog closing/state reset handled in the component
        },
    });

    // Update Task Dates Mutation
    const updateTaskDateMutation = useMutation<Task, Error, UpdateTaskDatePayload>({
        mutationFn: ({ taskId, startDate, dueDate }: UpdateTaskDatePayload) => {
            const updateData: Partial<InsertTask> = { startDate, dueDate };
            return apiRequest('PUT', `/api/projects/${projectId}/tasks/${taskId}`, updateData);
        },
        onSuccess: (updatedTask: Task) => {
            toast({ title: "Task Updated", description: `Dates updated for task "${updatedTask.title}".` });
            // Optimistic update in cache
            queryClient.setQueryData<Task[]>(tasksQueryKey, (oldTasks = []) =>
                oldTasks.map(task => task.id === updatedTask.id ? updatedTask : task)
            );
        },
        onError: (err: Error, variables) => {
            console.error(`Error updating dates for task ${variables.taskId}:`, err);
            toast({ title: "Error Updating Task Dates", description: err.message, variant: "destructive" });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey }); // Revert on error
        },
    });

    // Update Task Progress Mutation
    const updateTaskProgressMutation = useMutation<Task, Error, UpdateTaskProgressPayload>({
        mutationFn: ({ taskId, progress }: UpdateTaskProgressPayload) => {
            const updateData: Partial<InsertTask> = { progress };
            return apiRequest('PUT', `/api/projects/${projectId}/tasks/${taskId}`, updateData);
        },
        onSuccess: (updatedTask: Task) => {
            toast({ title: "Task Updated", description: `Progress updated for task "${updatedTask.title}".` });
            // Optimistic update in cache
            queryClient.setQueryData<Task[]>(tasksQueryKey, (oldTasks = []) =>
                oldTasks.map(task => task.id === updatedTask.id ? updatedTask : task)
            );
        },
        onError: (err: Error, variables) => {
            console.error(`Error updating progress for task ${variables.taskId}:`, err);
            toast({ title: "Error Updating Task Progress", description: err.message, variant: "destructive" });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey }); // Revert on error
        },
    });

    // Create Task Dependency Mutation
    const createDependencyMutation = useMutation<unknown, Error, CreateDependencyPayload>({
        mutationFn: ({ predecessorId, successorId, type = "FS" }: CreateDependencyPayload) => {
            console.log(`Create dependency from ${predecessorId} to ${successorId}`);
            return apiRequest(
                'POST',
                `/api/projects/${projectId}/tasks/${successorId}/dependencies`,
                { predecessorId, type }
            );
        },
        onSuccess: () => {
            toast({ title: "Dependency Added", description: "Task dependency created." });
            queryClient.invalidateQueries({ queryKey: dependenciesQueryKey });
        },
        onError: (err: Error) => {
            console.error("Error creating dependency:", err);
            toast({ title: "Error Creating Dependency", description: err.message, variant: "destructive" });
        },
    });

    // Delete Task Dependency Mutation
    const deleteDependencyMutation = useMutation<void, Error, number>({
        mutationFn: (dependencyId: number) => {
            console.log(`Delete dependency ID ${dependencyId}`);
            return apiRequest(
                'DELETE',
                `/api/projects/${projectId}/tasks/dependencies/${dependencyId}`
            );
        },
        onSuccess: () => {
            toast({ title: "Dependency Removed", description: "Task dependency deleted." });
            queryClient.invalidateQueries({ queryKey: dependenciesQueryKey });
        },
        onError: (err: Error) => {
            console.error("Error deleting dependency:", err);
            toast({ title: "Error Deleting Dependency", description: err.message, variant: "destructive" });
        },
    });

    return {
        createTaskMutation,
        deleteTaskMutation,
        updateTaskDateMutation,
        updateTaskProgressMutation,
        createDependencyMutation,
        deleteDependencyMutation,
    };
}