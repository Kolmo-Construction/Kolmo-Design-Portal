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
import { InsertPunchListItem, insertPunchListItemSchema, User } from "@shared/schema";
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
import { CalendarIcon, Loader2, PlusCircle, UploadCloud, X, Image as ImageIcon } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

// Form values type, including the optional file
type PunchListFormValues = z.infer<typeof insertPunchListItemSchema> & {
    punchPhoto?: FileList | null; // Optional single file
};

interface CreatePunchListItemDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: number;
  onSuccess?: () => void; // Optional callback
}

export function CreatePunchListItemDialog({
  isOpen,
  setIsOpen,
  projectId,
  onSuccess
}: CreatePunchListItemDialogProps) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // For image preview
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch potential assignees (same as Task dialog)
  const {
    data: assignees = [],
    isLoading: isLoadingAssignees
  } = useQuery<User[]>({
    queryKey: ["/api/project-managers"], // Reusing the same query key
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Setup form
  const form = useForm<PunchListFormValues>({
    resolver: zodResolver(insertPunchListItemSchema), // Use base schema for validation
    defaultValues: {
      projectId: projectId, // Not sent in body, but useful for context
      description: "",
      location: "",
      status: "open",
      priority: "medium",
      assigneeId: null,
      dueDate: undefined,
      photoUrl: undefined, // Handled separately via file upload
      // createdById is set on backend
    },
  });

  // Reset form and file state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        projectId: projectId,
        description: "",
        location: "",
        status: "open",
        priority: "medium",
        assigneeId: null,
        dueDate: undefined,
        photoUrl: undefined,
        punchPhoto: null,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
         fileInputRef.current.value = "";
      }
    } else {
        // Clean up preview URL when closing
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    }
  }, [isOpen, projectId, form, previewUrl]); // Add previewUrl dependency

  // Mutation hook for creating punch list item
  const createPunchListItemMutation = useMutation({
    mutationFn: (formData: FormData) => {
      // Use fetch directly for FormData
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
      setIsOpen(false);
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

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clean up previous preview URL
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    }
    if (file) {
      // Basic validation (optional)
      const maxSize = 10 * 1024 * 1024; // Example: 10MB limit for photos
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
      setPreviewUrl(URL.createObjectURL(file)); // Create preview URL
    } else {
      setSelectedFile(null);
    }
  };

  // Remove selected file
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

  // Handle form submission
  const handleFormSubmit = (values: PunchListFormValues) => {
    console.log("Punch list form submitted:", values);
    const formData = new FormData();

    // Append text fields
    formData.append('description', values.description);
    if (values.location) formData.append('location', values.location);
    if (values.status) formData.append('status', values.status);
    if (values.priority) formData.append('priority', values.priority);
    if (values.assigneeId !== null && values.assigneeId !== undefined) formData.append('assigneeId', values.assigneeId.toString());
    if (values.dueDate) formData.append('dueDate', new Date(values.dueDate).toISOString());

    // Append the file if selected
    if (selectedFile) {
      formData.append('punchPhoto', selectedFile, selectedFile.name); // Use 'punchPhoto' as field name
    }

    createPunchListItemMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Punch List Item</DialogTitle>
          <DialogDescription>
            Document an item requiring attention before project completion.
          </DialogDescription>
        </DialogHeader>

        {/* Form implementation */}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                accept="image/*" // Only images
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
                         {!previewUrl && selectedFile && ( // Fallback if preview fails but file selected
                             <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                         )}
                    </div>
                </FormControl>
                 <FormDescription>Attach a photo illustrating the item.</FormDescription>
                <FormMessage />
            </FormItem>

            {/* Form Buttons */}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
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
