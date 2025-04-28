// client/src/hooks/useDocumentUpload.ts
import { useMutation, useQueryClient, QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Document } from "@shared/schema"; // Type returned by the API on success

// Define the expected structure returned by the hook
// Includes the mutation object itself for full access to status, etc.
interface UseDocumentUploadResult {
    uploadMutation: ReturnType<typeof useMutation<Document, Error, FormData>>;
}

/**
 * Custom hook for handling document uploads for a specific project.
 * Encapsulates the mutation logic, including API call, toast notifications,
 * and query invalidation.
 *
 * @param projectId - The ID of the project to upload the document to.
 * @returns An object containing the Tanstack Query mutation object.
 */
export function useDocumentUpload(projectId: number): UseDocumentUploadResult {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Define query keys for invalidation
    const projectDocsQueryKey: QueryKey = ['projects', projectId, 'documents'];
    const globalDocsQueryKey: QueryKey = ['documents']; // If you have a global list

    const uploadMutation = useMutation<Document, Error, FormData>({
        mutationFn: async (formData: FormData) => {
            const apiUrl = `/api/projects/${projectId}/documents`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
                // Let the browser set the Content-Type header for FormData
            });

            if (!response.ok) {
                let errorMsg = 'Failed to upload document.';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || `Upload failed with status: ${response.status}`;
                } catch (e) {
                    errorMsg = `Upload failed with status: ${response.status}`;
                }
                throw new Error(errorMsg);
            }

            return response.json() as Promise<Document>; // Return the created document record
        },
        onSuccess: (data) => {
            // Toast notification is handled here
            toast({
                title: "Success!",
                description: `Document "${data.name || 'file'}" uploaded successfully.`, // Use name from returned data
            });

            // Query invalidation is handled here
            queryClient.invalidateQueries({ queryKey: projectDocsQueryKey });
            queryClient.invalidateQueries({ queryKey: globalDocsQueryKey });
        },
        onError: (error: Error) => {
            // Error toast notification is handled here
            toast({
                title: "Upload Failed",
                description: error.message || "An unexpected error occurred.",
                variant: "destructive",
            });
        },
    });

    return {
        uploadMutation,
    };
}