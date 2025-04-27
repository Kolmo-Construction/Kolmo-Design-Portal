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
// Import schema and types
import { PunchListItem, InsertPunchListItem, User, insertPunchListItemSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
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
import { CalendarIcon, Loader2, Save, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert'; // Import Alert

// Define a combined type if the API returns items with details
type PunchListItemWithDetails = PunchListItem & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

// Use partial schema for updates
const editPunchListItemFormSchema = insertPunchListItemSchema.partial().omit({
    // Fields set by backend or immutable
    createdById: true,
    projectId: true, // projectId is in URL, not body for PUT
    photoUrl: true, // Handle photoUrl separately if/when implementing photo edit
    resolvedAt: true, // Should be set by backend based on status
});
type EditPunchListItemFormValues = z.infer<typeof editPunchListItemFormSchema>;

// Define payload for the update mutation
type UpdatePunchListItemPayload = {
    itemId: number;
    itemData: EditPunchListItemFormValues;
};

interface EditPunchListItemDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  itemToEditId: number | null; // Pass the ID of the item to edit
  projectId: number;
  onSuccess?: () => void; // Optional callback on success
}

export function EditPunchListItemDialog({
  isOpen,
  setIsOpen,
  itemToEditId,
  projectId,
  onSuccess
}: EditPunchListItemDialogProps) {
  const queryClient = useQueryClient();

  // Fetch the specific punch list item details when the dialog opens
  const punchListItemQueryKey = [`/api/projects/${projectId}/punch-list`, itemToEditId];
  const {
      data: itemDetails,
      isLoading: isLoadingItem,
      isError: isErrorItem,
      error: errorItem,
      isFetching: isFetchingItem,
  } = useQuery<PunchListItemWithDetails>({ // Use combined type assuming details might be fetched
      queryKey: punchListItemQueryKey,
      queryFn: getQueryFn({ on401: "throw" }),
      enabled: isOpen && !!itemToEditId,
      staleTime: 5 * 60 * 1000,
  });

  // Fetch potential assignees (same as Task/Create Punch List dialogs)
  const {
    data: assignees = [],
    isLoading: isLoadingAssignees
  } = useQuery<User[]>({
    queryKey: ["/api/project-managers"], // Reusing the query key for PMs/Admins
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen, // Only fetch when the dialog is open
  });

  // Setup react-hook-form
  const form = useForm<EditPunchListItemFormValues>({
    resolver: zodResolver(editPunchListItemFormSchema),
    defaultValues: {
        description: "",
        location: "",
        status: "open",
        priority: "medium",
        assigneeId: null,
        dueDate: undefined,
    },
  });

  // Effect to reset form and populate with fetched item data
  useEffect(() => {
    if (isOpen && itemDetails) {
      form.reset({
        description: itemDetails.description ?? "",
        location: itemDetails.location ?? "",
        status: itemDetails.status ?? "open",
        priority: itemDetails.priority ?? "medium",
        assigneeId: itemDetails.assigneeId ?? null,
        dueDate: itemDetails.dueDate ? new Date(itemDetails.dueDate) : undefined,
      });
    } else if (!isOpen) {
       form.reset({ // Reset to defaults when closing
           description: "", location: "", status: "open", priority: "medium", assigneeId: null, dueDate: undefined
       });
    }
  }, [isOpen, itemDetails, form]);

  // Mutation hook for updating a punch list item
  const updatePunchListItemMutation = useMutation({
    mutationFn: ({ itemId, itemData }: UpdatePunchListItemPayload) => {
       // Ensure dates are in correct format if API expects string
        const apiData = {
           ...itemData,
           dueDate: itemData.dueDate ? new Date(itemData.dueDate).toISOString() : undefined,
        };
        // NOTE: This implementation does NOT handle photo uploads/deletions yet
      return apiRequest<PunchListItem>('PUT', `/api/projects/${projectId}/punch-list/${itemId}`, apiData);
    },
    onSuccess: (updatedItem) => {
      toast({ title: "Success", description: "Punch list item updated." });
      // Invalidate list query and specific item query
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/punch-list`] });
      queryClient.invalidateQueries({ queryKey: punchListItemQueryKey });
      setIsOpen(false);
      onSuccess?.();
    },
    onError: (err) => {
      console.error("Error updating punch list item:", err);
      toast({
        title: "Error Updating Item",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleFormSubmit = (values: EditPunchListItemFormValues) => {
    if (!itemToEditId) return;
    console.log("Submitting punch list update:", values);
    updatePunchListItemMutation.mutate({ itemId: itemToEditId, itemData: values });
  };

   // Helper function to safely format dates
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


  // Helper to render loading/error states within the dialog content
  const renderDialogContent = () => {
      if (!itemToEditId) return null;

      if (isLoadingItem || isFetchingItem) {
          return (
              <div className="space-y-4 py-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <div className="grid grid-cols-2 gap-4">
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-20 rounded" />
              </div>
          );
      }

      if (isErrorItem) {
          return (
              <Alert variant="destructive" className="my-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error Loading Item Details</AlertTitle>
                  <AlertDescription>
                      {errorItem instanceof Error ? errorItem.message : "Could not load item data."}
                  </AlertDescription>
              </Alert>
          );
      }

       if (!itemDetails) {
          return <div className="py-4 text-center">Item details not available.</div>;
       }

      // Render the actual form once data is loaded
      return (
          <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3">
                  {/* Description */}
                  <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Description*</FormLabel>
                              <FormControl>
                                  <Textarea
                                      placeholder="Describe the issue or item needing attention..."
                                      className="min-h-[100px]"
                                      {...field}
                                  />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                  {/* Location */}
                  <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Location</FormLabel>
                              <FormControl>
                                  <Input placeholder="e.g., Kitchen, Master Bath" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                  {/* Status and Priority */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Status*</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? "open"}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                      <SelectContent>
                                          <SelectItem value="open">Open</SelectItem>
                                          <SelectItem value="in_progress">In Progress</SelectItem>
                                          <SelectItem value="resolved">Resolved</SelectItem>
                                          <SelectItem value="verified">Verified</SelectItem>
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Priority</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? "medium"}>
                                      <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
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

                  {/* Assignee */}
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
                                  <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAssignees ? "Loading..." : "Assign to..."} /></SelectTrigger></FormControl>
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
                                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal h-10", !field.value && "text-muted-foreground")}>
                                              {field.value ? safeFormatDate(field.value) : <span>Pick a due date</span>}
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

                  {/* Display Existing Photo (Read-only) */}
                   {itemDetails.photoUrl && (
                      <FormItem>
                          <FormLabel>Existing Photo</FormLabel>
                           <div className="mt-1 flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                               <img
                                   src={itemDetails.photoUrl}
                                   alt="Existing punch list photo"
                                   className="h-20 w-20 rounded border object-contain bg-background"
                               />
                               <span className="text-xs text-muted-foreground truncate flex-1" title={itemDetails.photoUrl.split('/').pop()}>
                                   {itemDetails.photoUrl.split('/').pop()}
                               </span>
                               {/* TODO: Add delete button for photo later */}
                           </div>
                           <FormDescription>
                              Photo editing/replacement is not implemented yet.
                           </FormDescription>
                      </FormItem>
                   )}
                  {/* TODO: Add file input here later for adding/replacing photos */}

                  {/* Form Buttons */}
                  <DialogFooter className="pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                          Cancel
                      </Button>
                      <Button type="submit" disabled={updatePunchListItemMutation.isPending || isFetchingItem || isLoadingAssignees}>
                          {updatePunchListItemMutation.isPending ? (
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
      );
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Punch List Item</DialogTitle>
          <DialogDescription>
             Modify the details for this punch list item.
          </DialogDescription>
        </DialogHeader>

        {renderDialogContent()}

      </DialogContent>
    </Dialog>
  );
}