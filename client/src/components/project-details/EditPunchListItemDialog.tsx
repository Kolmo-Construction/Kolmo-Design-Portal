import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PunchListItem, InsertPunchListItem, User, insertPunchListItemSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient"; // Import query helpers
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
import { CalendarIcon, Loader2, Save, AlertTriangle, Image as ImageIcon, Upload, Trash2, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert'; // Import AlertTitle

// Define a combined type if the API returns items with details
type PunchListItemWithDetails = PunchListItem & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

// Use partial schema for updates, remove photoUrl omission
const editPunchListItemFormSchema = insertPunchListItemSchema.partial().omit({
    createdById: true,
    projectId: true,
    resolvedAt: true, // Set by backend based on status
    // photoUrl: true, // REMOVED - Handled by FormData now
});
type EditPunchListItemFormValues = z.infer<typeof editPunchListItemFormSchema>;

// Photo state structure
type PhotoState = {
    url: string | null; // URL (existing or preview)
    file?: File | null; // File object for new photo
    status: 'existing' | 'new' | 'removed' | 'none'; // Status of the photo
};

interface EditPunchListItemDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  itemToEditId: number | null;
  projectId: number;
  onSuccess?: () => void;
}

export function EditPunchListItemDialog({
  isOpen,
  setIsOpen,
  itemToEditId,
  projectId,
  onSuccess
}: EditPunchListItemDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for managing the single photo
  const [currentPhoto, setCurrentPhoto] = useState<PhotoState>({ url: null, file: null, status: 'none' });
  // State for loading indicator during submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch the specific punch list item details when the dialog opens
  const punchListItemQueryKey = [`/api/projects/${projectId}/punch-list/${itemToEditId}`];
  const {
      data: itemDetails,
      isLoading: isLoadingItem,
      isError: isErrorItem,
      error: errorItem,
      isFetching: isFetchingItem,
  } = useQuery<PunchListItemWithDetails>({
      queryKey: punchListItemQueryKey,
      queryFn: getQueryFn({ on401: "throw" }),
      enabled: isOpen && !!itemToEditId,
      staleTime: 5 * 60 * 1000,
  });

  // Fetch potential assignees
  const {
    data: assignees = [],
    isLoading: isLoadingAssignees
  } = useQuery<User[]>({
    queryKey: ["/api/project-managers"], // Use consistent format with path
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Setup react-hook-form
  const form = useForm<EditPunchListItemFormValues>({
    resolver: zodResolver(editPunchListItemFormSchema),
    defaultValues: {}, // Populated by useEffect
  });

  // Effect to reset form and populate with fetched item data and photo state
  useEffect(() => {
    let photoPreviewUrl: string | null = null; // Keep track of preview URL to revoke

    if (isOpen && itemDetails) {
      form.reset({
        description: itemDetails.description ?? "",
        location: itemDetails.location ?? "",
        status: itemDetails.status ?? "open",
        priority: itemDetails.priority ?? "medium",
        assigneeId: itemDetails.assigneeId ?? null,
        dueDate: itemDetails.dueDate ? new Date(itemDetails.dueDate) : undefined,
       });
       // Initialize photo state
       if (itemDetails.photoUrl) {
           setCurrentPhoto({ url: itemDetails.photoUrl, file: null, status: 'existing' });
       } else {
           setCurrentPhoto({ url: null, file: null, status: 'none' });
       }
    } else if (!isOpen) {
       form.reset();
       setCurrentPhoto(prev => { // Revoke URL on close if it was a preview
           if (prev.status === 'new' && prev.url) {
               URL.revokeObjectURL(prev.url);
           }
           return { url: null, file: null, status: 'none' };
       });
       setIsSubmitting(false);
    }

    // Cleanup function to revoke URL on unmount or when state changes
    return () => {
        if (photoPreviewUrl) {
            URL.revokeObjectURL(photoPreviewUrl);
        }
    };
  }, [isOpen, itemDetails, form]);

  // --- Mutation hook for updating (now using FormData) ---
  const updatePunchListItemMutation = useMutation({
    mutationFn: async (formData: FormData) => {
        if (!itemToEditId) throw new Error("Item ID is missing");

        // Use direct fetch for PUT with FormData
        const response = await fetch(`/api/projects/${projectId}/punch-list/${itemToEditId}`, {
            method: 'PUT',
            body: formData,
            // Headers like Content-Type are set automatically by browser for FormData
            // Add Auth headers (e.g., CSRF) if needed
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(errorData.message || `Failed to update punch list item`);
        }
        // Try parsing JSON, but handle cases where backend might not return body on success
         const contentType = response.headers.get("content-type");
         if (contentType && contentType.indexOf("application/json") !== -1) {
              return await response.json();
         } else {
              return { success: true }; // Assume success if no JSON body but status is OK
         }
    },
    onSuccess: (data) => { // data might be { success: true } or the updated item
      toast({ title: "Success", description: "Punch list item updated." });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'punch-list'] }); // Invalidate list
      queryClient.invalidateQueries({ queryKey: punchListItemQueryKey }); // Invalidate specific item
      onSuccess?.();
      setIsOpen(false);
    },
    onError: (err: Error) => {
      console.error("Error updating punch list item:", err);
      toast({
        title: "Error Updating Item",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
        setIsSubmitting(false); // Ensure loading state is turned off
    }
  });

  // --- Handlers ---

   // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Basic validation
      if (!file.type.startsWith('image/')) {
            toast({ title: "Invalid File Type", description: "Please select an image file.", variant: "warning" });
            return;
      }

      // Revoke previous preview URL if it exists
      if (currentPhoto.status === 'new' && currentPhoto.url) {
          URL.revokeObjectURL(currentPhoto.url);
      }

      // Create new preview URL and update state
      const previewUrl = URL.createObjectURL(file);
      setCurrentPhoto({
          url: previewUrl,
          file: file,
          status: 'new',
      });

      // Clear file input value
      if (fileInputRef.current) {
           fileInputRef.current.value = '';
      }
  };

   // Handle removing the current photo (new or existing)
  const handleRemovePhoto = () => {
       // Revoke preview URL if removing a newly added photo
       if (currentPhoto.status === 'new' && currentPhoto.url) {
           URL.revokeObjectURL(currentPhoto.url);
       }
       // Set status to 'removed' to signal deletion on save
       setCurrentPhoto({ url: null, file: null, status: 'removed' });
  };

  // Handle form submission
  const handleFormSubmit = (values: EditPunchListItemFormValues) => {
    if (!itemToEditId) return;
    setIsSubmitting(true);

    // 1. Create FormData
    const formData = new FormData();

    // 2. Append form fields (handle null/undefined values)
    Object.entries(values).forEach(([key, value]) => {
      if (value instanceof Date) {
        formData.append(key, value.toISOString());
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

     // 3. Append photo file if status is 'new'
    if (currentPhoto.status === 'new' && currentPhoto.file) {
        formData.append('photo', currentPhoto.file);
    }

    // 4. Append signal to remove photo if status is 'removed'
    //    (Requires backend adjustment to check for this field)
    if (currentPhoto.status === 'removed') {
        formData.append('removePhoto', 'true');
    }

    // 5. Mutate
    console.log("Submitting punch list update with FormData..."); // Keep FormData log minimal in prod
    updatePunchListItemMutation.mutate(formData);
  };

  // Helper function to safely format dates
   const safeFormatDate = (value: any) => { /* ... same as before ... */
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


  // Helper to render loading/error states or the form
  const renderDialogContent = () => {
      if (!itemToEditId) return null;
      if (isLoadingItem || (isFetchingItem && !itemDetails)) {
          return ( /* ... Skeleton code same as before ... */
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
          return ( /* ... Error Alert same as before ... */
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

      // --- Render the actual form ---
      return (
          <Form {...form}>
               {/* Add pointerEvents: none while submitting */}
               <form
                 onSubmit={form.handleSubmit(handleFormSubmit)}
                 className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3"
                 style={{ pointerEvents: isSubmitting ? 'none' : 'auto' }}
                >
                    {/* Description, Location, Status, Priority, Assignee, Due Date (same as before) */}
                    {/* ... FormField components for text/select/date fields ... */}
                     <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description*</FormLabel><FormControl><Textarea placeholder="Describe the issue..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g., Kitchen" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status*</FormLabel><Select onValueChange={field.onChange} value={field.value ?? "open"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="verified">Verified</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                         <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} value={field.value ?? "medium"}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                     </div>
                     <FormField control={form.control} name="assigneeId" render={({ field }) => (<FormItem><FormLabel>Assignee</FormLabel><Select onValueChange={(value) => field.onChange(value === "unassigned" ? null : parseInt(value))} value={field.value?.toString() ?? "unassigned"} disabled={isLoadingAssignees}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingAssignees ? "Loading..." : "Assign to..."} /></SelectTrigger></FormControl><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{assignees.map((assignee) => (<SelectItem key={assignee.id} value={assignee.id.toString()}>{assignee.firstName} {assignee.lastName} ({assignee.role})</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal h-10", !field.value && "text-muted-foreground")}>{field.value ? safeFormatDate(field.value) : <span>Pick a due date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(date) => field.onChange(date)} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />

                   {/* --- Photo Management Section --- */}
                   <FormItem>
                       <FormLabel>Photo</FormLabel>
                       <div className="mt-1 flex items-center gap-4 p-2 border rounded-md bg-muted/50">
                           {currentPhoto.url ? (
                               // Display current photo (existing or preview)
                               <div className="relative group w-24 h-24 border rounded p-1 flex items-center justify-center bg-background shadow-sm overflow-hidden">
                                   <img
                                       src={currentPhoto.url}
                                       alt={currentPhoto.status === 'new' ? "New photo preview" : "Existing photo"}
                                       className="max-h-full max-w-full object-contain block"
                                   />
                                    {/* Overlay with delete button */}
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={handleRemovePhoto}
                                            aria-label="Remove photo"
                                            disabled={isSubmitting}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                               </div>
                           ) : (
                                // Placeholder if no photo
                                <div className="w-24 h-24 border border-dashed rounded flex items-center justify-center bg-background text-muted-foreground">
                                    <ImageIcon className="h-8 w-8" />
                                </div>
                           )}

                           {/* Input Trigger */}
                           <div>
                               <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isSubmitting}
                                >
                                   <Upload className="mr-2 h-4 w-4" />
                                   {currentPhoto.status === 'existing' || currentPhoto.status === 'new' ? 'Replace Photo' : 'Add Photo'}
                               </Button>
                               <Input
                                   id="punch-photo-upload"
                                   ref={fileInputRef}
                                   type="file"
                                   accept="image/*"
                                   className="hidden"
                                   onChange={handleFileChange}
                                   disabled={isSubmitting}
                                />
                               <FormDescription className="mt-2 text-xs">
                                   {currentPhoto.status === 'removed' ? 'Photo marked for removal on save.' : 'Upload a JPG, PNG, or GIF.'}
                               </FormDescription>
                           </div>
                       </div>
                       <FormMessage /> {/* For potential future file validation errors */}
                   </FormItem>
                   {/* --- End Photo Management Section --- */}


                  {/* Form Buttons */}
                  <DialogFooter className="pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                          Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || isLoadingAssignees || isFetchingItem}>
                          {isSubmitting ? (
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
             Modify details and manage the photo for this punch list item.
          </DialogDescription>
        </DialogHeader>

        {renderDialogContent()}

      </DialogContent>
    </Dialog>
  );
}