import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DailyLog, User, DailyLogPhoto } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Loader2, PlusCircle, NotebookText, AlertTriangle, Image as ImageIcon, UserCircle, Sun, Cloud, Umbrella, Snowflake, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
// Import the dialog components
import { CreateDailyLogDialog } from "./CreateDailyLogDialog";
import { EditDailyLogDialog } from './EditDailyLogDialog';
import { PhotoViewerDialog } from './PhotoViewerDialog'; // *** ADDED: Import Photo Viewer ***

// Define a combined type if the API returns logs with photos and creator
type DailyLogWithDetails = DailyLog & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
    photos?: DailyLogPhoto[];
};

interface ProjectDailyLogsTabProps {
  projectId: number;
}

// --- Helper Component for Displaying a Single Log ---
interface DailyLogItemProps {
    log: DailyLogWithDetails;
    onViewPhotos: (photos: DailyLogPhoto[], startIndex?: number) => void; // *** Changed '?' to required ***
    onEdit: (logId: number) => void;
    onDelete: (logId: number, logDate: string) => void;
}

function DailyLogItem({ log, onViewPhotos, onEdit, onDelete }: DailyLogItemProps) {
    const getWeatherIcon = (weather?: string | null) => {
        const w = weather?.toLowerCase();
        if (!w) return <Sun className="h-4 w-4 text-slate-500" />;
        if (w.includes('sun') || w.includes('clear')) return <Sun className="h-4 w-4 text-yellow-500" />;
        if (w.includes('cloud') || w.includes('overcast')) return <Cloud className="h-4 w-4 text-slate-500" />;
        if (w.includes('rain') || w.includes('shower') || w.includes('drizzle')) return <Umbrella className="h-4 w-4 text-blue-500" />;
        if (w.includes('snow')) return <Snowflake className="h-4 w-4 text-cyan-500" />;
        return <Sun className="h-4 w-4 text-slate-500" />; // Default
    };
    return (
        <Card className="mb-4 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b flex flex-row justify-between items-start gap-2">
                {/* Log Title/Date/Creator Info */}
                <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2 mb-1">
                        {getWeatherIcon(log.weather)}
                        Daily Log - {formatDate(log.logDate, "PPP")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Submitted by: {log.creator ? `${log.creator.firstName} ${log.creator.lastName}` : 'Unknown User'}
                        {' '} on {formatDate(log.createdAt, "PPp")}
                    </CardDescription>
                </div>
                {/* Action Buttons */}
                 <div className="flex gap-1 flex-shrink-0">
                     <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7"
                         onClick={() => onEdit(log.id)}
                         title="Edit Log"
                     >
                         <Pencil className="h-4 w-4" />
                         <span className="sr-only">Edit Log</span>
                     </Button>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(log.id, formatDate(log.logDate, "PPP"))}
                          title="Delete Log"
                      >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete Log</span>
                      </Button>
                 </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
                {(log.weather || log.temperature) && (
                    <p><strong className="font-medium text-slate-700 dark:text-slate-300">Conditions:</strong> {log.weather || 'N/A'} {log.temperature ? `(${log.temperature}°)` : ''}</p>
                )}
                 {log.crewOnSite && (
                    <p><strong className="font-medium text-slate-700 dark:text-slate-300">Crew On Site:</strong> {log.crewOnSite}</p>
                )}
                <div>
                    <strong className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Work Performed:</strong>
                     <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{log.workPerformed || 'N/A'}</p>
                </div>
                {log.issuesEncountered && (
                    <div>
                        <strong className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Issues Encountered:</strong>
                        <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{log.issuesEncountered}</p>
                    </div>
                )}
                {log.safetyObservations && (
                    <div>
                        <strong className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Safety Observations:</strong>
                        <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{log.safetyObservations}</p>
                    </div>
                )}
                {/* Photos */}
                {log.photos && log.photos.length > 0 && (
                    <div>
                        <strong className="font-medium text-slate-700 dark:text-slate-300 block mb-2">Photos:</strong>
                        <div className="flex flex-wrap gap-2">
                            {log.photos.map((photo, index) => (
                                <button
                                    key={photo.id}
                                    onClick={() => onViewPhotos(log.photos ?? [], index)} // Ensure photos array is passed
                                    className="relative w-20 h-20 rounded border overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                    title={photo.caption || 'View photo'}
                                >
                                    <img src={photo.photoUrl} alt={photo.caption || 'Daily log photo'} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                                        <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
// --- End Helper Component ---


export function ProjectDailyLogsTab({ projectId }: ProjectDailyLogsTabProps) {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [logToDeleteId, setLogToDeleteId] = useState<number | null>(null);
  const [logToDeleteDate, setLogToDeleteDate] = useState<string>('');
  // *** UPDATED: State for Photo Viewer Dialog ***
  const [viewingPhotos, setViewingPhotos] = useState<DailyLogPhoto[] | null>(null);
  const [photoStartIndex, setPhotoStartIndex] = useState(0);

  // Fetch daily logs for the project
  const dailyLogsQueryKey = [`/api/projects/${projectId}/daily-logs`];
  const {
    data: dailyLogs = [],
    isLoading,
    error,
    isError,
  } = useQuery<DailyLogWithDetails[]>({
    queryKey: dailyLogsQueryKey,
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Handler to open the edit dialog
  const handleEditLog = useCallback((logId: number) => {
      setEditingLogId(logId);
  }, []);

  // *** UPDATED: Handler to open the photo viewer ***
  const handleViewPhotos = useCallback((photos: DailyLogPhoto[], startIndex: number = 0) => {
    console.log(`Opening photo viewer for ${photos.length} photos, starting at index ${startIndex}`);
    setViewingPhotos(photos);
    setPhotoStartIndex(startIndex);
    // Remove the placeholder toast:
    // toast({ title: "Photo Viewer", description: "Photo viewer functionality needs to be implemented." });
  }, []); // No dependencies needed

  // Handler to open delete confirmation
  const handleDeleteLog = useCallback((logId: number, logDate: string) => {
      setLogToDeleteId(logId);
      setLogToDeleteDate(logDate);
  }, []);

   // Mutation for deleting a daily log
   const deleteDailyLogMutation = useMutation({
       mutationFn: (logIdToDelete: number) => {
           return apiRequest('DELETE', `/api/projects/${projectId}/daily-logs/${logIdToDelete}`);
       },
       onSuccess: (_, deletedLogId) => {
           toast({ title: "Success", description: `Daily log deleted successfully.` });
           queryClient.invalidateQueries({ queryKey: dailyLogsQueryKey });
           setLogToDeleteId(null);
       },
       onError: (err) => {
           console.error("Error deleting daily log:", err);
           toast({
               title: "Error Deleting Log",
               description: err instanceof Error ? err.message : "Could not delete the daily log.",
               variant: "destructive",
           });
           setLogToDeleteId(null);
       },
   });

   // Handler for confirming deletion
   const confirmDelete = useCallback(() => {
       if (logToDeleteId) {
           deleteDailyLogMutation.mutate(logToDeleteId);
       }
   }, [logToDeleteId, deleteDailyLogMutation]);

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 mt-4">
          {[...Array(3)].map((_, i) => (
             <Card key={i} className="mb-4 overflow-hidden">
                <CardHeader className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b flex flex-row justify-between items-start gap-2">
                    <div className="w-3/4 space-y-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                        <Skeleton className="h-7 w-7 rounded-md" />
                        <Skeleton className="h-7 w-7 rounded-md" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-16 w-full" />
                     <div className="flex gap-2 pt-2">
                        <Skeleton className="h-20 w-20 rounded" />
                        <Skeleton className="h-20 w-20 rounded" />
                    </div>
                 </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (isError || error) {
      return (
         <Alert variant="destructive" className="m-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Daily Logs</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "An unknown error occurred."}
            </AlertDescription>
          </Alert>
      );
    }

     if (dailyLogs.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg mt-4">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <NotebookText className="h-8 w-8 text-muted-foreground" />
                 </div>
                <h3 className="text-lg font-semibold mb-1">No Daily Logs Yet</h3>
                <p className="text-muted-foreground mb-4">Submit the first daily log for this project.</p>
                 <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="gap-1">
                   <PlusCircle className="h-4 w-4" />
                   Add First Daily Log
                </Button>
            </div>
        );
     }

    // --- Render List of Logs ---
    return (
      <div className="space-y-4 mt-4">
        {dailyLogs.map(log => (
          <DailyLogItem
            key={log.id}
            log={log}
            onViewPhotos={handleViewPhotos} // Ensure this is passed correctly
            onEdit={handleEditLog}
            onDelete={handleDeleteLog}
          />
         ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Daily Logs</CardTitle>
          <CardDescription>Daily reports submitted from the field.</CardDescription>
        </div>
         <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="gap-1" disabled={isLoading}>
           <PlusCircle className="h-4 w-4" />
           Add Daily Log
        </Button>
      </CardHeader>
      <CardContent>
         {renderContent()}
      </CardContent>

      {/* --- Render Create Daily Log Dialog --- */}
      <CreateDailyLogDialog
        isOpen={isCreateDialogOpen}
        setIsOpen={setIsCreateDialogOpen}
        projectId={projectId}
        onSuccess={() => {
            // Invalidation handled by CreateDialog's mutation
        }}
      />

       {/* --- Render Edit Daily Log Dialog --- */}
       <EditDailyLogDialog
           isOpen={!!editingLogId}
           setIsOpen={(open) => { if (!open) setEditingLogId(null); }}
           logToEditId={editingLogId}
           projectId={projectId}
           onSuccess={() => {
                // Invalidation handled by EditDialog's mutation
           }}
       />

        {/* --- Delete Confirmation Dialog --- */}
        <AlertDialog open={!!logToDeleteId} onOpenChange={(open) => { if (!open) setLogToDeleteId(null); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the daily log from
                     <span className="font-medium"> {logToDeleteDate || 'the selected date'}</span> and all associated photos.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setLogToDeleteId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={confirmDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteDailyLogMutation.isPending}
                >
                     {deleteDailyLogMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    Yes, delete log
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


      {/* --- ADDED: Render Photo Viewer Dialog Component --- */}
      <PhotoViewerDialog
          isOpen={!!viewingPhotos} // Open if viewingPhotos is not null
          setIsOpen={() => setViewingPhotos(null)} // Set to null to close
          photos={viewingPhotos || []} // Pass the photos array
          startIndex={photoStartIndex} // Pass the starting index
      />

    </Card>
  );
}