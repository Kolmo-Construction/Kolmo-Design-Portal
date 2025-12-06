import React, { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// Import the shared schema and type for CREATE
import { createProjectFormSchema, CreateProjectFormValues } from '@/lib/validations'; // Adjust path if needed

import { User } from "@shared/schema"; // Keep User import
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProjectFormFields } from "./ProjectFormFields"; // Keep this import
import { uploadToR2 } from "@/lib/upload";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectManagers: User[];
  isLoadingManagers: boolean;
}

export function CreateProjectDialog({
  isOpen,
  onOpenChange,
  projectManagers,
  isLoadingManagers,
}: CreateProjectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Use the imported CREATE schema and type
  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      status: "planning",
      totalBudget: "", // Keep as string initially
      projectManagerId: undefined,
      imageUrl: "",
      startDate: undefined,
      estimatedCompletionDate: undefined,
      clientIds: [],
    },
  });

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
    // Don't clear the imageUrl field here, as user might have entered a URL manually
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

  const createProjectMutation = useMutation({
    // The input type for mutationFn should match the form values type
    mutationFn: async (data: CreateProjectFormValues & { imageUrl?: string }) => {
      // Format data before sending
       const cleanedBudget = String(data.totalBudget).replace(/[$,]/g, ''); // Clean the string
       const formattedValues = {
        ...data,
        // --- MODIFIED: Send cleaned budget as STRING ---
        totalBudget: cleanedBudget,
        // ---------------------------------------------
        // Format dates if they exist
        startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
        estimatedCompletionDate: data.estimatedCompletionDate ? new Date(data.estimatedCompletionDate).toISOString() : undefined,
        // Ensure PM ID is number or undefined
        projectManagerId: data.projectManagerId ? Number(data.projectManagerId) : undefined,
        clientIds: data.clientIds || [], // Ensure clientIds is an array
        // Include imageUrl if available
        imageUrl: data.imageUrl || '',
      };
      // Ensure progress and actualCompletionDate are not sent if omitted by schema
      delete (formattedValues as any).progress;
      delete (formattedValues as any).actualCompletionDate;

      console.log("Submitting Create Project:", formattedValues);
      // API endpoint expects all potential fields from InsertProject, even if undefined
      // apiRequest already returns parsed JSON data
      const res = await apiRequest("POST", "/api/projects", formattedValues as any);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onOpenChange(false); // Close dialog
      form.reset(); // Reset form
      // Clean up preview URL
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setSelectedFile(null);
      setImagePreview(null);
      toast({
        title: "Project created",
        description: "New project has been successfully created.",
      });
    },
    onError: (error: Error) => {
      console.error("Create project error:", error);
      // Attempt to parse backend error message if available
      let description = "An unexpected error occurred.";
      try {
          // Assuming the error message might contain the JSON string from the backend
          const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
          description = errorBody.errors?.[0]?.message || errorBody.message || description;
      } catch (e) { /* Ignore parsing error */ }

      toast({
        title: "Failed to create project",
        description: description,
        variant: "destructive",
      });
    },
  });

  // Use the specific form type here
  const onSubmit = async (values: CreateProjectFormValues) => {
    // First upload image if selected
    let uploadedImageUrl = values.imageUrl;
    
    if (selectedFile) {
      const url = await uploadImage();
      if (url) {
        uploadedImageUrl = url;
      } else {
        // Don't proceed if image upload failed
        return;
      }
    }
    
    // Validation is already handled by the Zod resolver before this runs
    createProjectMutation.mutate({ ...values, imageUrl: uploadedImageUrl });
  };

   // Reset form when dialog closes
   React.useEffect(() => {
    if (!isOpen) {
      // Reset with default values for the create form schema
       form.reset({
            name: "", description: "", address: "", city: "", state: "", zipCode: "",
            status: "planning", totalBudget: "", projectManagerId: undefined,
            imageUrl: "", startDate: undefined, estimatedCompletionDate: undefined,
            clientIds: [],
       });
      // Clean up preview URL
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      setSelectedFile(null);
      setImagePreview(null);
    }
  }, [isOpen, form]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new construction or renovation project to the system.
          </DialogDescription>
        </DialogHeader>
        {/* Pass the correctly typed form down */}
        <Form {...form}>
          {/* Ensure the type passed to handleSubmit matches the form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* Image Upload Section */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-slate-600">Project Image</div>
              <div className="flex flex-col gap-4">
                {/* File Input */}
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('project-image-upload')?.click()}
                    disabled={isUploading || createProjectMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {selectedFile ? 'Change Image' : 'Upload Image'}
                  </Button>
                  <input
                    id="project-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading || createProjectMutation.isPending}
                  />
                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeSelectedFile}
                      disabled={isUploading || createProjectMutation.isPending}
                      className="flex items-center gap-2 text-destructive"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                  {isUploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </div>
                  )}
                </div>
                
                {/* Preview */}
                {imagePreview && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                    <div className="relative w-full max-w-xs h-48 border rounded-md overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                
                {/* URL Input as alternative to upload */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-600">Or enter image URL</div>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={form.watch('imageUrl') || ''}
                    onChange={(e) => form.setValue('imageUrl', e.target.value)}
                    disabled={isUploading || createProjectMutation.isPending}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide a direct image URL if you prefer not to upload a file.
                  </p>
                </div>
              </div>
            </div>

            {/* ProjectFormFields expects the base ProjectFormValues type,
                which is compatible since CreateProjectFormValues is a subset */}
            <ProjectFormFields
              form={form as any} // Use 'as any' or ensure compatible types
              projectManagers={projectManagers}
              isLoadingManagers={isLoadingManagers}
              disabled={createProjectMutation.isPending || isUploading}
              isEditMode={false} // Explicitly false
            />
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createProjectMutation.isPending || isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProjectMutation.isPending || isUploading}
              >
                {(createProjectMutation.isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
