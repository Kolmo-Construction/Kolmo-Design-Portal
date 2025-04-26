import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Project, UserRole } from "@shared/schema";
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
import { Input } from "@/components/ui/input"; // Keep this import
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth"; // Assuming useAuth exports createMagicLinkMutation
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient"; // Added queryClient import
import { Loader2, Copy, CheckCircle2 } from "lucide-react";
import { CreateUserForm } from "./CreateUserForm";

// Define validation schema locally or import from shared validations.ts
const newUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "projectManager", "client"], {
    required_error: "Role is required",
  }),
  projectIds: z.array(z.number()).optional(), // Array of selected project IDs
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

interface CreateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  emailConfigured: boolean;
}

export function CreateUserDialog({
  isOpen,
  onOpenChange,
  emailConfigured,
}: CreateUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createMagicLinkMutation } = useAuth(); // Get mutation hook from auth context
  const [createdMagicLink, setCreatedMagicLink] = useState<string | null>(null);

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "client", // Default role
      projectIds: [],
    },
  });

  // Fetch projects for assignment dropdown (only when dialog is open and role is client)
  const selectedRole = form.watch("role");
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
  } = useQuery<Project[], Error>({
    queryKey: ["/api/projects"], // Use a consistent key
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen && selectedRole === 'client', // Only fetch when needed
  });

  const onSubmit = (data: NewUserFormValues) => {
     // Clear projectIds if role is not client before submitting
     const submissionData = data.role === 'client' ? data : { ...data, projectIds: [] };
    createMagicLinkMutation.mutate(submissionData, {
      onSuccess: (response) => {
         console.log("Magic link mutation response:", response);
        // Only set magic link if it's available in the response
        if (response?.magicLink) {
          setCreatedMagicLink(response.magicLink);
        } else if (response?.userId && emailConfigured) {
            // If no link but email configured, assume success (link sent via email)
             toast({ title: "User Created", description: "Invitation email sent successfully."});
             closeAndReset(); // Close dialog after successful email send
        } else if (response?.userId && !emailConfigured) {
             // Handle case where user created but email failed - RARE if API is robust
             toast({ title: "User Created (Manual Link Needed)", description: "User created, but email service is down. No magic link available.", variant: "destructive"});
             // Don't close dialog yet? Or provide alternative?
        }
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        // Don't close automatically if magic link needs copying
         if (!response?.magicLink) {
            // Maybe close if email was sent? Handled above.
            // closeAndReset();
         }
      },
      onError: (error: Error) => {
           console.error("Create user / magic link error:", error);
           // Attempt to parse backend error message if available
           let description = "An unexpected error occurred.";
           try {
               const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
               description = errorBody.errors?.[0]?.message || errorBody.message || description;
           } catch (e) { /* Ignore parsing error */ }

            toast({
              title: "Failed to create user",
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
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => { if(createdMagicLink) e.preventDefault(); }}>
        <DialogHeader>
           <DialogTitle>{createdMagicLink ? "Magic Link Created" : "Create New User"}</DialogTitle>
          <DialogDescription>
            {createdMagicLink
              ? "Share this magic link with the user to grant them access."
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
                <Input // <-- REMOVED COMMENT FROM HERE
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <CreateUserForm
                form={form}
                projects={projects}
                isLoadingProjects={isLoadingProjects}
                disabled={createMagicLinkMutation.isPending}
              />

              {createMagicLinkMutation.isError && (
                 <Alert variant="destructive">
                     <AlertDescription>
                       {createMagicLinkMutation.error?.message || "Error creating user. Please try again."}
                     </AlertDescription>
                  </Alert>
              )}

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAndReset} // Use consistent close handler
                  disabled={createMagicLinkMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMagicLinkMutation.isPending}
                >
                  {createMagicLinkMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User & Get Link"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}