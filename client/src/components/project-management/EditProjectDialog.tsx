import React, { useEffect } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// Import the shared schema and type for EDIT
import { editProjectFormSchema, EditProjectFormValues } from '@/lib/validations'; // Adjust path if needed

import { Project, User } from "@shared/schema"; // Keep these imports
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProjectFormFields } from "./ProjectFormFields"; // Keep this import

interface EditProjectDialogProps {
  project: Project | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectManagers: User[];
  isLoadingManagers: boolean;
}

export function EditProjectDialog({
  project,
  isOpen,
  onOpenChange,
  projectManagers,
  isLoadingManagers,
}: EditProjectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use the imported EDIT schema and type
  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectFormSchema),
     // Default values will be overwritten by useEffect when project is loaded
     defaultValues: {
        name: "", description: "", address: "", city: "", state: "",
        zipCode: "", status: "planning", totalBudget: "", progress: 0,
        projectManagerId: undefined, imageUrl: "", startDate: undefined,
        estimatedCompletionDate: undefined, actualCompletionDate: undefined,
     }
  });

   // Effect to reset form when the project prop changes (dialog opens/switches project)
   useEffect(() => {
    if (project && isOpen) {
      // Reset with values from the project, matching the Edit form schema
      form.reset({
        name: project.name,
        description: project.description ?? "",
        address: project.address,
        city: project.city,
        state: project.state,
        zipCode: project.zipCode,
        status: project.status,
        totalBudget: project.totalBudget?.toString() ?? "",
        progress: project.progress ?? 0,
        imageUrl: project.imageUrl ?? "",
        // Ensure dates are Date objects or undefined for the form
        startDate: project.startDate ? new Date(project.startDate) : undefined,
        estimatedCompletionDate: project.estimatedCompletionDate ? new Date(project.estimatedCompletionDate) : undefined,
        actualCompletionDate: project.actualCompletionDate ? new Date(project.actualCompletionDate) : undefined,
        projectManagerId: project.projectManagerId ?? undefined,
      });
    } else if (!isOpen) {
         form.reset({ // Reset with default structure for Edit form
            name: "", description: "", address: "", city: "", state: "",
            zipCode: "", status: "planning", totalBudget: "", progress: 0,
            projectManagerId: undefined, imageUrl: "", startDate: undefined,
            estimatedCompletionDate: undefined, actualCompletionDate: undefined,
         });
     }
   }, [project, form, isOpen]);


  const editProjectMutation = useMutation({
    // Input type for mutationFn should match the form values type
    mutationFn: async (data: { id: number; project: EditProjectFormValues }) => {
        // Format data before sending
        const cleanedBudget = String(data.project.totalBudget).replace(/[$,]/g, ''); // Clean the string
        const formattedValues = {
            ...data.project,
             // --- MODIFIED: Send cleaned budget as STRING ---
            totalBudget: cleanedBudget,
            // ---------------------------------------------
            // Format dates if they exist
            startDate: data.project.startDate ? new Date(data.project.startDate).toISOString() : undefined,
            estimatedCompletionDate: data.project.estimatedCompletionDate ? new Date(data.project.estimatedCompletionDate).toISOString() : undefined,
            actualCompletionDate: data.project.actualCompletionDate ? new Date(data.project.actualCompletionDate).toISOString() : undefined,
            // Ensure PM ID is number or undefined
            projectManagerId: data.project.projectManagerId ? Number(data.project.projectManagerId) : undefined,
        };
        // Ensure clientIds is not sent if omitted by schema
        delete (formattedValues as any).clientIds;

        console.log("Submitting Edit Project:", formattedValues);
        // API endpoint expects all potential fields from InsertProject
        const res = await apiRequest("PUT", `/api/projects/${data.id}`, formattedValues as any); // Use 'as any' carefully or create a backend DTO
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onOpenChange(false); // Close dialog
      toast({
        title: "Project updated",
        description: "Project details have been successfully updated.",
      });
    },
    onError: (error: Error) => {
       console.error("Edit project error:", error);
        // Attempt to parse backend error message if available
       let description = "An unexpected error occurred.";
       try {
           // Assuming the error message might contain the JSON string from the backend
           const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
           description = errorBody.errors?.[0]?.message || errorBody.message || description;
       } catch (e) { /* Ignore parsing error */ }

       toast({
         title: "Failed to update project",
         description: description,
         variant: "destructive",
       });
    },
  });

  // Use the specific form type here
  const onSubmit = (values: EditProjectFormValues) => {
    if (!project) return;
    // Validation is already handled by the Zod resolver before this runs
    editProjectMutation.mutate({ id: project.id, project: values });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project: {project?.name ?? 'Loading...'}</DialogTitle>
          <DialogDescription>
            Update the details of the selected project.
          </DialogDescription>
        </DialogHeader>
         {/* Only render form if project is loaded */}
         {project && (
             // Pass the correctly typed form down
             <Form {...form}>
                 {/* Ensure the type passed to handleSubmit matches the form */}
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                    {/* ProjectFormFields expects the base ProjectFormValues type,
                        which is compatible since EditProjectFormValues is a subset */}
                    <ProjectFormFields
                        form={form as any} // Use 'as any' or ensure compatible types
                        projectManagers={projectManagers}
                        isLoadingManagers={isLoadingManagers}
                        disabled={editProjectMutation.isPending}
                        isEditMode={true} // Explicitly true
                    />
                    <DialogFooter className="pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={editProjectMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={editProjectMutation.isPending}
                    >
                        {editProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Project
                    </Button>
                    </DialogFooter>
                </form>
            </Form>
         )}
      </DialogContent>
    </Dialog>
  );
}