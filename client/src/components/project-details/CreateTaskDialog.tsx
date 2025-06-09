import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InsertTask, insertTaskSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { CalendarIcon } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface CreateTaskDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: number;
  project?: { totalBudget?: string | number }; // Add project data for budget calculations
  onSubmit: (values: InsertTask) => void; // Callback with validated data
  isPending: boolean; // To disable button while submitting
}

export function CreateTaskDialog({
  isOpen,
  setIsOpen,
  projectId,
  project,
  onSubmit,
  isPending
}: CreateTaskDialogProps) {

  // Setup react-hook-form with Zod validation
  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      projectId: projectId, // Pre-fill projectId
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: null, // Will add user selection component later
      startDate: undefined,
      dueDate: undefined,
      estimatedHours: undefined,
      actualHours: undefined,
      isBillable: false,
      billableAmount: 0,
      billingRate: undefined,
      billingType: "percentage",
    },
  });

  // Helper function to safely format dates
  const safeFormatDate = (value: any) => {
    if (!value) return "";
    try {
      if (typeof value === 'string') {
        return formatDate(value, "PPP");
      } else if (value instanceof Date) {
        return formatDate(value.toISOString(), "PPP");
      }
      return "Invalid date";
    } catch (err) {
      console.error("Date formatting error:", err);
      return "Date error";
    }
  };

  // Handle form submission
  const handleFormSubmit = (values: InsertTask) => {
    console.log("Form submitted:", values);
    onSubmit(values); // Call the mutation function passed via props
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[525px]"> {/* Adjust width as needed */}
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task for this project. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        {/* Form implementation */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Task Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
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
                      placeholder="Enter task description" 
                      className="min-h-[80px]" 
                      {...field} 
                      value={field.value || ''} 
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
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
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
                      defaultValue={field.value}
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
                              "pl-3 text-left font-normal",
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
                              "pl-3 text-left font-normal",
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
                      placeholder="Estimated hours to complete" 
                      {...field} 
                      value={field.value || ''} 
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

            {/* Billing Configuration */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-medium text-slate-900">Billing Configuration</h4>
              
              {/* Is Billable Checkbox */}
              <FormField
                control={form.control}
                name="isBillable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal">
                        Make this task billable
                      </FormLabel>
                      <FormDescription className="text-xs text-slate-500">
                        Enable billing for this task when completed
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Billing fields - only show if billable */}
              {form.watch("isBillable") && (
                <>
                  <div className="space-y-4">
                    {/* Billing Percentage */}
                    <FormField
                      control={form.control}
                      name="billableAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Percentage</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="25.0"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? 0 : parseFloat(value));
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-slate-500">
                            Percentage of total project value to bill when completed
                            {project?.totalBudget && (
                              <span className="block mt-1">
                                Project Budget: ${Number(project.totalBudget).toLocaleString()}
                                {field.value > 0 && (
                                  <span className="text-slate-700 font-medium">
                                    {' '}→ ${((Number(project.totalBudget) * (field.value || 0)) / 100).toLocaleString()}
                                  </span>
                                )}
                              </span>
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Form Buttons */}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

      </DialogContent>
    </Dialog>
  );
}