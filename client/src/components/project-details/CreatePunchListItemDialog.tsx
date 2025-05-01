// client/src/components/project-details/CreatePunchListItemDialog.tsx
// Note: Renamed to .tsx for React component
import React, { useState, useRef, useEffect } from 'react';
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
import { InsertPunchListItem, insertPunchListItemSchema, User } from "@shared/schema"; // Keep original insert schema for type reference
import { useForm, FieldErrors } from "react-hook-form"; // Import FieldErrors type
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
import { CalendarIcon, Loader2, PlusCircle, UploadCloud, X, Image as ImageIcon } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

// *** NEW: Frontend-specific Zod schema for form validation ***
// Omits fields set by backend or handled separately (like the photo file)
const punchListFormValidationSchema = insertPunchListItemSchema.omit({
  id: true,
  projectId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  photoUrl: true, // Omit photoUrl as it's handled by file upload, not a direct form field
}).extend({
  // Keep date validation if needed, ensure it handles Date objects from picker
  dueDate: z.union([z.date(), z.string().datetime()]).optional().nullable(),
});


// Use the new schema to infer the form values type
type PunchListFormValues = z.infer<typeof punchListFormValidationSchema>;

interface CreatePunchListItemDialogProps {
  isOpen: boolean;
  setIsOpen?: (open: boolean) => void;
  onClose?: () => void;
  projectId: number;
  onSuccess?: () => void;
}

export function CreatePunchListItemDialog({
  isOpen,
  setIsOpen,
  onClose,
  projectId,
  onSuccess
}: CreatePunchListItemDialogProps) {
  // Handler that works with both setIsOpen and onClose patterns
  const handleClose = (open: boolean) => {
    if (!open) {
      if (setIsOpen) setIsOpen(false);
      if (onClose) onClose();
    }
  };

  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch potential assignees
  const {
    data: assignees = [],
    isLoading: isLoadingAssignees
  } = useQuery<User[]>({
    queryKey: ["/api/project-managers"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Setup form using the NEW frontend-specific validation schema
  const form = useForm<PunchListFormValues>({
    resolver: zodResolver(punchListFormValidationSchema), // Use the new schema here
    defaultValues: {
      // projectId is not part of this schema/form state
      description: "",
      location: "",
      status: "open",
      priority: "medium",
      assigneeId: null,
      dueDate: undefined,
      // photoUrl is omitted
    },
  });

  // Reset form and file state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({ // Reset using the fields defined in PunchListFormValues
        description: "",
        location: "",
        status: "open",
        priority: "medium",
        assigneeId: null,
        dueDate: undefined,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
         fileInputRef.current.value = "";
      }
    } else {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    }
  }, [isOpen, projectId, form, previewUrl]);

  // Mutation hook remains the same (sends FormData)
  const createPunchListItemMutation = useMutation({
    mutationFn: (formData: FormData) => {
      return fetch(`/api/projects/${projectId}/punch-list`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }).then(async (res) => {
        if (!res.ok) {
           const errorData = await res.json().catch(() => ({ message: res.statusText }));
           throw new Error(errorData.message || `Failed to create item: ${res.status}`);
        }
        return res.json();
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Punch list item added successfully." });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/punch-list`] });
      handleClose(false); // Use the combined close handler
      onSuccess?.();
    },
    onError: (err) => {
      console.error("Error creating punch list item:", err);
      toast({
        title: "Error Adding Item",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });

  // File change handler remains the same
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    }
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
         toast({ title: "File Too Large", description: `Photo size cannot exceed ${maxSize / 1024 / 1024}MB.`, variant: "destructive" });
         setSelectedFile(null);
         if (fileInputRef.current) fileInputRef.current.value = "";
         return;
      }
      if (!file.type.startsWith('image/')) {
           toast({ title: "Invalid File Type", description: `Only image files are allowed.`, variant: "destructive" });
           setSelectedFile(null);
           if (fileInputRef.current) fileInputRef.current.value = "";
           return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
    }
  };

  // Remove file handler remains the same
  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  // Form submit handler remains the same (constructs FormData)
  const handleFormSubmit = (values: PunchListFormValues) => {
    console.log("Punch list form submitted (validated values):", values);
    const formData = new FormData();

    // Append validated text fields
    formData.append('description', values.description);
    if (values.location) formData.append('location', values.location);
    if (values.status) formData.append('status', values.status);
    if (values.priority) formData.append('priority', values.priority);
    if (values.assigneeId !== null && values.assigneeId !== undefined) formData.append('assigneeId', values.assigneeId.toString());
    if (values.dueDate) formData.append('dueDate', new Date(values.dueDate).toISOString());

    // Append the file if selected
    if (selectedFile) {
      formData.append('punchPhoto', selectedFile, selectedFile.name);
    }

    createPunchListItemMutation.mutate(formData);
  };

  // *** NEW: Error handler for react-hook-form validation ***
  const handleValidationErrors = (errors: FieldErrors<PunchListFormValues>) => {
    console.error("React Hook Form validation errors:", errors);
    // Find the first error message to display
    const firstError = Object.values(errors)[0]?.message;
    toast({
        title: "Validation Error",
        description: typeof firstError === 'string' ? firstError : "Please check the form fields for errors.",
        variant: "destructive",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Punch List Item</DialogTitle>
          <DialogDescription>
            Document an item requiring attention before project completion.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* *** Attach the validation error handler *** */}
          <form onSubmit={form.handleSubmit(handleFormSubmit, handleValidationErrors)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3">

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
                    <Input placeholder="e.g., Kitchen, Master Bath Closet, Exterior South Wall" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status and Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || 'medium'}>
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
                          {field.value ? formatDate(field.value, "PPP") : <span>Pick a due date</span>}
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

            {/* Photo Upload */}
            <FormItem>
                <FormLabel>Attach Photo (Optional)</FormLabel>
                <FormControl>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="relative overflow-hidden">
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Select Photo
                            <Input
                                ref={fileInputRef}
                                id="punchPhoto"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </Button>
                         {previewUrl && (
                             <div className="relative group w-20 h-20 border rounded p-1 flex items-center justify-center">
                                <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                                <button
                                    type="button"
                                    onClick={removeFile}
                                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                    aria-label="Remove photo"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                         )}
                         {!previewUrl && selectedFile && (
                             <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                         )}
                    </div>
                </FormControl>
                 <FormDescription>Attach a photo illustrating the item.</FormDescription>
                {/* No FormMessage needed here unless adding file-specific validation errors */}
            </FormItem>

            {/* Form Buttons */}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPunchListItemMutation.isPending || isLoadingAssignees}>
                {createPunchListItemMutation.isPending ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Adding...
                   </>
                ) : (
                   "Add Punch List Item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>

      </DialogContent>
    </Dialog>
  );
}
