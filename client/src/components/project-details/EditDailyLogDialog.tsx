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
import { DailyLog, InsertDailyLog, DailyLogPhoto, insertDailyLogSchema } from "@shared/schema"; // Use DailyLog type for prop
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"; // Import useQuery as well
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
import { CalendarIcon, Loader2, Save, Image as ImageIcon, AlertTriangle } from "lucide-react"; // Import Save icon
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Define a combined type if the API returns logs with photos and creator
// Adjust based on your actual API response or storage function enhancement
type DailyLogWithDetails = DailyLog & {
    // creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null; // Fetch if needed
    photos?: DailyLogPhoto[];
};

// Use partial schema for updates, as not all fields might be sent
const editDailyLogFormSchema = insertDailyLogSchema.partial().omit({
    // Fields set by backend or immutable
    createdById: true,
    projectId: true, // projectId is in URL, not body for PUT
});
type EditDailyLogFormValues = z.infer<typeof editDailyLogFormSchema>;

// Define payload for the update mutation
type UpdateDailyLogPayload = {
    logId: number;
    logData: EditDailyLogFormValues;
};

interface EditDailyLogDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  logToEditId: number | null; // Pass the ID of the log to edit
  projectId: number;
  onSuccess?: () => void; // Optional callback on success
}

export function EditDailyLogDialog({
  isOpen,
  setIsOpen,
  logToEditId,
  projectId,
  onSuccess
}: EditDailyLogDialogProps) {
  const queryClient = useQueryClient();

  // Fetch the specific daily log details when the dialog opens, including photos
  // This ensures we have the latest data and associated photos
  const dailyLogQueryKey = [`/api/projects/${projectId}/daily-logs`, logToEditId];
  const {
      data: logDetails,
      isLoading: isLoadingLog,
      isError: isErrorLog,
      error: errorLog,
      isFetching: isFetchingLog,
  } = useQuery<DailyLogWithDetails>({ // Fetch the specific log
      queryKey: dailyLogQueryKey,
      queryFn: getQueryFn({ on401: "throw" }),
      enabled: isOpen && !!logToEditId, // Only fetch when dialog is open and ID is provided
      staleTime: 5 * 60 * 1000, // Consider data potentially stale after 5 mins
  });

  // Setup react-hook-form
  const form = useForm<EditDailyLogFormValues>({
    resolver: zodResolver(editDailyLogFormSchema),
    defaultValues: {
        // Initialize with empty/default values
        logDate: new Date(),
        weather: "",
        temperature: undefined,
        crewOnSite: "",
        workPerformed: "",
        issuesEncountered: "",
        safetyObservations: "",
    },
  });

  // Effect to reset form and populate with fetched log data
  useEffect(() => {
    if (isOpen && logDetails) {
      form.reset({
        logDate: logDetails.logDate ? new Date(logDetails.logDate) : new Date(), // Ensure Date object
        weather: logDetails.weather ?? "",
        temperature: logDetails.temperature ? parseFloat(logDetails.temperature) : undefined,
        crewOnSite: logDetails.crewOnSite ?? "",
        workPerformed: logDetails.workPerformed ?? "",
        issuesEncountered: logDetails.issuesEncountered ?? "",
        safetyObservations: logDetails.safetyObservations ?? "",
      });
    } else if (!isOpen) {
        // Optional: Reset form fully when closing
        form.reset({
            logDate: new Date(), weather: "", temperature: undefined, crewOnSite: "",
            workPerformed: "", issuesEncountered: "", safetyObservations: ""
        });
    }
  }, [isOpen, logDetails, form]); // Rerun when dialog opens or details load


  // Mutation hook for updating a daily log
  const updateDailyLogMutation = useMutation({
    mutationFn: ({ logId, logData }: UpdateDailyLogPayload) => {
       // Ensure logDate is in correct format if API expects string
        const apiData = {
           ...logData,
           logDate: logData.logDate ? new Date(logData.logDate).toISOString() : undefined,
        };
        // NOTE: This implementation does NOT handle photo uploads/deletions yet
      return apiRequest<DailyLog>('PUT', `/api/projects/${projectId}/daily-logs/${logId}`, apiData);
    },
    onSuccess: (updatedLog) => {
      toast({ title: "Success", description: "Daily log updated successfully." });
      // Invalidate the list query and the specific item query
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] });
      queryClient.invalidateQueries({ queryKey: dailyLogQueryKey }); // Invalidate specific log query
      setIsOpen(false); // Close dialog on success
      onSuccess?.(); // Call optional success callback
    },
    onError: (err) => {
      console.error("Error updating daily log:", err);
      toast({
        title: "Error Updating Log",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleFormSubmit = (values: EditDailyLogFormValues) => {
    if (!logToEditId) return;
    console.log("Submitting update:", values);
    updateDailyLogMutation.mutate({ logId: logToEditId, logData: values });
  };

  // Helper to render loading/error states within the dialog content
  const renderDialogContent = () => {
      if (!logToEditId) return null; // Should not happen if dialog opens correctly

      if (isLoadingLog || isFetchingLog) {
          return (
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
          return (
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
          // Should be covered by loading/error states, but as a fallback
          return <div className="py-4 text-center">Log details not available.</div>;
       }

      // Render the actual form once data is loaded
      return (
          <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3">
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
                      <FormField
                          control={form.control}
                          name="weather"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Weather</FormLabel>
                                  <FormControl>
                                      <Input placeholder="e.g., Sunny, Cloudy" {...field} value={field.value ?? ''} />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="temperature"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Temperature (°)</FormLabel>
                                  <FormControl>
                                      <Input
                                          type="number"
                                          step="any"
                                          placeholder="e.g., 72.5"
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
                  </div>

                  {/* Crew On Site */}
                  <FormField
                      control={form.control}
                      name="crewOnSite"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Crew On Site</FormLabel>
                              <FormControl>
                                  <Input placeholder="List crew present" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                  {/* Work Performed */}
                  <FormField
                      control={form.control}
                      name="workPerformed"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Work Performed*</FormLabel>
                              <FormControl>
                                  <Textarea
                                      placeholder="Describe work completed..."
                                      className="min-h-[100px]"
                                      {...field}
                                  />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                  {/* Issues Encountered */}
                  <FormField
                      control={form.control}
                      name="issuesEncountered"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Issues Encountered</FormLabel>
                              <FormControl>
                                  <Textarea
                                      placeholder="Describe issues or delays (optional)"
                                      className="min-h-[80px]"
                                      {...field}
                                      value={field.value ?? ''}
                                  />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                  {/* Safety Observations */}
                  <FormField
                      control={form.control}
                      name="safetyObservations"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Safety Observations</FormLabel>
                              <FormControl>
                                  <Textarea
                                      placeholder="Note safety observations (optional)"
                                      className="min-h-[80px]"
                                      {...field}
                                      value={field.value ?? ''}
                                  />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />

                   {/* Display Existing Photos (Read-only for now) */}
                  {logDetails.photos && logDetails.photos.length > 0 && (
                      <FormItem>
                          <FormLabel>Existing Photos</FormLabel>
                           <div className="mt-1 flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
                              {logDetails.photos.map((photo) => (
                                  <div key={photo.id} className="relative group w-20 h-20 border rounded p-1 flex flex-col items-center justify-center bg-background">
                                      <img
                                          src={photo.photoUrl}
                                          alt={photo.caption || 'Existing photo'}
                                          className="max-h-full max-w-full object-contain"
                                          title={photo.caption || photo.photoUrl.split('/').pop()} // Show caption or filename
                                      />
                                      {/* TODO: Add delete button here later */}
                                      {/* <button type="button" className="absolute ...">X</button> */}
                                  </div>
                              ))}
                          </div>
                           <FormDescription>
                              Photo editing (add/remove) is not implemented in this version.
                           </FormDescription>
                      </FormItem>
                  )}

                  {/* TODO: Add file input here later for adding new photos */}


                  {/* Form Buttons */}
                  <DialogFooter className="pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                          Cancel
                      </Button>
                      <Button type="submit" disabled={updateDailyLogMutation.isPending || isFetchingLog}>
                          {updateDailyLogMutation.isPending ? (
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
               Modify the details for the log dated {logDetails?.logDate ? formatDate(logDetails.logDate, "PPP") : '...'}.
           </DialogDescription>
        </DialogHeader>

        {renderDialogContent()}

      </DialogContent>
    </Dialog>
  );
}