import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
// Import Task type and the insert schema (we'll use .partial() for updates)
import { Task, InsertTask, insertTaskSchema, User } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import mutation hooks
import { getQueryFn, apiRequest } from "@/lib/queryClient"; // Import query helpers
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save } from "lucide-react"; // Import Save icon
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast"; // Import toast

// Define the type for the update mutation payload
type UpdateTaskPayload = {
    taskId: number;
    taskData: Partial<InsertTask>; // Use Partial for updates
};

interface EditTaskDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  taskToEdit: Task | null; // Pass the task object to edit
  projectId: number; // Still need projectId for API endpoint and query invalidation
  onDeleteRequest?: (task: Task) => void; // Optional callback to request task deletion
}

// Use partial schema for updates, as not all fields might be sent
// Note: If your backend strictly requires certain fields even on update, adjust this schema
const editTaskFormSchema = insertTaskSchema.partial();
type EditTaskFormValues = Partial<InsertTask>; // Form values type

export function EditTaskDialog({
  isOpen,
  setIsOpen,
  taskToEdit,
  projectId,
  onDeleteRequest
}: EditTaskDialogProps) {
  const queryClient = useQueryClient();

  // Fetch potential assignees (same as Create dialog)
  const {
    data: assignees = [],
    isLoading: isLoadingAssignees
  } = useQuery<User[]>({
    // Assuming this endpoint returns users with role 'projectManager' or 'admin'
    queryKey: ["/api/project-managers"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen, // Only fetch when the dialog is open
  });

  // Setup react-hook-form with partial Zod validation for edits
  const form = useForm<EditTaskFormValues>({ // Use Partial<InsertTask> for form values
    resolver: zodResolver(editTaskFormSchema),
    defaultValues: { // Set defaults, will be overridden by useEffect
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      startDate: undefined,
      dueDate: undefined,
      estimatedHours: undefined,
      actualHours: undefined,
      isBillable: false,
      billingPercentage: "",
      billableAmount: "",
      billingType: "fixed",
      billingRate: "",
    },
  });

  // Effect to reset form and populate with task data when dialog opens or task changes
  useEffect(() => {
    if (isOpen && taskToEdit) {
      // Reset form with values from the taskToEdit prop
      form.reset({
        title: taskToEdit.title ?? "",
        description: taskToEdit.description ?? "",
        status: taskToEdit.status ?? "todo",
        priority: taskToEdit.priority ?? "medium",
        assigneeId: taskToEdit.assigneeId ?? null,
        // Ensure dates are Date objects for the form state if they exist
        startDate: taskToEdit.startDate ? new Date(taskToEdit.startDate) : undefined,
        dueDate: taskToEdit.dueDate ? new Date(taskToEdit.dueDate) : undefined,
        // Ensure numbers are handled correctly (convert from potential string/decimal)
        estimatedHours: taskToEdit.estimatedHours ? parseFloat(taskToEdit.estimatedHours.toString()) : undefined,
        actualHours: taskToEdit.actualHours ? parseFloat(taskToEdit.actualHours.toString()) : undefined,
        // Add billing fields
        isBillable: taskToEdit.isBillable ?? false,
        billingPercentage: taskToEdit.billingPercentage ? parseFloat(taskToEdit.billingPercentage.toString()) : undefined,
        billableAmount: taskToEdit.billableAmount ? parseFloat(taskToEdit.billableAmount.toString()) : undefined,
        billingType: taskToEdit.billingType ?? "fixed",
        billingRate: taskToEdit.billingRate ? parseFloat(taskToEdit.billingRate.toString()) : undefined,
      });
    } else if (!isOpen) {
        // Optionally reset to empty defaults when closing
        // form.reset({ title: "", ... });
    }
  }, [isOpen, taskToEdit, form]);


  // Helper function to safely format dates (same as Create dialog)
  const safeFormatDate = (value: any) => {
    if (!value) return "";
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) return "Invalid date";
      return formatDate(date, "PPP"); // Use imported formatDate
    } catch (err) {
      console.error("Date formatting error:", err);
      return "Date error";
    }
  };

  // Mutation hook for updating a task
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, taskData }: UpdateTaskPayload) => {
      // Remove projectId if present, as it shouldn't be updated via this route
      delete taskData.projectId;
      // Convert dates to ISO strings before sending if API expects strings
      const apiData = {
        ...taskData,
        startDate: taskData.startDate instanceof Date ? taskData.startDate.toISOString() : taskData.startDate,
        dueDate: taskData.dueDate instanceof Date ? taskData.dueDate.toISOString() : taskData.dueDate,
      };
      return apiRequest('PUT', `/api/projects/${projectId}/tasks/${taskId}`, apiData);
    },
    onSuccess: (_, variables) => { // variables contains { taskId, taskData }
      toast({ title: "Success", description: "Task updated successfully." });
      // Invalidate the specific task query and the list query
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`, variables.taskId] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      setIsOpen(false); // Close dialog on success
    },
    onError: (err) => {
      console.error("Error updating task:", err);
      toast({
        title: "Error Updating Task",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });


  // Handle form submission
  const handleFormSubmit = (values: EditTaskFormValues) => {
    if (!taskToEdit) return; // Should not happen if dialog is open correctly

    console.log("Submitting update:", values);
    // The mutationFn now handles formatting, just pass the form values
    updateTaskMutation.mutate({ taskId: taskToEdit.id, taskData: values });
  };
  
  // Handle delete request
  const handleDeleteClick = () => {
    if (taskToEdit && onDeleteRequest) {
      onDeleteRequest(taskToEdit);
      setIsOpen(false); // Close the dialog
    }
  };

  return (
    // Dialog setup remains the same
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          {/* Update Title */}
          <DialogTitle>Edit Task: {taskToEdit?.title ?? 'Loading...'}</DialogTitle>
          <DialogDescription>
            Modify the details for this task.
          </DialogDescription>
        </DialogHeader>

        {/* Form implementation - Structure is identical to CreateTaskDialog */}
        {/* Only render form if taskToEdit is available */}
        {taskToEdit ? (
            <Form {...form}>
            {/* Pass validated data to handleFormSubmit */}
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3">
                {/* Task Title */}
                <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Title*</FormLabel>
                    <FormControl>
                        <Input placeholder="Enter task title" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Task Description */}
                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="Enter task description (optional)"
                        className="min-h-[80px]"
                        {...field}
                        value={field.value ?? ''}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {/* Status and Priority in a grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Task Status */}
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Status*</FormLabel>
                        <Select
                        onValueChange={field.onChange}
                        // Use value prop for controlled component during edit
                        value={field.value ?? "todo"}
                        >
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select task status" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                {/* Task Priority */}
                <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select
                        onValueChange={field.onChange}
                        // Use value prop for controlled component during edit
                        value={field.value ?? "medium"}
                        >
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>

                {/* Assignee Field */}
                <FormField
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <Select
                        onValueChange={(value) => field.onChange(value === "unassigned" ? null : parseInt(value))}
                        value={field.value?.toString() ?? "unassigned"}
                        disabled={isLoadingAssignees}
                        >
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder={isLoadingAssignees ? "Loading users..." : "Select assignee (optional)"} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {assignees.map((assignee) => (
                            <SelectItem key={assignee.id} value={assignee.id.toString()}>
                                {assignee.firstName} {assignee.lastName} ({assignee.role})
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                {/* Dates in a grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date */}
                <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "pl-3 text-left font-normal h-10",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                {field.value
                                ? safeFormatDate(field.value)
                                : <span>Pick a date</span>
                                }
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date)}
                            initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                {/* Due Date */}
                <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Due Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "pl-3 text-left font-normal h-10",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                {field.value
                                ? safeFormatDate(field.value)
                                : <span>Pick a date</span>
                                }
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date)}
                            disabled={(date) =>
                                form.getValues("startDate") ? date < new Date(form.getValues("startDate")!) : false
                            }
                            initialFocus
                            />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>

                {/* Estimated Hours */}
                <FormField
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                        <Input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="Estimated hours (optional)"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? undefined : parseFloat(value));
                            }}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                 {/* Actual Hours (often only relevant in Edit mode) */}
                 <FormField
                    control={form.control}
                    name="actualHours"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Actual Hours</FormLabel>
                        <FormControl>
                        <Input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="Actual hours spent (optional)"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? undefined : parseFloat(value));
                            }}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                {/* Form Buttons */}
                <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={updateTaskMutation.isPending || isLoadingAssignees}>
                    {updateTaskMutation.isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                    </>
                    ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                    </>
                    )}
                </Button>
                </DialogFooter>
            </form>
            </Form>
        ) : (
            // Show loading or error if task data isn't ready
            <div className="py-4 text-center text-muted-foreground">Loading task data...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
