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
import { Button } from "@/components/ui/button"; // Import Button for potential use
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      // Assuming apiRequest handles response status checking
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return res.json(); // Or handle potential no-content response
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: `${userToManage?.firstName} ${userToManage?.lastName} has been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false); // Close dialog
    },
    onError: (error: Error) => {
       console.error("Delete user error:", error);
       let description = "An unexpected error occurred.";
        try {
            const errorBody = JSON.parse(error.message.substring(error.message.indexOf('{')));
            description = errorBody.errors?.[0]?.message || errorBody.message || description;
        } catch (e) { /* Ignore parsing error */ }

      toast({
        title: "Delete failed",
        description: description,
        variant: "destructive",
      });
    }
  });

  const handleDeleteConfirm = () => {
    if (userToManage) {
      deleteUserMutation.mutate(userToManage.id);
    }
  };


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
          <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600" // Use destructive style from shadcn if available, else custom
            disabled={deleteUserMutation.isPending}
          >
            {deleteUserMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Yes, delete user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}