import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";

interface DeleteUserDialogProps {
  userToManage: User | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({
  userToManage,
  isOpen,
  onOpenChange,
}: DeleteUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // We could reset mutation state here if needed
    }
  }, [isOpen]);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
      // 204 No Content response has no body, so don't try to parse JSON
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: `${userToManage?.firstName} ${userToManage?.lastName} has been deleted.`,
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Delete user error:", error);
      let description = "An unexpected error occurred.";
      
      // Try to extract the error message from API response
      try {
        // Handle both direct error messages and JSON error responses
        if (error.message.includes('Cannot delete user:')) {
          description = error.message;
        } else if (error.message.includes('{')) {
          const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
          description = errorBody.message || errorBody.errors?.[0]?.message || description;
        } else {
          description = error.message || description;
        }
      } catch (e) { 
        // If parsing fails, use the original error message
        description = error.message || description;
      }

      toast({
        title: "Cannot delete user",
        description: description,
        variant: "destructive",
      });
    }
  });

  const handleDeleteConfirm = () => {
    if (userToManage) {
      deleteUserMutation.mutate(userToManage.id);
    } else {
      toast({
        title: "Error",
        description: "No user selected for deletion",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  };

  // Don't render if no user is selected, but dialog is open
  // This can happen if the dialog is controlled externally
  if (isOpen && !userToManage) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the account for
            <span className="font-medium"> {userToManage?.firstName} {userToManage?.lastName}</span> ({userToManage?.email})
            and remove all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            disabled={deleteUserMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDeleteConfirm();
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
            disabled={deleteUserMutation.isPending || !userToManage}
          >
            {deleteUserMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {deleteUserMutation.isPending ? "Deleting..." : "Yes, delete user"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
