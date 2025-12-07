import React, { useEffect, useState } from 'react';
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
// --- CORRECTION: Import Project types, not Task ---
import { Project, InsertProject, insertProjectSchema, User } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import mutation hooks
import { getQueryFn, apiRequest } from "@/lib/queryClient"; // Import query helpers
import { uploadToR2 } from "@/lib/upload"; // Import upload function
import { useToast } from "@/hooks/use-toast";
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
import { CalendarIcon, Loader2, Save, X } from "lucide-react"; // Import Save icon, X icon
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast"; // Import toast
// --- ADDED: Import ProjectFormFields ---
import { ProjectFormFields } from './ProjectFormFields'; // Assuming it's in the same directory
// --- END ADDED ---

// --- CORRECTION: Use Project types ---
// Define the type for the update mutation payload
type UpdateProjectPayload = {
    projectId: number;
    projectData: Partial<InsertProject>; // Use Partial for updates
};

interface EditProjectDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectToEdit: Project | null; // Pass the project object to edit
  // --- ADDED: Pass managers data ---
  projectManagers: User[];
  isLoadingManagers: boolean;
  // --- END ADDED ---
}

// --- CORRECTION: Use project schema ---
// Use partial schema for updates, as not all fields might be sent
const editProjectFormSchema = insertProjectSchema.partial();
// Define the type based on the schema for form handling
type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;


// --- CORRECTION: Rename function to EditProjectDialog ---
export function EditProjectDialog({
  isOpen,
  setIsOpen,
  projectToEdit,
  // --- ADDED: Receive managers props ---
  projectManagers,
  isLoadingManagers
  // --- END ADDED ---
}: EditProjectDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Image upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- REMOVED: Assignee query (handled by ProjectFormFields) ---

  // Setup react-hook-form with partial Zod validation for edits
  // --- CORRECTION: Use EditProjectFormValues ---
  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectFormSchema),
    defaultValues: { // Set defaults, will be overridden by useEffect
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      status: "planning",
      totalBudget: undefined, // Use number or string based on schema/form needs
      progress: 0,
      projectManagerId: null,
      imageUrl: "",
      startDate: undefined,
      estimatedCompletionDate: undefined,
      actualCompletionDate: undefined,
      // clientIds: [], // clientIds are part of the base schema but maybe not edited here directly
    },
  });

  // Effect to reset form and populate with project data when dialog opens or project changes
  useEffect(() => {
    if (isOpen && projectToEdit) {
      // Reset form with values from the projectToEdit prop
      form.reset({
        name: projectToEdit.name ?? "",
        description: projectToEdit.description ?? "",
        address: projectToEdit.address ?? "",
        city: projectToEdit.city ?? "",
        state: projectToEdit.state ?? "",
        zipCode: projectToEdit.zipCode ?? "",
        status: projectToEdit.status ?? "planning",
        // Convert budget back to string for input if needed, or handle number directly
        totalBudget: projectToEdit.totalBudget?.toString() ?? "",
        progress: projectToEdit.progress ?? 0,
        imageUrl: projectToEdit.imageUrl ?? "",
        // Ensure dates are Date objects for the form state if they exist
        startDate: projectToEdit.startDate ? new Date(projectToEdit.startDate) : undefined,
        estimatedCompletionDate: projectToEdit.estimatedCompletionDate ? new Date(projectToEdit.estimatedCompletionDate) : undefined,
        actualCompletionDate: projectToEdit.actualCompletionDate ? new Date(projectToEdit.actualCompletionDate) : undefined,
        projectManagerId: projectToEdit.projectManagerId ?? null,
        // clientIds: projectToEdit.clientIds ?? [], // Handle if editing client assignments here
      });
    } else if (!isOpen) {
        // Optionally reset to empty defaults when closing
        // form.reset({ name: "", ... });
    }
  }, [isOpen, projectToEdit, form]);

  // Image upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPEG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      // Clear the file input value to allow selecting the same file again
      e.target.value = '';
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    setIsUploading(true);
    try {
      const imageUrl = await uploadToR2(selectedFile);
      // Update the form field with the uploaded URL
      form.setValue('imageUrl', imageUrl);
      toast({
        title: "Image uploaded",
        description: "Project image has been uploaded successfully.",
      });
      return imageUrl;
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // --- CORRECTION: Update Project Mutation ---
  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, projectData }: UpdateProjectPayload) => {
      // Prepare data: Convert dates to ISO strings, ensure budget is string/number as API expects
      const cleanedBudget = String(projectData.totalBudget).replace(/[$,]/g, ''); // Clean budget string
      const formattedValues = {
          ...projectData,
          totalBudget: cleanedBudget, // Send cleaned string or parsed number based on API
          startDate: projectData.startDate ? new Date(projectData.startDate).toISOString() : undefined,
          estimatedCompletionDate: projectData.estimatedCompletionDate ? new Date(projectData.estimatedCompletionDate).toISOString() : undefined,
          actualCompletionDate: projectData.actualCompletionDate ? new Date(projectData.actualCompletionDate).toISOString() : undefined,
          projectManagerId: projectData.projectManagerId ? Number(projectData.projectManagerId) : undefined,
      };
       // Remove clientIds if it's not meant to be updated here
      delete (formattedValues as any).clientIds;

      return apiRequest('PUT', `/api/projects/${projectId}`, formattedValues); // Use projectId from props
    },
    onSuccess: (_, variables) => { // variables contains { projectId, projectData }
      toast({ title: "Success", description: "Project updated successfully." });
      // Invalidate the specific project query and the list query
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.projectId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects`] });
      setIsOpen(false); // Close dialog on success
    },
    onError: (err) => {
      console.error("Error updating project:", err);
      toast({
        title: "Error Updating Project",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });


  // Handle form submission
  // --- CORRECTION: Use EditProjectFormValues ---
  const handleFormSubmit = async (values: EditProjectFormValues) => {
    if (!projectToEdit) return;

    // Upload image if one is selected
    if (selectedFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        values.imageUrl = uploadedUrl;
      }
    }

    console.log("Submitting update:", values);
    // The mutationFn now handles formatting, just pass the form values
    updateProjectMutation.mutate({ projectId: projectToEdit.id, projectData: values });
  };

  return (
    // Dialog setup remains the same
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* --- MODIFIED: Increased max-width and added overflow handling --- */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {/* Update Title */}
          <DialogTitle>Edit Project: {projectToEdit?.name ?? 'Loading...'}</DialogTitle>
          <DialogDescription>
            Modify the details for this project.
          </DialogDescription>
        </DialogHeader>

        {/* --- MODIFIED: Use ProjectFormFields --- */}
        {/* Only render form if projectToEdit is available */}
        {projectToEdit ? (
            <Form {...form}>
            {/* Pass validated data to handleFormSubmit */}
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 pt-4">
                 {/* Use the reusable ProjectFormFields component */}
                 <ProjectFormFields
                    // Pass the form object, casting if necessary or ensuring types match
                    form={form as any}
                    projectManagers={projectManagers}
                    isLoadingManagers={isLoadingManagers}
                    disabled={updateProjectMutation.isPending}
                    isEditMode={true} // Explicitly indicate edit mode
                    // Image upload props
                    selectedFile={selectedFile}
                    setSelectedFile={setSelectedFile}
                    imagePreview={imagePreview}
                    setImagePreview={setImagePreview}
                    isUploading={isUploading}
                    onFileChange={handleFileChange}
                    onRemoveFile={removeSelectedFile}
                 />

                {/* Form Buttons */}
                <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={updateProjectMutation.isPending || isLoadingManagers}>
                        {updateProjectMutation.isPending ? (
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
            // Show loading or error if project data isn't ready
            <div className="py-4 text-center text-muted-foreground">Loading project data...</div>
        )}
         {/* --- END MODIFIED --- */}
      </DialogContent>
    </Dialog>
  );
}
