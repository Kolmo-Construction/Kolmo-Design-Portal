// Suggested path: client/src/components/UploadDocumentForm.tsx
import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button'; //
import { Input } from '@/components/ui/input';   //
import { Label } from '@/components/ui/label';   //
import { Textarea } from '@/components/ui/textarea'; //
import { useToast } from '@/hooks/use-toast'; //
// If using Zod for text field validation (optional):
// import { z } from "zod";
// import { zodResolver } from '@hookform/resolvers/zod';

// Define the shape of your textual form data
interface FormInputData {
  name: string;
  description: string;
  category: string;
}

/* // Optional: Zod schema if you want validation for text fields
const formSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});
*/

interface UploadDocumentFormProps {
  projectId: number;
  onUploadSuccess?: () => void; // Optional callback after successful upload (e.g., close dialog)
}

export function UploadDocumentForm({ projectId, onUploadSuccess }: UploadDocumentFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInputData>({
    // resolver: zodResolver(formSchema), // Uncomment if using Zod schema
    defaultValues: { // Set default values for optional fields
        name: "",
        description: "",
        category: ""
    }
  });

  // Setup the mutation using Tanstack Query
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // The API endpoint from your routes.ts
      const apiUrl = `/api/projects/${projectId}/documents`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        // IMPORTANT: Do NOT manually set the 'Content-Type': 'multipart/form-data' header here.
        // 'fetch' with FormData automatically sets the correct Content-Type with the boundary.
      });

      // Check for API errors
      if (!response.ok) {
        let errorMsg = 'Failed to upload document.';
        try {
            // Try to parse specific error message from backend
            const errorData = await response.json();
            errorMsg = errorData.message || `Upload failed with status: ${response.status}`;
        } catch (e) {
            errorMsg = `Upload failed with status: ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      // Return the data from the API (the newly created document record)
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `Document "${selectedFile?.name || 'file'}" uploaded successfully.`,
      });

      // Invalidate queries to refetch data after successful upload
      // Adjust query keys based on how you fetch documents
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'documents'] }); // For specific project documents
      queryClient.invalidateQueries({ queryKey: ['documents'] }); // For the global document center list

      // Reset the form state
      reset();
      setSelectedFile(null);
      // Manually clear the file input visually if needed (can be tricky)
      const fileInput = document.getElementById('documentFile') as HTMLInputElement;
      if (fileInput) {
          fileInput.value = '';
      }

      setIsUploading(false);

      // Call the success callback if provided
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    },
    onError: (error: Error) => {
        // Display error toast using the error message from the mutationFn
        toast({
            title: "Upload Failed",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
        });
        setIsUploading(false);
    },
  });

  // Handle changes to the file input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        // Basic client-side validation (optional, backend validation is primary)
        // Example: Size Check (match backend limit)
        const maxSize = 15 * 1024 * 1024; // 15MB (same as backend)
        if (file.size > maxSize) {
             toast({
                title: "File Too Large",
                description: `File size cannot exceed ${maxSize / 1024 / 1024}MB.`,
                variant: "destructive",
            });
            setSelectedFile(null);
            event.target.value = ''; // Clear the input
            return;
        }
        // Example: Type Check (can be less reliable than backend check)
        // const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', ...];
        // if (!allowedTypes.includes(file.type)) { ... }

      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  // Handle form submission
  const onSubmit: SubmitHandler<FormInputData> = (data) => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    // Construct the FormData object
    const formData = new FormData();
    // CRITICAL: The key 'documentFile' MUST match upload.single('documentFile') in routes.ts
    formData.append('documentFile', selectedFile);

    // Append other optional fields if they have values
    if (data.name?.trim()) formData.append('name', data.name.trim());
    if (data.description?.trim()) formData.append('description', data.description.trim());
    if (data.category?.trim()) formData.append('category', data.category.trim());

    // Trigger the mutation
    uploadMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* File Input */}
      <div className="space-y-1">
        <Label htmlFor="documentFile">Document File*</Label>
        <Input
          id="documentFile"
          type="file"
          onChange={handleFileChange}
          // HTML 'required' attribute is good for basic check, but JS check before submit is better
          disabled={isUploading}
          className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
        {selectedFile && <p className="text-sm text-muted-foreground pt-1">Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
        {!selectedFile && <p className="text-sm text-destructive pt-1">Please select a file.</p>}
      </div>

      {/* Document Name Input */}
      <div className="space-y-1">
        <Label htmlFor="name">Document Name (Optional)</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Leave blank to use filename"
          disabled={isUploading}
        />
         {/* TODO: Add error display from react-hook-form if using Zod validation */}
      </div>

      {/* Description Input */}
      <div className="space-y-1">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Add a short description..."
          rows={3}
          disabled={isUploading}
        />
         {/* TODO: Add error display if using Zod validation */}
      </div>

      {/* Category Input */}
       <div className="space-y-1">
        <Label htmlFor="category">Category (Optional)</Label>
        <Input
          id="category"
          {...register("category")}
          placeholder="e.g., Contract, Invoice, Blueprint"
          disabled={isUploading}
        />
         {/* TODO: Add error display if using Zod validation */}
      </div>

      {/* Submit Button */}
      <Button
          type="submit"
          disabled={isUploading || !selectedFile || uploadMutation.isPending}
          className="w-full"
      >
        {isUploading ? 'Uploading...' : 'Upload Document'}
      </Button>
    </form>
  );
}