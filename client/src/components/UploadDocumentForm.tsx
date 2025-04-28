// Suggested path: client/src/components/UploadDocumentForm.tsx
import React, { useState } from 'react'; // Keep useState for selectedFile
import { useForm, SubmitHandler } from 'react-hook-form';
// --- REMOVED: useMutation, useQueryClient imports (moved to hook) ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast'; // Keep for file validation toasts
// --- ADDED: Import the new hook ---
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
// --- END ADDED ---

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
  onUploadSuccess?: () => void; // Optional callback after successful upload
}

export function UploadDocumentForm({ projectId, onUploadSuccess }: UploadDocumentFormProps) {
  // --- REMOVED: queryClient retrieval ---
  const { toast } = useToast(); // Keep for local validation messages
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // --- REMOVED: isUploading state ---
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInputData>({
    // resolver: zodResolver(formSchema), // Uncomment if using Zod schema
    defaultValues: { name: "", description: "", category: "" }
  });

  // --- ADDED: Get upload mutation from the hook ---
  const { uploadMutation } = useDocumentUpload(projectId);
  // Destructure for convenience
  const { mutate: uploadDocument, isPending: isUploading } = uploadMutation;
  // --- END ADDED ---

  // --- REMOVED: useMutation definition ---

  // Handle changes to the file input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        // Basic client-side validation (optional, backend validation is primary)
        const maxSize = 15 * 1024 * 1024; // 15MB (match backend)
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

    // --- REMOVED: setIsUploading(true) ---

    // Construct the FormData object
    const formData = new FormData();
    formData.append('documentFile', selectedFile); // Key must match backend (multer)
    if (data.name?.trim()) formData.append('name', data.name.trim());
    if (data.description?.trim()) formData.append('description', data.description.trim());
    if (data.category?.trim()) formData.append('category', data.category.trim());

    // --- MODIFIED: Trigger the mutation from the hook ---
    uploadDocument(formData, {
        // Add component-specific callbacks here if needed
        onSuccess: (createdDocument) => {
            // Toast/Invalidation handled by hook's onSuccess
            console.log("Upload successful (component callback):", createdDocument);
            // Reset form state locally
            reset();
            setSelectedFile(null);
            const fileInput = document.getElementById('documentFile') as HTMLInputElement;
            if (fileInput) { fileInput.value = ''; }

            // Call the optional external callback
            if (onUploadSuccess) {
                onUploadSuccess();
            }
        },
        onError: (error) => {
            // Toast handled by hook's onError
            console.error("Upload failed (component callback):", error);
            // No need to setIsUploading(false) here, isPending handles it
        }
    });
    // --- END MODIFIED ---
  };

  return (
    // --- MODIFIED: Use isUploading from hook ---
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* File Input */}
      <div className="space-y-1">
        <Label htmlFor="documentFile">Document File*</Label>
        <Input
          id="documentFile"
          type="file"
          onChange={handleFileChange}
          disabled={isUploading} // Use isPending from hook
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
          disabled={isUploading} // Use isPending from hook
        />
         {/* TODO: Add error display if using Zod */}
      </div>

      {/* Description Input */}
      <div className="space-y-1">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Add a short description..."
          rows={3}
          disabled={isUploading} // Use isPending from hook
        />
         {/* TODO: Add error display if using Zod */}
      </div>

      {/* Category Input */}
       <div className="space-y-1">
        <Label htmlFor="category">Category (Optional)</Label>
        <Input
          id="category"
          {...register("category")}
          placeholder="e.g., Contract, Invoice, Blueprint"
          disabled={isUploading} // Use isPending from hook
        />
         {/* TODO: Add error display if using Zod */}
      </div>

      {/* Submit Button */}
      <Button
          type="submit"
          disabled={isUploading || !selectedFile} // Use isPending from hook
          className="w-full"
      >
        {isUploading ? 'Uploading...' : 'Upload Document'}
      </Button>
    </form>
    // --- END MODIFIED ---
  );
}