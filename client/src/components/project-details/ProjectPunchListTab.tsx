// client/src/components/project-details/ProjectPunchListTab.txt
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Updated import to use PunchListItemWithDetails which includes 'media'
import { PunchListItem, User, DailyLogPhoto, PunchListItemWithDetails } from "@shared/schema"; // Import relevant types from schema
import { getQueryFn, apiRequest } from "@/lib/queryClient";
// Import query helpers
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
// Added Image as ImageIcon import again for clarity, removed ListChecks if not used
import { Loader2, PlusCircle, AlertTriangle, Image as ImageIcon, Pencil, Trash2, MoreHorizontal, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, cn } from "@/lib/utils";
// Import Dialogs
import { CreatePunchListItemDialog } from "./CreatePunchListItemDialog"; // Assuming dialog components exist and are imported correctly
import { EditPunchListItemDialog } from "./EditPunchListItemDialog"; // Assuming dialog components exist and are imported correctly
import { PhotoViewerDialog } from './PhotoViewerDialog'; // Import PhotoViewerDialog

// Removed the manual type definition for PunchListItemWithDetails as it's imported from shared/schema now
// type PunchListItemWithDetails = PunchListItem & {
//     creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
//     assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
// };

interface ProjectPunchListTabProps {
  projectId: number;
}

// Helper Function for Status Badge (kept as is)
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
        default: return status ?
        status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
    }
};

export function ProjectPunchListTab({ projectId }: ProjectPunchListTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  // State for delete confirmation
  // Original: [source: 5985] const [viewingPhotosState, setViewingPhotosState] = useState<{ photos: DailyLogPhoto[]; startIndex: number } | null>(null);
  // Updated state to manage media URLs (strings) and viewer open state separately
  const [viewMedia, setViewMedia] = useState<string[]>([]); // State to hold media URLs for the viewer
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false); // State for photo viewer dialog

  // TODO: Add state for editing item - Corrected to use the existing pattern
   const [editingItem, setEditingItem] = useState<PunchListItemWithDetails | null>(null);

  // Fetch punch list items for the project
  const punchListQueryKey = [`/api/projects/${projectId}/punch-list`]; // Kept original query key structure
  const {
    data: punchListItems = [],
    isLoading,
    error,
    isError,
  } = useQuery<PunchListItemWithDetails[]>({ // Use updated type in query
    queryKey: punchListQueryKey,
    queryFn: getQueryFn({ on401: "throw" }), // Use the existing query function
    enabled: projectId > 0,
  });
  // --- Mutation for Deleting Punch List Item --- (Kept original mutation)
  const deletePunchListItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
        // Ensure this API endpoint matches the new route DELETE /api/punch-list/:itemId
        return await apiRequest('DELETE', `/api/punch-list/${itemId}`); // Updated endpoint path
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: punchListQueryKey });
      toast({
        title: "Item Deleted",
        description: `Punch list item #${itemId} has been successfully deleted.`,
      });
      setItemToDelete(null);

    },
    onError: (error: Error, itemId) => {
      toast({
        title: "Delete Failed",
        description: `Failed to delete item #${itemId}: ${error.message}`,
        variant: "destructive",
      });
      setItemToDelete(null);
    },
  });
  // --- Handlers --- (Kept original handlers, modified photo viewer handler)
  const handleAddItem = () => {
    setIsCreateDialogOpen(true);
  };
  const handleEditItem = (item: PunchListItemWithDetails) => {
     setEditingItem(item); // Use the correct state setter
     // setIsEditDialogOpen(true); // Assuming EditPunchListItemDialog controls its own open state based on item state
    // Removed the toast about needing implementation
  };

  const handleDeleteItem = (itemId: number) => {
     setItemToDelete(itemId);
  };
  // Updated handler: Sets state to trigger the PhotoViewerDialog with all media URLs
  const handleViewPhoto = (item: PunchListItemWithDetails) => {
      // Use item.media which is the array of media objects
      if (!item.media || item.media.length === 0) {
           toast({ title: "No Media", description: "This item does not have associated media.", variant: "destructive" });
           return;
       }
       // Extract just the media URLs from the array of media objects
       const mediaUrls = item.media.map(mediaItem => mediaItem.mediaUrl);
       setViewMedia(mediaUrls); // Set the array of URLs
       setIsMediaViewerOpen(true); // Open the viewer
  };

  // Function to close the media viewer
    const handleCloseMediaViewer = () => {
        setIsMediaViewerOpen(false);
        setViewMedia([]); // Clear the media URLs when closing
    };


  // --- Render Logic --- (Modified to include Media column)
  const renderContent = () => {
    if (isLoading) {
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

    // --- Render Table of Items --- (Added Media column)
    return (
      <div className="overflow-x-auto mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Description</TableHead> {/* Adjusted width */}
              <TableHead>Location</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Media</TableHead>{/* Added Media Column */}
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
                 {/* --- Media Cell --- */}
                 <TableCell className="align-top">
                       {item.media && item.media.length > 0 ? (
                           // Updated onClick to use the new handleViewPhoto logic
                           <Button variant="link" onClick={() => handleViewPhoto(item)} className="p-0 h-auto">
                               View {item.media.length} Photo(s) {/* Dynamic count */}
                           </Button>
                       ) : (
                           <span>No Media</span>
                       )}
                   </TableCell>
                <TableCell className="text-right align-top">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {/* Removed the old "View Photo" MenuItem that was tied to single photoUrl */}
                            {/* {item.photoUrl && (
                                <DropdownMenuItem onClick={() => handleViewPhoto(item)}>
                                    <ImageIcon className="mr-2 h-4 w-4" />
                                    View Photo
                                </DropdownMenuItem>
                            )} */}
                            <DropdownMenuItem onClick={() => handleEditItem(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Item
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Item
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
     <> {/* Use Fragment to hold Card and Dialogs */}
       <Card>
         <CardHeader className="flex flex-row items-center justify-between">
           <div>
             <CardTitle>Punch List</CardTitle>
             <CardDescription>Track remaining items needing attention before project completion.</CardDescription>
           </div>
           {/* Moved Add Item button here from renderContent */}
           <Button size="sm" onClick={handleAddItem} className="gap-1">
             <PlusCircle className="h-4 w-4" />
             Add Item
          </Button>
         </CardHeader>
         <CardContent>
           {/* TODO: Add filtering/sorting controls here later */}
           {renderContent()}
         </CardContent>
       </Card>

       {/* --- Confirmation Dialog for Delete --- (Kept as is) */}
       <AlertDialog
            open={itemToDelete !== null}
            onOpenChange={(isOpen) => { if (!isOpen) { setItemToDelete(null); }}}
        >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete punch list item #{itemToDelete} and any associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePunchListItemMutation.isPending}>
                Cancel
            </AlertDialogCancel>
            <AlertDialogAction
                // Using the original buttonVariants utility
                className={buttonVariants({ variant: "destructive" })}
                onClick={() => { if (itemToDelete) { deletePunchListItemMutation.mutate(itemToDelete); }}}
                disabled={!itemToDelete || deletePunchListItemMutation.isPending}
            >
              {deletePunchListItemMutation.isPending && ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> )}
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       {/* --- Photo Viewer Dialog Instance --- (Updated props) */}
       <PhotoViewerDialog
            // Control open state using the new isMediaViewerOpen state
            isOpen={isMediaViewerOpen}
            // Pass the close handler
            onClose={handleCloseMediaViewer} // Use the new close handler
            // Pass the array of media URLs directly
            mediaUrls={viewMedia}
            // startIndex is not needed if PhotoViewerDialog handles a simple array display
            // If PhotoViewerDialog has internal index, pass 0 initially or modify dialog
            // startIndex={0} // Assuming PhotoViewerDialog just needs the array
        />

      {/* --- CreatePunchListItemDialog Component --- (Rendered) */}
      <CreatePunchListItemDialog
         projectId={projectId}
         isOpen={isCreateDialogOpen}
         onClose={() => setIsCreateDialogOpen(false)}
         // Add onSuccess to invalidate queries after creation
         onSuccess={() => queryClient.invalidateQueries({ queryKey: punchListQueryKey })}
      />

      {/* --- EditPunchListItemDialog Component --- (Rendered and controlled by state) */}
      {editingItem && (
        <EditPunchListItemDialog
          item={editingItem}
          // Dialog is open if editingItem is not null
          isOpen={!!editingItem}
          // Close handler sets editingItem back to null
          onClose={() => setEditingItem(null)}
          // Add onSuccess to invalidate queries after update/media changes
           onSuccess={() => queryClient.invalidateQueries({ queryKey: ["projectPunchList", projectId] })} // Invalidate with project ID
        />
      )}

     </>
  );
}

// Helper function to get button variants (kept as is)
import { type VariantProps, cva } from "class-variance-authority";
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
         "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}