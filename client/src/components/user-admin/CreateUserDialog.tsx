/* -------- client/src/components/user-admin/CreateUserDialog.txt -------- */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// REMOVED: z import
import { Project, User } from "@shared/schema";
// ADDED Imports for validation schema and type
import { newUserSchema, NewUserFormValues } from '@/lib/validations';
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-unified";
import { getQueryFn, apiRequest } from "@/lib/queryClient"; // Removed queryClient import as it's obtained via hook

import { Loader2, Copy, CheckCircle2, Trash2 } from "lucide-react";
import { CreateUserForm } from "./CreateUserForm";

// REMOVED: Local newUserSchema definition
// REMOVED: Local NewUserFormValues type definition

interface CreateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  emailConfigured: boolean;
  userToEdit?: User | null;
  onDeleteUser?: (user: User) => void;
}

export function CreateUserDialog({
  isOpen,
  onOpenChange,
  emailConfigured,
  userToEdit = null,
  onDeleteUser,
}: CreateUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!userToEdit;

  // Create or update user mutation
  const createOrUpdateMutation = useMutation({
    mutationFn: async (userData: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      accessScope: string;
      projectIds?: number[];
      phoneNumber?: string;
    }): Promise<{ magicLink?: string; user: any }> => {
      if (isEditMode && userToEdit) {
        // Update existing user
        return await apiRequest("PATCH", `/api/admin/users/${userToEdit.id}`, userData);
      } else {
        // Create new user with magic link
        return await apiRequest("POST", "/api/admin/create-magic-link", userData);
      }
    },
    onSuccess: () => {
      // Invalidate users list to refresh
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: isEditMode ? "Error updating user" : "Error creating user",
        description: error.message || (isEditMode ? "Failed to update user" : "Failed to create user and magic link"),
        variant: "destructive",
      });
    },
  });

  const [createdMagicLink, setCreatedMagicLink] = useState<string | null>(null);

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: userToEdit?.email || "",
      firstName: userToEdit?.firstName || "",
      lastName: userToEdit?.lastName || "",
      role: userToEdit?.role || "client",
      accessScope: userToEdit?.accessScope || "both",
      projectIds: userToEdit?.projectIds || [],
      phoneNumber: userToEdit?.phoneNumber || "",
      isActivated: userToEdit?.isActivated ?? false,
    },
  });

  // Reset form when userToEdit changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        email: userToEdit?.email || "",
        firstName: userToEdit?.firstName || "",
        lastName: userToEdit?.lastName || "",
        role: userToEdit?.role || "client",
        accessScope: userToEdit?.accessScope || "both",
        projectIds: userToEdit?.projectIds || [],
        phoneNumber: userToEdit?.phoneNumber || "",
        isActivated: userToEdit?.isActivated ?? false,
      });
      setCreatedMagicLink(null);
    }
  }, [isOpen, userToEdit, form]);

  // Fetch projects for assignment dropdown (when dialog is open and role is client or contractor)
  const selectedRole = form.watch("role");
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
  } = useQuery<Project[], Error>({
    queryKey: ["/api/projects"], // Use a consistent key
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen && (selectedRole === 'client' || selectedRole === 'contractor'), // Fetch for clients and contractors
  });

  const onSubmit = (data: NewUserFormValues) => {
    // Clear projectIds if role cannot be assigned to projects
    const submissionData = (data.role === 'client' || data.role === 'contractor')
      ? data
      : { ...data, projectIds: [] };

    createOrUpdateMutation.mutate(submissionData, {
      onSuccess: async (response) => {
        if (isEditMode) {
          // Edit mode: just show success and close
          toast({
            title: "User Updated",
            description: "User information has been updated successfully.",
          });
          // Force immediate refetch for user list
          await queryClient.refetchQueries({ queryKey: ["/api/admin/users"] });
          closeAndReset();
        } else {
          // Create mode: handle magic link
          console.log("Magic link mutation response:", response);
          console.log("Response type:", typeof response);
          console.log("Response keys:", Object.keys(response || {}));

          // Force immediate refetch of user list
          await queryClient.refetchQueries({ queryKey: ["/api/admin/users"] });

          // Check if response has magicLink property
          if (response && response.magicLink) {
            console.log("Setting magic link:", response.magicLink);
            setCreatedMagicLink(response.magicLink);
            toast({
              title: "User Created",
              description: "Magic link generated successfully. Share the link below with the user."
            });
          } else if (response && emailConfigured) {
            // If no link but email configured, assume success (link sent via email)
            toast({ title: "User Created", description: "Invitation email sent successfully." });
            closeAndReset(); // Close dialog after successful email send
          } else {
            // Fallback case
            console.log("Unexpected response format:", response);
            toast({
              title: "User Created",
              description: "User created but unable to generate magic link. Please check server logs.",
              variant: "destructive"
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      },
      onError: (error: Error) => {
        console.error("Create/update user error:", error);
        let description = "An unexpected error occurred.";
        try {
          const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
          description = errorBody.errors?.[0]?.message || errorBody.message || description;
        } catch (e) { /* Ignore parsing error */ }

        toast({
          title: isEditMode ? "Failed to update user" : "Failed to create user",
          description: description,
          variant: "destructive",
        });
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied to clipboard!",
          description: "Magic link copied.",
          variant: "default",
          duration: 2000,
        });
      },
      (err) => {

        console.error("Failed to copy:", err);
        toast({
          title: "Copy failed",
          description: "Could not copy text.",
          variant: "destructive",
        });
      }
    );
  };

  const closeAndReset = () => {
    onOpenChange(false);
    // Delay reset slightly to allow closing animation

     setTimeout(() => {
        setCreatedMagicLink(null); // Clear the link
        form.reset({ // Reset to defaults
            email: "", firstName: "", lastName: "", role: "client", projectIds: []
        });
     }, 150);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* Prevent auto-closing via overlay click when showing link */}
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" onInteractOutside={(e) => { if(createdMagicLink) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>
            {createdMagicLink ? "Magic Link Created" : isEditMode ? "Edit User" : "Create New User"}
          </DialogTitle>
          <DialogDescription>
            {createdMagicLink
              ? "Share this magic link with the user to grant them access."
              : isEditMode
                ? "Update user details and manage their account."
                : "Enter user details. An invitation link will be generated or emailed."}
          </DialogDescription>
        </DialogHeader>

        {createdMagicLink ? (
          // Display Magic Link Section
          <div className="space-y-4 pt-4">
            <Alert className="bg-green-50 border-green-200 text-green-800">

                  <CheckCircle2 className="h-4 w-4 !text-green-600" /> {/* Force color */}
                  <AlertDescription>
                    User account created! Please share the link below.

                  </AlertDescription>
             </Alert>
            <div className="space-y-2">
              <label htmlFor="magic-link-display" className="text-sm font-medium">Magic Link (Valid for 24 hours)</label>
              <div className="flex items-center">
                <Input
                  id="magic-link-display"

                  readOnly
                  value={createdMagicLink ?? ""} // Ensure value is not null

                  className="bg-slate-100 border-r-0 rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"

                  onClick={() => copyToClipboard(createdMagicLink ?? "")} // Handle null case for copy
                  className="rounded-l-none h-9 flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy Magic Link</span>

                </Button>
              </div>
               {!emailConfigured && (
                 <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                    Email service is not configured. You MUST manually share this link.

                 </p>
               )}
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={closeAndReset}>
                Done

              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Create User Form Section
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="space-y-4 pt-4 overflow-y-auto flex-1 px-1">
              <CreateUserForm
                form={form}
                projects={projects}
                isLoadingProjects={isLoadingProjects}
                disabled={createOrUpdateMutation.isPending}
                isEditMode={isEditMode}
              />

              {createOrUpdateMutation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {/* Safely access error message */}
                    {createOrUpdateMutation.error instanceof Error ? createOrUpdateMutation.error.message : "Error. Please try again."}
                  </AlertDescription>
                </Alert>
              )}
              </div>

              <DialogFooter className="pt-4 flex-shrink-0">
                <div className="flex w-full justify-between items-center">
                  {/* Delete button on the left (only in edit mode) */}
                  {isEditMode && userToEdit && onDeleteUser && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        onDeleteUser(userToEdit);
                        closeAndReset();
                      }}
                      disabled={createOrUpdateMutation.isPending}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete User
                    </Button>
                  )}

                  {/* Right side buttons */}
                  <div className="flex gap-2 ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeAndReset}
                      disabled={createOrUpdateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createOrUpdateMutation.isPending}
                    >
                      {createOrUpdateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isEditMode ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        isEditMode ? "Update User" : "Create User & Get Link"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </Form>

        )}
      </DialogContent>
    </Dialog>
  );
}