import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Import relevant types from schema
import { PunchListItem, InsertPunchListItem, User } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge"; // Import Badge
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"; // Import Table components
import { Loader2, PlusCircle, ListChecks, AlertTriangle, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate, cn } from "@/lib/utils"; // Use shared date formatter and cn
// Import the dialog component we will create next
// import { CreatePunchListItemDialog } from "./CreatePunchListItemDialog";
// TODO: Import EditPunchListItemDialog and PhotoViewerDialog later

// Define a combined type if the API returns items with creator/assignee details
// Adjust based on your actual API response or storage function enhancement
type PunchListItemWithDetails = PunchListItem & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
};

interface ProjectPunchListTabProps {
  projectId: number;
}

// --- Helper Function for Status Badge ---
const getPunchStatusBadgeClasses = (status: string | null | undefined): string => {
    switch (status) {
        case 'open': return "bg-red-100 text-red-800 border-red-300";
        case 'in_progress': return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case 'resolved': return "bg-blue-100 text-blue-800 border-blue-300";
        case 'verified': return "bg-green-100 text-green-800 border-green-300";
        default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
};
const getPunchStatusLabel = (status: string | null | undefined): string => {
    switch (status) {
        case 'open': return "Open";
        case 'in_progress': return "In Progress";
        case 'resolved': return "Resolved";
        case 'verified': return "Verified";
        default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
    }
};
// --- End Helper Function ---


export function ProjectPunchListTab({ projectId }: ProjectPunchListTabProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  // TODO: Add state for editing item and viewing photo
  // const [editingItem, setEditingItem] = useState<PunchListItemWithDetails | null>(null);
  // const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Fetch punch list items for the project
  const punchListQueryKey = [`/api/projects/${projectId}/punch-list`];
  const {
    data: punchListItems = [],
    isLoading,
    error,
    isError,
  } = useQuery<PunchListItemWithDetails[]>({ // Use the combined type
    queryKey: punchListQueryKey,
    queryFn: getQueryFn({ on401: "throw" }), // Assumes API returns creator/assignee
    enabled: projectId > 0,
  });

  // --- TODO: Add Mutations for Delete/Update ---
  // const deleteMutation = useMutation({...});
  // const updateMutation = useMutation({...});

  // --- Handlers ---
  const handleAddItem = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEditItem = (item: PunchListItemWithDetails) => {
    // setEditingItem(item);
    // setIsEditDialogOpen(true); // Need an Edit Dialog
    toast({ title: "Edit Item", description: `Edit functionality for item #${item.id} needs implementation.` });
  };

  const handleDeleteItem = (itemId: number) => {
     // TODO: Implement confirmation dialog before deleting
     // deleteMutation.mutate(itemId);
     toast({ title: "Delete Item", description: `Delete functionality for item #${itemId} needs implementation.`, variant: "destructive" });
  };

  const handleViewPhoto = (photoUrl: string | null) => {
      if (!photoUrl) return;
      // setViewingPhotoUrl(photoUrl);
      // setIsPhotoViewerOpen(true); // Need a Photo Viewer Dialog
      toast({ title: "View Photo", description: `Photo viewer needs implementation. URL: ${photoUrl}` });
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      // Skeleton loader for table
      return (
        <div className="space-y-2 mt-4">
          <Skeleton className="h-10 w-full" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (isError || error) {
      // Display error message
      return (
         <Alert variant="destructive" className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Punch List</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "An unknown error occurred."}
            </AlertDescription>
          </Alert>
      );
    }

     if (punchListItems.length === 0) {
        // Display empty state
        return (
             <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg mt-4">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <ListChecks className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Punch List is Clear</h3>
                <p className="text-muted-foreground mb-4">No outstanding items found for this project.</p>
                 <Button size="sm" onClick={handleAddItem} className="gap-1">
                   <PlusCircle className="h-4 w-4" />
                   Add Punch List Item
                </Button>
            </div>
        );
     }

    // --- Render Table of Items ---
    return (
      <div className="overflow-x-auto mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Description</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {punchListItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium align-top">{item.description}</TableCell>
                <TableCell className="align-top">{item.location || '-'}</TableCell>
                <TableCell className="align-top">
                  {item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : 'Unassigned'}
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline" className={getPunchStatusBadgeClasses(item.status)}>
                    {getPunchStatusLabel(item.status)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top">{item.dueDate ? formatDate(item.dueDate, "P") : '-'}</TableCell>
                <TableCell className="text-right align-top space-x-1">
                   {item.photoUrl && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewPhoto(item.photoUrl)}>
                            <ImageIcon className="h-4 w-4" />
                            <span className="sr-only">View Photo</span>
                        </Button>
                   )}
                   <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit Item</span>
                   </Button>
                   <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Item</span>
                   </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <div>
           <CardTitle>Punch List</CardTitle>
           <CardDescription>Track remaining items needing attention before project completion.</CardDescription>
         </div>
         <Button size="sm" onClick={handleAddItem} className="gap-1">
           <PlusCircle className="h-4 w-4" />
           Add Item
        </Button>
       </CardHeader>
       <CardContent>
         {/* TODO: Add filtering/sorting controls here later */}
         {renderContent()}
       </CardContent>

      {/* --- TODO: Add CreatePunchListItemDialog Component --- */}
      {/* <CreatePunchListItemDialog
        isOpen={isCreateDialogOpen}
        setIsOpen={setIsCreateDialogOpen}
        projectId={projectId}
        onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: punchListQueryKey });
        }}
      /> */}

      {/* --- TODO: Add EditPunchListItemDialog Component --- */}
      {/* <EditPunchListItemDialog
          isOpen={!!editingItem}
          setIsOpen={() => setEditingItem(null)}
          itemToEdit={editingItem}
          projectId={projectId}
          onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: punchListQueryKey });
          }}
      /> */}

      {/* --- TODO: Add Photo Viewer Dialog Component --- */}
      {/* <PhotoViewerDialog
          isOpen={!!viewingPhotoUrl}
          setIsOpen={() => setViewingPhotoUrl(null)}
          photoUrl={viewingPhotoUrl}
      /> */}

     </Card>
  );
}