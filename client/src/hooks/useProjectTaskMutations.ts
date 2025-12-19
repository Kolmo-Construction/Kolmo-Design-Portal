// client/src/hooks/useProjectTaskMutations.ts
import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient"; // Assuming apiRequest handles response parsing/errors
import { useToast } from "@/hooks/use-toast";
import { Task, InsertTask } from "@shared/schema";
import { Task as GanttTask } from 'gantt-task-react';

// Define payload types (can be shared or defined here if specific to these mutations)
type UpdateTaskDatePayload = { taskId: number; startDate: Date; dueDate: Date };
type UpdateTaskProgressPayload = { taskId: number; progress: number };
type CreateDependencyPayload = { predecessorId: number; successorId: number; type?: string };
type ImportTasksPayload = { projectId: number; tasks: GanttTask[] };
type ConvertToMilestonePayload = { taskId: number };
type CompleteAndBillPayload = { taskId: number; actualHours?: number };
type GenerateInvoicePayload = { milestoneId: number };

// Define the structure of what the hook returns
interface UseProjectTaskMutationsResult {
    createTaskMutation: ReturnType<typeof useMutation<Task, Error, InsertTask>>;
    deleteTaskMutation: ReturnType<typeof useMutation<void, Error, number>>;
    updateTaskDateMutation: ReturnType<typeof useMutation<Task, Error, UpdateTaskDatePayload>>;
    updateTaskProgressMutation: ReturnType<typeof useMutation<Task, Error, UpdateTaskProgressPayload>>;
    createDependencyMutation: ReturnType<typeof useMutation<unknown, Error, CreateDependencyPayload>>; // Use unknown if response isn't used
    deleteDependencyMutation: ReturnType<typeof useMutation<void, Error, number>>;
    publishTasksMutation: ReturnType<typeof useMutation<unknown, Error, void>>;
    unpublishTasksMutation: ReturnType<typeof useMutation<unknown, Error, void>>;
    importTasksMutation: ReturnType<typeof useMutation<unknown, Error, ImportTasksPayload>>;
    convertToMilestoneMutation: ReturnType<typeof useMutation<unknown, Error, ConvertToMilestonePayload>>;
    completeAndBillMutation: ReturnType<typeof useMutation<unknown, Error, CompleteAndBillPayload>>;
    generateInvoiceMutation: ReturnType<typeof useMutation<unknown, Error, GenerateInvoicePayload>>;
}

export function useProjectTaskMutations(projectId: number): UseProjectTaskMutationsResult {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Define query keys used for invalidation - using full API URLs
    const tasksQueryKey: QueryKey = [`/api/projects/${projectId}/tasks`];
    const dependenciesQueryKey: QueryKey = [`/api/projects/${projectId}/tasks/dependencies`];

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
            // Invalidate project query to refresh overall project progress
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
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

    // Publish Project Tasks Mutation
    const publishTasksMutation = useMutation<unknown, Error, void>({
        mutationFn: () => {
            return apiRequest(
                'POST',
                `/api/projects/${projectId}/tasks/publish`
            );
        },
        onSuccess: () => {
            toast({ title: "Tasks Published", description: "All tasks are now visible to clients." });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
        },
        onError: (err: Error) => {
            console.error("Error publishing tasks:", err);
            toast({ title: "Error Publishing Tasks", description: err.message, variant: "destructive" });
        },
    });

    // Unpublish Project Tasks Mutation
    const unpublishTasksMutation = useMutation<unknown, Error, void>({
        mutationFn: () => {
            return apiRequest(
                'POST',
                `/api/projects/${projectId}/tasks/unpublish`
            );
        },
        onSuccess: () => {
            toast({ title: "Tasks Unpublished", description: "Tasks are now hidden from clients." });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
        },
        onError: (err: Error) => {
            console.error("Error unpublishing tasks:", err);
            toast({ title: "Error Unpublishing Tasks", description: err.message, variant: "destructive" });
        },
    });

    // Import Tasks from JSON Mutation
    const importTasksMutation = useMutation<unknown, Error, ImportTasksPayload>({
        mutationFn: ({ projectId, tasks }: ImportTasksPayload) => {
            return apiRequest(
                'POST',
                `/api/projects/${projectId}/tasks/import`,
                { tasks }
            );
        },
        onSuccess: () => {
            toast({ title: "Tasks Imported", description: "Tasks have been successfully imported from JSON." });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            queryClient.invalidateQueries({ queryKey: dependenciesQueryKey });
        },
        onError: (err: Error) => {
            console.error("Error importing tasks:", err);
            toast({ title: "Error Importing Tasks", description: err.message, variant: "destructive" });
        },
    });

    // Convert Task to Milestone Mutation
    const convertToMilestoneMutation = useMutation<unknown, Error, ConvertToMilestonePayload>({
        mutationFn: ({ taskId }: ConvertToMilestonePayload) => {
            return apiRequest('POST', `/api/projects/${projectId}/tasks/${taskId}/convert-to-milestone`);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Task converted to billable milestone." });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            queryClient.invalidateQueries({ queryKey: [`/api/milestones`] });
        },
        onError: (err: Error) => {
            toast({ title: "Conversion Failed", description: err.message, variant: "destructive" });
        },
    });

    // Complete and Bill Task Mutation
    const completeAndBillMutation = useMutation<unknown, Error, CompleteAndBillPayload>({
        mutationFn: ({ taskId, actualHours }: CompleteAndBillPayload) => {
            return apiRequest('PATCH', `/api/projects/${projectId}/tasks/${taskId}/complete-and-bill`, { actualHours });
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Task completed and billed successfully." });
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            queryClient.invalidateQueries({ queryKey: [`/api/milestones`] });
        },
        onError: (err: Error) => {
            toast({ title: "Billing Failed", description: err.message, variant: "destructive" });
        },
    });

    // Generate Invoice Mutation
    const generateInvoiceMutation = useMutation<unknown, Error, GenerateInvoicePayload>({
        mutationFn: ({ milestoneId }: GenerateInvoicePayload) => {
            return apiRequest("POST", `/api/projects/${projectId}/milestones/${milestoneId}/bill`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tasksQueryKey });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] });
            toast({
                title: "Invoice Generated",
                description: "Invoice has been created successfully",
            });
        },
        onError: (err: Error) => {
            console.error('Failed to generate invoice:', err);
            toast({
                title: "Failed to Generate Invoice",
                description: err.message || "An error occurred",
                variant: "destructive",
            });
        },
    });

    return {
        createTaskMutation,
        deleteTaskMutation,
        updateTaskDateMutation,
        updateTaskProgressMutation,
        createDependencyMutation,
        deleteDependencyMutation,
        publishTasksMutation,
        unpublishTasksMutation,
        importTasksMutation,
        convertToMilestoneMutation,
        completeAndBillMutation,
        generateInvoiceMutation,
    };
}