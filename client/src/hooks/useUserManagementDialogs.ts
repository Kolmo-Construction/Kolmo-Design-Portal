// client/src/hooks/useUserManagementDialogs.ts
import { useState, useCallback } from 'react';
import { User } from '@shared/schema'; // Assuming User type is available

// Define the shape of the state and handlers returned by the hook
export interface UseUserManagementDialogsResult {
    isCreateUserDialogOpen: boolean;
    openCreateUserDialog: () => void;
    closeCreateUserDialog: () => void; // Explicit close if needed
    openEditUserDialog: (user: User) => void; // Open dialog in edit mode

    isResetPasswordDialogOpen: boolean;
    openResetPasswordDialog: (user: User) => void;
    closeResetPasswordDialog: () => void; // Explicit close if needed

    isDeleteUserDialogOpen: boolean;
    openDeleteUserDialog: (user: User) => void;
    closeDeleteUserDialog: () => void; // Explicit close if needed

    userToManage: User | null; // User currently targeted by Reset/Delete dialog
    userToEdit: User | null; // User currently being edited in Create/Edit dialog

    // Combined setter for dialog open state if preferred
    // setDialogState: (dialog: 'create' | 'reset' | 'delete', open: boolean) => void;
}

/**
 * Custom hook to manage the state and handlers for dialogs on the User Management page.
 */
export function useUserManagementDialogs(): UseUserManagementDialogsResult {
    const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
    const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
    const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
    const [userToManage, setUserToManage] = useState<User | null>(null);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);

    const openCreateUserDialog = useCallback(() => {
        setUserToEdit(null); // Clear edit user when opening create
        setUserToManage(null); // Ensure no user is selected when opening create
        setIsCreateUserDialogOpen(true);
    }, []);

    const openEditUserDialog = useCallback((user: User) => {
        setUserToEdit(user);
        setIsCreateUserDialogOpen(true);
    }, []);

    const closeCreateUserDialog = useCallback(() => {
        setIsCreateUserDialogOpen(false);
        setUserToEdit(null); // Clear edit user when closing
    }, []);

    const openResetPasswordDialog = useCallback((user: User) => {
        setUserToManage(user);
        setIsResetPasswordDialogOpen(true);
    }, []);

    const closeResetPasswordDialog = useCallback(() => {
        setIsResetPasswordDialogOpen(false);
        // Clear userToManage when closing dialog to prevent stale state
        // Alternatively, let the Dialog's onOpenChange handle this if desired
        // setUserToManage(null);
    }, []);

    const openDeleteUserDialog = useCallback((user: User) => {
        setUserToManage(user);
        setIsDeleteUserDialogOpen(true);
    }, []);

    const closeDeleteUserDialog = useCallback(() => {
        setIsDeleteUserDialogOpen(false);
         // Clear userToManage when closing dialog
         // setUserToManage(null);
    }, []);

    // Controlled setters that also clear state on close
    const controlledSetIsCreateUserDialogOpen = useCallback((open: boolean) => {
        setIsCreateUserDialogOpen(open);
        if (!open) {
            setUserToEdit(null);
        }
    }, []);

    const controlledSetIsResetPasswordDialogOpen = useCallback((open: boolean) => {
        setIsResetPasswordDialogOpen(open);
        if (!open) {
            setUserToManage(null);
        }
    }, []);

    const controlledSetIsDeleteDialogOpen = useCallback((open: boolean) => {
        setIsDeleteUserDialogOpen(open);
        if (!open) {
            setUserToManage(null);
        }
    }, []);

    return {
        isCreateUserDialogOpen,
        openCreateUserDialog,
        openEditUserDialog, // Add edit handler
        closeCreateUserDialog,

        isResetPasswordDialogOpen,
        openResetPasswordDialog,
        closeResetPasswordDialog,

        isDeleteUserDialogOpen,
        openDeleteUserDialog,
        closeDeleteUserDialog,

        userToManage,
        userToEdit, // Add edit user state

        // Provide controlled setters if dialogs use onOpenChange directly
        setIsCreateUserDialogOpen: controlledSetIsCreateUserDialogOpen,
        setIsResetPasswordDialogOpen: controlledSetIsResetPasswordDialogOpen,
        setIsDeleteDialogOpen: controlledSetIsDeleteDialogOpen,
    };
}