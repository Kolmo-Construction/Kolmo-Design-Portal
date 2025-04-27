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
// Import schema and types
import { DailyLog, InsertDailyLog, DailyLogPhoto, insertDailyLogSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, Save, Image as ImageIcon, AlertTriangle, Trash2, Upload, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert'; // Import AlertTitle

// Define a combined type if the API returns logs with photos and creator
type DailyLogWithDetails = DailyLog & {
    photos?: DailyLogPhoto[];
};

// Use partial schema for updates, as not all fields might be sent
const editDailyLogFormSchema = insertDailyLogSchema.partial().omit({
    createdById: true,
    projectId: true,
});
type EditDailyLogFormValues = z.infer<typeof editDailyLogFormSchema>;

// Define payload for the update mutation (text fields only)
type UpdateDailyLogPayload = {
    logId: number;
    logData: EditDailyLogFormValues;
};

// Define state structure for photos
interface PhotoState {
    id?: number; // ID for existing photos
    url: string; // URL (existing or preview)
    file?: File; // File object for new photos
    status: 'existing' | 'new' | 'deleted'; // Status of the photo
    caption?: string; // Existing caption
}

interface EditDailyLogDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  logToEditId: number | null;
  projectId: number;
  onSuccess?: () => void;
}

export function EditDailyLogDialog({
  isOpen,
  setIsOpen,
  logToEditId,
  projectId,
  onSuccess
}: EditDailyLogDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for managing photos (existing, new, deleted)
  const [photosState, setPhotosState] = useState<PhotoState[]>([]);
  // State for loading indicator during photo processing
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  // Fetch the specific daily log details when the dialog opens, including photos
  const dailyLogQueryKey = [`/api/projects/${projectId}/daily-logs/${logToEditId}`];
  const {
      data: logDetails,
      isLoading: isLoadingLog,
      isError: isErrorLog,
      error: errorLog,
      isFetching: isFetchingLog,
  } = useQuery<DailyLogWithDetails>({
      queryKey: dailyLogQueryKey,
      queryFn: getQueryFn({ on401: "throw" }),
      enabled: isOpen && !!logToEditId,
      staleTime: 1 * 60 * 1000, // Refresh more often if photos change
  });

  // Setup react-hook-form
  const form = useForm<EditDailyLogFormValues>({
    resolver: zodResolver(editDailyLogFormSchema),
    defaultValues: {}, // Will be populated by useEffect
  });

  // Effect to reset form and populate with fetched log data and photos
  useEffect(() => {
    if (isOpen && logDetails) {
      form.reset({
        logDate: logDetails.logDate ? new Date(logDetails.logDate) : new Date(),
        weather: logDetails.weather ?? "",
        temperature: logDetails.temperature !== null && logDetails.temperature !== undefined ? 
          (typeof logDetails.temperature === 'string' ? parseFloat(logDetails.temperature) : logDetails.temperature) : 
          undefined,
        crewOnSite: logDetails.crewOnSite ?? "",
        workPerformed: logDetails.workPerformed ?? "",
        issuesEncountered: logDetails.issuesEncountered ?? "",
        safetyObservations: logDetails.safetyObservations ?? "",
      });
      // Initialize photo state from fetched details
      const initialPhotos = logDetails.photos?.map(p => ({
          id: p.id,
          url: p.photoUrl,
          status: 'existing',
          caption: p.caption,
      } as PhotoState)) ?? [];
      setPhotosState(initialPhotos);
    } else if (!isOpen) {
        form.reset();
        setPhotosState([]); // Clear photos when dialog closes
        setIsProcessingPhotos(false);
    }
  }, [isOpen, logDetails, form]);

  // --- Mutations ---

  // Mutation for Deleting an Existing Photo
  const deletePhotoMutation = useMutation({
      mutationFn: async (photoId: number) => {
          // Use direct fetch for DELETE as apiRequest might not be suitable
          const response = await fetch(`/api/projects/${projectId}/daily-logs/photos/${photoId}`, {
              method: 'DELETE',
              // Add headers if needed (e.g., CSRF token)
          });
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
              throw new Error(errorData.message || `Failed to delete photo ${photoId}`);
          }
           return { success: true, photoId };
      },
      onError: (error: Error, photoId) => {
           console.error(`Error deleting photo ${photoId}:`, error);
           toast({
               title: "Photo Delete Failed",
               description: error.message,
               variant: "destructive",
           });
           // Optionally revert state for the specific photo if needed
      },
  });

  // Mutation for Adding a New Photo
  const addPhotoMutation = useMutation({
       mutationFn: async (file: File) => {
           if (!logToEditId) throw new Error("Cannot add photo without a log ID.");
           const formData = new FormData();
           formData.append('photos', file, file.name); // Backend expects 'photos' field [cite: 1226]

           // Use direct fetch to send FormData
           const response = await fetch(`/api/projects/${projectId}/daily-logs/${logToEditId}/photos`, {
               method: 'POST',
               body: formData,
               // Add headers if needed (e.g., CSRF token), browser sets Content-Type for FormData
           });

           if (!response.ok) {
               const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
               throw new Error(errorData.message || `Failed to upload photo ${file.name}`);
           }
           return { success: true, fileName: file.name }; // Return success indicator
       },
      onError: (error: Error, file) => {
          console.error(`Error uploading photo ${file.name}:`, error);
          toast({
              title: "Photo Upload Failed",
              description: `Failed to upload ${file.name}: ${error.message}`,
              variant: "destructive",
          });
          // Optionally remove the failed photo from photosState or mark as error
          setPhotosState(prev => prev.filter(p => p.file?.name !== file.name));
      },
  });

  // Mutation hook for updating daily log text fields
  const updateDailyLogMutation = useMutation({
    mutationFn: ({ logId, logData }: UpdateDailyLogPayload) => {
        const apiData = {
           ...logData,
           logDate: logData.logDate ? new Date(logData.logDate).toISOString() : undefined,
        };
        // Use apiRequest for PUT request
        return apiRequest('PUT', `/api/projects/${projectId}/daily-logs/${logId}`, apiData);
    },
    onError: (err: Error) => { // Use specific type Error
      console.error("Error updating daily log text:", err);
      toast({
        title: "Error Updating Log Details",
        description: err.message,
        variant: "destructive",
      });
    },
    // Success handling is done after all operations complete in handleFormSubmit
  });

  // --- Handlers ---

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const newPhotos: PhotoState[] = [];
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // Basic validation (could add size check here too)
          if (file.type.startsWith('image/')) {
              newPhotos.push({
                  url: URL.createObjectURL(file),
                  file: file,
                  status: 'new',
              });
          } else {
              toast({ title: "Invalid File Type", description: `${file.name} is not a supported image type.`, variant: "warning" });
          }
      }

      setPhotosState(prev => [...prev, ...newPhotos]);

      // Clear file input value so the same file can be selected again if removed
       if (fileInputRef.current) {
           fileInputRef.current.value = '';
       }
  };

  // Handle removing a photo (either new or existing)
  const handleRemovePhoto = (index: number) => {
      const photoToRemove = photosState[index];

      if (photoToRemove.status === 'new') {
          // If it's a new photo not yet uploaded, just remove from state
          URL.revokeObjectURL(photoToRemove.url); // Clean up preview URL
          setPhotosState(prev => prev.filter((_, i) => i !== index));
      } else if (photoToRemove.status === 'existing') {
          // If it's an existing photo, mark it for deletion on save
          setPhotosState(prev =>
              prev.map((p, i) => i === index ? { ...p, status: 'deleted' } : p)
          );
      }
      // If status is 'deleted', do nothing (it's already marked)
  };

  // Handle form submission
  const handleFormSubmit = async (values: EditDailyLogFormValues) => {
    if (!logToEditId) return;
    setIsProcessingPhotos(true); // Start loading indicator

    let allOpsSuccessful = true;

    try {
        // 1. Delete photos marked for deletion
        const photosToDelete = photosState.filter(p => p.status === 'deleted' && p.id);
        if (photosToDelete.length > 0) {
            toast({ title: "Processing...", description: `Deleting ${photosToDelete.length} photo(s)...` });
            const deletePromises = photosToDelete.map(p => deletePhotoMutation.mutateAsync(p.id!));
            await Promise.all(deletePromises);
             // Remove deleted photos from state after successful API calls
             setPhotosState(prev => prev.filter(p => p.status !== 'deleted'));
        }

        // 2. Add new photos
        const photosToAdd = photosState.filter(p => p.status === 'new' && p.file);
         if (photosToAdd.length > 0) {
            toast({ title: "Processing...", description: `Uploading ${photosToAdd.length} new photo(s)...` });
            const addPromises = photosToAdd.map(p => addPhotoMutation.mutateAsync(p.file!));
            await Promise.all(addPromises);
            // Update status of newly added photos (or wait for invalidation)
            // For now, rely on query invalidation below
        }

        // 3. Update log text fields
        toast({ title: "Processing...", description: "Saving log details..." });
        await updateDailyLogMutation.mutateAsync({ logId: logToEditId, logData: values });

    } catch (error) {
        allOpsSuccessful = false;
        console.error("Error during log update process:", error);
        // Specific errors are toasted within mutations, maybe add a general failure toast here?
        // toast({ title: "Update Failed", description: "An error occurred while saving changes.", variant: "destructive" });
    } finally {
        setIsProcessingPhotos(false); // Stop loading indicator
        if (allOpsSuccessful) {
            toast({ title: "Success", description: "Daily log and photos updated successfully." });
            queryClient.invalidateQueries({ queryKey: dailyLogQueryKey }); // Invalidate specific log
            queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'daily-logs'] }); // Invalidate list
            onSuccess?.();
            setIsOpen(false); // Close dialog on full success
        } else {
             // If anything failed, refresh the data to show the current state
             toast({ title: "Partial Failure", description: "Some operations failed. Please review the log.", variant:"warning"});
             queryClient.invalidateQueries({ queryKey: dailyLogQueryKey });
        }
    }
  };

  // Helper to render loading/error states within the dialog content
  const renderDialogContent = () => {
      if (!logToEditId) return null;

      if (isLoadingLog || (isFetchingLog && !logDetails)) { // Show skeleton only on initial load
          return ( /* ... Skeleton code same as before ... */
                <div className="space-y-4 py-4">
                  <Skeleton className="h-10 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                  <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-2 pt-2">
                     <Skeleton className="h-20 w-20 rounded" />
                     <Skeleton className="h-20 w-20 rounded" />
                  </div>
              </div>
          );
      }

      if (isErrorLog) {
          return ( /* ... Error Alert same as before ... */
             <Alert variant="destructive" className="my-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error Loading Log Details</AlertTitle>
                  <AlertDescription>
                    {errorLog instanceof Error ? errorLog.message : "Could not load log data."}
                  </AlertDescription>
              </Alert>
          );
      }

       if (!logDetails) {
          return <div className="py-4 text-center">Log details not available.</div>;
      }

      // --- Render the actual form ---
      return (
          <Form {...form}>
              {/* Add pointerEvents: none while processing photos */}
              <form
                onSubmit={form.handleSubmit(handleFormSubmit)}
                className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3"
                style={{ pointerEvents: isProcessingPhotos ? 'none' : 'auto' }}
              >
                   {/* --- Text Fields (same as before) --- */}
                    {/* Log Date */}
                    <FormField
                        control={form.control}
                        name="logDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Log Date*</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn("pl-3 text-left font-normal h-10", !field.value && "text-muted-foreground")}
                                            >
                                                {field.value ? formatDate(field.value, "PPP") : <span>Pick a date</span>}
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
                    {/* Weather and Temperature */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="weather" render={({ field }) => (<FormItem><FormLabel>Weather</FormLabel><FormControl><Input placeholder="e.g., Sunny, Cloudy" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="temperature" render={({ field }) => (<FormItem><FormLabel>Temperature (°)</FormLabel><FormControl><Input type="number" step="any" placeholder="e.g., 72.5" {...field} value={field.value ?? ''} onChange={(e) => { const value = e.target.value; field.onChange(value === '' ? undefined : parseFloat(value)); }} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    {/* Crew On Site */}
                    <FormField control={form.control} name="crewOnSite" render={({ field }) => (<FormItem><FormLabel>Crew On Site</FormLabel><FormControl><Input placeholder="List crew present" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    {/* Work Performed */}
                    <FormField control={form.control} name="workPerformed" render={({ field }) => (<FormItem><FormLabel>Work Performed*</FormLabel><FormControl><Textarea placeholder="Describe work completed..." className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    {/* Issues Encountered */}
                    <FormField control={form.control} name="issuesEncountered" render={({ field }) => (<FormItem><FormLabel>Issues Encountered</FormLabel><FormControl><Textarea placeholder="Describe issues or delays (optional)" className="min-h-[80px]" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    {/* Safety Observations */}
                    <FormField control={form.control} name="safetyObservations" render={({ field }) => (<FormItem><FormLabel>Safety Observations</FormLabel><FormControl><Textarea placeholder="Note safety observations (optional)" className="min-h-[80px]" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    {/* --- End Text Fields --- */}


                   {/* --- Photo Management Section --- */}
                  <FormItem>
                      <FormLabel>Photos</FormLabel>
                      <div className="mt-1 flex flex-wrap gap-3 p-2 border rounded-md bg-muted/50 min-h-[100px]">
                          {photosState.map((photo, index) => (
                              <div
                                key={photo.id ?? `new-${index}`}
                                className={cn(
                                    "relative group w-24 h-24 border rounded p-1 flex items-center justify-center bg-background shadow-sm overflow-hidden",
                                    photo.status === 'deleted' && "opacity-50 border-destructive border-dashed"
                                )}
                                >
                                  <img
                                      src={photo.url}
                                      alt={photo.caption || (photo.file ? `New photo ${index + 1}` : `Existing photo ${photo.id}`)}
                                      className="max-h-full max-w-full object-contain block"
                                      title={photo.caption || photo.url.split('/').pop()}
                                  />
                                  {/* Overlay with delete button */}
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                       {photo.status !== 'deleted' && (
                                           <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => handleRemovePhoto(index)}
                                                aria-label={photo.status === 'new' ? "Remove photo" : "Mark photo for deletion"}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                           </Button>
                                       )}
                                        {photo.status === 'deleted' && (
                                            <span className="text-destructive-foreground text-xs font-semibold">Marked for Deletion</span>
                                        )}
                                  </div>
                              </div>
                          ))}
                          {/* Add Photo Button/Area */}
                         <label htmlFor="photo-upload" className="cursor-pointer w-24 h-24 border-2 border-dashed rounded flex flex-col items-center justify-center text-muted-foreground hover:bg-accent hover:border-primary transition-colors">
                              <Upload className="h-6 w-6 mb-1" />
                              <span className="text-xs text-center">Add Photos</span>
                          </label>
                         <Input
                             id="photo-upload"
                             ref={fileInputRef}
                             type="file"
                             multiple
                             accept="image/*"
                             className="hidden" // Hide the default input
                             onChange={handleFileChange}
                             disabled={isProcessingPhotos}
                          />
                      </div>
                      <FormDescription>
                          Add or remove photos associated with this daily log. Deletions happen when you save.
                      </FormDescription>
                  </FormItem>
                  {/* --- End Photo Management Section --- */}

                  {/* Form Buttons */}
                  <DialogFooter className="pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessingPhotos}>
                          Cancel
                      </Button>
                      <Button type="submit" disabled={isProcessingPhotos || updateDailyLogMutation.isPending || isFetchingLog}>
                          {(isProcessingPhotos || updateDailyLogMutation.isPending) ? (
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
          <DialogTitle>Edit Daily Log</DialogTitle>
           <DialogDescription>
               Modify details and manage photos for the log dated {logDetails?.logDate ? formatDate(logDetails.logDate, "PPP") : '...'}.
           </DialogDescription>
        </DialogHeader>

        {renderDialogContent()}

      </DialogContent>
    </Dialog>
  );
}