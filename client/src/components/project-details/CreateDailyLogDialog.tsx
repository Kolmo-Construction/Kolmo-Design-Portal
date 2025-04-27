import React, { useState, useRef } from 'react';
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
import { InsertDailyLog, insertDailyLogSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query"; // Import mutation hooks
import { apiRequest } from "@/lib/queryClient"; // Import query helpers
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
import { CalendarIcon, Loader2, PlusCircle, UploadCloud, X, ImageIcon } from "lucide-react"; // Import icons
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast"; // Import toast
import { z } from "zod"; // Import z

// Define the form values type, explicitly including the file list which isn't in InsertDailyLog
type DailyLogFormValues = z.infer<typeof insertDailyLogSchema> & {
    logPhotos?: FileList | null; // For handling file input
};

interface CreateDailyLogDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: number;
  onSuccess?: () => void; // Optional callback on success
}

export function CreateDailyLogDialog({
  isOpen,
  setIsOpen,
  projectId,
  onSuccess
}: CreateDailyLogDialogProps) {
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for clearing file input

  // Setup react-hook-form with Zod validation
  // Use the Zod schema directly, file input handled separately
  const form = useForm<DailyLogFormValues>({
    resolver: zodResolver(insertDailyLogSchema),
    defaultValues: {
      projectId: projectId, // Pre-fill projectId (won't be sent in body)
      logDate: new Date(), // Default to today
      weather: "",
      temperature: undefined,
      crewOnSite: "",
      workPerformed: "",
      issuesEncountered: "",
      safetyObservations: "",
      // createdById is set on the backend
    },
  });

  // Reset form when dialog opens or closes
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        projectId: projectId,
        logDate: new Date(),
        weather: "",
        temperature: undefined,
        crewOnSite: "",
        workPerformed: "",
        issuesEncountered: "",
        safetyObservations: "",
        logPhotos: null, // Reset file input state
      });
      setSelectedFiles([]); // Clear selected files preview
      if (fileInputRef.current) {
         fileInputRef.current.value = ""; // Attempt to clear file input visually
      }
    }
  }, [isOpen, projectId, form]);

  // Mutation hook for creating a daily log (using FormData)
  const createDailyLogMutation = useMutation({
    mutationFn: async (data: { formValues: DailyLogFormValues, files: File[] }) => {
      console.log("Starting fetch request to create daily log");
      
      try {
        const { formValues, files } = data;
        console.log("Form values:", formValues);
        console.log("Files:", files.map(f => f.name));
        
        // Create FormData
        const formData = new FormData();
        
        // Append text fields
        formData.append('logDate', new Date(formValues.logDate!).toISOString());
        if (formValues.weather) formData.append('weather', formValues.weather);
        if (formValues.temperature !== undefined && formValues.temperature !== null) {
          formData.append('temperature', formValues.temperature.toString());
        }
        if (formValues.crewOnSite) formData.append('crewOnSite', formValues.crewOnSite);
        formData.append('workPerformed', formValues.workPerformed);
        if (formValues.issuesEncountered) formData.append('issuesEncountered', formValues.issuesEncountered);
        if (formValues.safetyObservations) formData.append('safetyObservations', formValues.safetyObservations);
        
        // Append files
        files.forEach(file => {
          formData.append('photos', file, file.name);
        });
        
        const url = `/api/projects/${projectId}/daily-logs`;
        console.log(`Submitting to URL: ${url}`);
        
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          credentials: 'include', // Include cookies for authentication
        });
        
        console.log(`Response status: ${response.status}`);
        
        // Get response text regardless of status to see what's returned
        const responseText = await response.text();
        console.log(`Response text: ${responseText}`);
        
        // If not OK, throw an error with the response
        if (!response.ok) {
          let errorData;
          try {
            errorData = JSON.parse(responseText);
          } catch (e) {
            errorData = { message: responseText || response.statusText };
          }
          throw new Error(errorData.message || `Failed to create log: ${response.status}`);
        }
        
        // If OK, parse response as JSON
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.error("Error parsing JSON response:", e);
          responseData = { message: "Success but could not parse response" };
        }
        
        return responseData;
      } catch (error) {
        console.error("Caught error in mutation:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Create daily log success:", data);
      toast({ title: "Success", description: "Daily log submitted successfully." });
      // Invalidate the daily logs query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/daily-logs`] });
      setIsOpen(false); // Close dialog on success
      onSuccess?.(); // Call optional success callback
    },
    onError: (err) => {
      console.error("Error creating daily log:", err);
      toast({
        title: "Error Submitting Log",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });

  // Handle file selection changes
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // Convert FileList to Array and add to existing selections
      const newFiles = Array.from(event.target.files);
      // You might want to add checks for file size, type, and total number of files here
      setSelectedFiles(prev => [...prev, ...newFiles].slice(0, 5)); // Limit to 5 files example
    }
  };

  // Remove a selected file from the preview
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Also clear the actual file input if needed (can be tricky)
    if (fileInputRef.current) {
        // This doesn't easily remove specific files, just clears all
        // A more complex state management might be needed for fine-grained control
        fileInputRef.current.value = "";
    }
  };

  // Handle form submission
  const handleFormSubmit = (values: DailyLogFormValues) => {
    console.log("Form values submitted:", values);
    console.log("Selected files:", selectedFiles.map(f => f.name));
    
    // Trigger the mutation with form values and files
    createDailyLogMutation.mutate({
      formValues: values,
      files: selectedFiles
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]"> {/* Wider dialog */}
        <DialogHeader>
          <DialogTitle>Create New Daily Log</DialogTitle>
          <DialogDescription>
            Submit a daily report for this project. Include details and photos.
          </DialogDescription>
        </DialogHeader>

        {/* Form implementation */}
        <Form {...form}>
          {/* Pass validated data to handleFormSubmit */}
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
                          className={cn(
                            "pl-3 text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? formatDate(field.value, "PPP") // Use imported formatDate
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
                        onSelect={(date) => field.onChange(date)} // RHF handles Date object
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
                        <Input placeholder="e.g., Sunny, Cloudy, Rain" {...field} value={field.value ?? ''} />
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
                          step="any" // Allow decimals
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
                    <Input placeholder="List crew members or trades present" {...field} value={field.value ?? ''} />
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
                      placeholder="Describe the work completed today..."
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
                      placeholder="Describe any issues, delays, or blockers (optional)"
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
                      placeholder="Note any safety concerns or positive observations (optional)"
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload */}
            <FormItem>
                <FormLabel>Attach Photos (Optional, up to 5)</FormLabel>
                <FormControl>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="relative overflow-hidden">
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Select Files
                            <Input
                                ref={fileInputRef} // Assign ref
                                id="logPhotos"
                                type="file"
                                multiple // Allow multiple files
                                accept="image/*" // Accept only images
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" // Style to hide default input but keep functionality
                            />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {selectedFiles.length} file(s) selected
                        </span>
                    </div>
                </FormControl>
                 {/* File Preview */}
                 {selectedFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="relative group w-20 h-20 border rounded p-1 flex flex-col items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-muted-foreground mb-1" />
                                <p className="text-xs text-center truncate w-full" title={file.name}>{file.name}</p>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                    aria-label="Remove file"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                 )}
                <FormDescription>Attach relevant photos for this log entry.</FormDescription>
                <FormMessage /> {/* For potential file-related errors if implemented */}
            </FormItem>

            {/* Form Buttons */}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDailyLogMutation.isPending}>
                {createDailyLogMutation.isPending ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     Submitting...
                   </>
                ) : (
                   "Submit Daily Log"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>

      </DialogContent>
    </Dialog>
  );
}