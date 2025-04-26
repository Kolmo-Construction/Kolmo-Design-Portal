import React from 'react';
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProjectFormFields } from "./ProjectFormFields"; // Keep this import

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

  const createProjectMutation = useMutation({
    // The input type for mutationFn should match the form values type
    mutationFn: async (data: CreateProjectFormValues) => {
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
      };
      // Ensure progress and actualCompletionDate are not sent if omitted by schema
      delete (formattedValues as any).progress;
      delete (formattedValues as any).actualCompletionDate;

      console.log("Submitting Create Project:", formattedValues);
      // API endpoint expects all potential fields from InsertProject, even if undefined
      const res = await apiRequest("POST", "/api/projects", formattedValues as any); // Use 'as any' carefully or create a backend DTO
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      onOpenChange(false); // Close dialog
      form.reset(); // Reset form
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
  const onSubmit = (values: CreateProjectFormValues) => {
    // Validation is already handled by the Zod resolver before this runs
    createProjectMutation.mutate(values);
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
            {/* ProjectFormFields expects the base ProjectFormValues type,
                which is compatible since CreateProjectFormValues is a subset */}
            <ProjectFormFields
              form={form as any} // Use 'as any' or ensure compatible types
              projectManagers={projectManagers}
              isLoadingManagers={isLoadingManagers}
              disabled={createProjectMutation.isPending}
              isEditMode={false} // Explicitly false
            />
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}