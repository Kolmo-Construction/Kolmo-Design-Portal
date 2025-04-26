import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Import relevant types from schema
import { DailyLog, InsertDailyLog, User, DailyLogPhoto } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, PlusCircle, NotebookText, AlertTriangle, Image as ImageIcon, UserCircle, Sun, Cloud, Umbrella, Snowflake } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils"; // Use shared date formatter
// Import the dialog component we will create next
import { CreateDailyLogDialog } from "./CreateDailyLogDialog";
// TODO: Import a photo viewer dialog component if needed
// import { PhotoViewerDialog } from "./PhotoViewerDialog";

// Define a combined type if the API returns logs with photos and creator
// Adjust this based on your actual API response or storage function enhancement
// NOTE: Assuming the API endpoint `/api/projects/:projectId/daily-logs` returns this structure
type DailyLogWithDetails = DailyLog & {
    creator?: Pick<User, 'id' | 'firstName' | 'lastName'> | null; // Allow null if creator is deleted
    photos?: DailyLogPhoto[];
};

interface ProjectDailyLogsTabProps {
  projectId: number;
}

// --- Helper Component for Displaying a Single Log ---
interface DailyLogItemProps {
    log: DailyLogWithDetails;
    onViewPhotos?: (photos: DailyLogPhoto[], startIndex?: number) => void; // Pass index to start viewer
}

function DailyLogItem({ log, onViewPhotos }: DailyLogItemProps) {
    // Helper to get weather icon based on text description
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
            <CardHeader className="p-4 bg-slate-50 border-b flex flex-row justify-between items-center">
                <div>
                    <CardTitle className="text-base flex items-center gap-2">
                        {getWeatherIcon(log.weather)}
                        {/* Format date using shared utility */}
                        Daily Log - {formatDate(log.logDate, "PPP")}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                        {/* Display creator name or 'Unknown' */}
                        Submitted by: {log.creator ? `${log.creator.firstName} ${log.creator.lastName}` : 'Unknown User'}
                        {/* Format creation timestamp */}
                        {' '} on {formatDate(log.createdAt, "PPp")}
                    </CardDescription>
                </div>
                {/* Placeholder for future Edit/Delete buttons */}
                {/* <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div> */}
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
                {/* Display weather and temperature if available */}
                {(log.weather || log.temperature) && (
                    <p><strong className="font-medium text-slate-700">Conditions:</strong> {log.weather || 'N/A'} {log.temperature ? `(${log.temperature}°)` : ''}</p>
                )}
                {/* Display crew information */}
                 {log.crewOnSite && (
                    <p><strong className="font-medium text-slate-700">Crew On Site:</strong> {log.crewOnSite}</p>
                )}
                {/* Display work performed */}
                <div>
                    <strong className="font-medium text-slate-700 block mb-1">Work Performed:</strong>
                    <p className="text-slate-600 whitespace-pre-wrap">{log.workPerformed || 'N/A'}</p>
                </div>
                {/* Display issues encountered */}
                {log.issuesEncountered && (
                    <div>
                        <strong className="font-medium text-slate-700 block mb-1">Issues Encountered:</strong>
                        <p className="text-slate-600 whitespace-pre-wrap">{log.issuesEncountered}</p>
                    </div>
                )}
                {/* Display safety observations */}
                 {log.safetyObservations && (
                    <div>
                        <strong className="font-medium text-slate-700 block mb-1">Safety Observations:</strong>
                        <p className="text-slate-600 whitespace-pre-wrap">{log.safetyObservations}</p>
                    </div>
                )}
                {/* Display Photos */}
                {log.photos && log.photos.length > 0 && (
                    <div>
                        <strong className="font-medium text-slate-700 block mb-2">Photos:</strong>
                        <div className="flex flex-wrap gap-2">
                            {log.photos.map((photo, index) => (
                                <button
                                    key={photo.id}
                                    // Trigger photo viewer with all photos and the index of the clicked one
                                    onClick={() => onViewPhotos?.(log.photos ?? [], index)}
                                    className="relative w-20 h-20 rounded border overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                    title={photo.caption || 'View photo'}
                                >
                                    <img src={photo.photoUrl} alt={photo.caption || 'Daily log photo'} className="w-full h-full object-cover" />
                                    {/* Overlay for hover effect */}
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
  // State to manage the photo viewer modal
  const [viewingPhotos, setViewingPhotos] = useState<DailyLogPhoto[] | null>(null);
  const [photoStartIndex, setPhotoStartIndex] = useState(0);

  // Fetch daily logs for the project
  const dailyLogsQueryKey = [`/api/projects/${projectId}/daily-logs`];
  const {
    data: dailyLogs = [],
    isLoading,
    error,
    isError,
  } = useQuery<DailyLogWithDetails[]>({ // Use the combined type
    queryKey: dailyLogsQueryKey,
    queryFn: getQueryFn({ on401: "throw" }), // Assumes API returns creator/photos
    enabled: projectId > 0,
    // Optional: Add refetch interval if live updates are desired without WebSockets yet
    // refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Handler to open the photo viewer
  const handleViewPhotos = (photos: DailyLogPhoto[], startIndex: number = 0) => {
    setViewingPhotos(photos);
    setPhotoStartIndex(startIndex);
    // Logic to open your PhotoViewerDialog would go here
    console.log("Viewing photos starting at index:", startIndex, photos);
    // Example: setIsPhotoViewerOpen(true);
    toast({ title: "Photo Viewer", description: "Photo viewer functionality needs to be implemented." });
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      // Skeleton loader for logs
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
             <Card key={i} className="mb-4 overflow-hidden animate-pulse">
                <CardHeader className="p-4 bg-slate-100 border-b flex flex-row justify-between items-center">
                    <div className="w-3/4 space-y-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-full" />
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
      // Display error message
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
        // Display empty state
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
            onViewPhotos={handleViewPhotos} // Pass the handler
          />
        ))}
        {/* TODO: Add pagination or infinite scroll later */}
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
         <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} className="gap-1">
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
            // Invalidate query to refetch logs after successful creation
            queryClient.invalidateQueries({ queryKey: dailyLogsQueryKey });
        }}
      />

      {/* --- TODO: Add Photo Viewer Dialog Component --- */}
      {/* This would likely take 'photos' and 'startIndex' as props */}
      {/* <PhotoViewerDialog
          isOpen={!!viewingPhotos}
          setIsOpen={() => setViewingPhotos(null)}
          photos={viewingPhotos || []}
          startIndex={photoStartIndex}
      /> */}

    </Card>
  );
}