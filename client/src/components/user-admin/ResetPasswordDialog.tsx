import React, { useEffect } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User } from "@shared/schema";
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
import { ResetPasswordForm } from "./ResetPasswordForm";

// Define validation schema locally or import from shared validations.ts
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // Apply error to confirmPassword field
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;


interface ResetPasswordDialogProps {
  userToManage: User | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({
  userToManage,
  isOpen,
  onOpenChange,
}: ResetPasswordDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/users/${userId}/reset-password`,
        { newPassword } // Send only the new password
      );
      // Check if response is ok before parsing json (assuming apiRequest throws on > 400)
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: `Password for ${userToManage?.email} has been updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false); // Close dialog
    },
    onError: (error: Error) => {
       console.error("Reset password error:", error);
       let description = "An unexpected error occurred.";
        try {
            const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
            description = errorBody.errors?.[0]?.message || errorBody.message || description;
        } catch (e) { /* Ignore parsing error */ }
      toast({
        title: "Password reset failed",
        description: description,
        variant: "destructive",
      });
    }
  });

  // Reset form when dialog opens or user changes
  useEffect(() => {
    if (isOpen) {
      form.reset({ newPassword: "", confirmPassword: "" });
    }
  }, [isOpen, userToManage, form]);


  const onSubmit = (data: ResetPasswordFormValues) => {
    if (!userToManage) return;
    resetPasswordMutation.mutate({
      userId: userToManage.id,
      newPassword: data.newPassword // Pass only the new password
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            {userToManage
              ? `Set a new password for ${userToManage.firstName} ${userToManage.lastName} (${userToManage.email})`
              : "Loading user..."}
          </DialogDescription>
        </DialogHeader>
        {userToManage && (
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                     <ResetPasswordForm
                        form={form}
                        disabled={resetPasswordMutation.isPending}
                     />
                     <DialogFooter className="pt-4">
                         <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={resetPasswordMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={resetPasswordMutation.isPending}
                        >
                            {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Reset Password
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}