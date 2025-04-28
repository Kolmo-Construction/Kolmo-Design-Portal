// client/src/hooks/useProjectManagementDialogs.ts
import { useState, useCallback } from 'react';
import { Project } from '@shared/schema'; // Project type needed for selectedProject

// Define the shape of the state and handlers returned by the hook
export interface UseProjectManagementDialogsResult {
    isCreateDialogOpen: boolean;
    setIsCreateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>; // For onOpenChange

    isEditDialogOpen: boolean;
    setIsEditDialogOpen: (open: boolean) => void; // Controlled setter

    selectedProject: Project | null; // Project currently targeted by Edit dialog

    openCreateDialog: () => void; // Explicit open handlers if needed
    openEditDialog: (project: Project) => void;
    // closeCreateDialog: () => void; // Explicit close handlers if needed
    // closeEditDialog: () => void;
}

/**
 * Custom hook to manage the state and handlers for Create/Edit Project dialogs.
 */
export function useProjectManagementDialogs(): UseProjectManagementDialogsResult {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // Explicit handler to open Create dialog (optional, could use setter directly)
    const openCreateDialog = useCallback(() => {
        setSelectedProject(null); // Ensure no project selected
        setIsCreateDialogOpen(true);
    }, []);

    // Handler to open Edit dialog
    const openEditDialog = useCallback((project: Project) => {
        setSelectedProject(project);
        setIsEditDialogOpen(true);
    }, []);

    // Controlled setter for Edit dialog that clears selected project on close
    const controlledSetIsEditDialogOpen = useCallback((open: boolean) => {
        setIsEditDialogOpen(open);
        if (!open) {
            setSelectedProject(null); // Clear selection when dialog closes
        }
    }, []);

    return {
        isCreateDialogOpen,
        setIsCreateDialogOpen, // Direct setter for Create Dialog onOpenChange

        isEditDialogOpen,
        setIsEditDialogOpen: controlledSetIsEditDialogOpen, // Controlled setter for Edit Dialog onOpenChange

        selectedProject,

        // Export explicit open handlers if preferred over direct setters
        openCreateDialog,
        openEditDialog,
    };
}