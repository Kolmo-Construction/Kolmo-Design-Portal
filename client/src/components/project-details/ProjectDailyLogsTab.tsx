import { useQuery } from "@tanstack/react-query";
import { DailyLog } from "@shared/schema"; // Assuming type exists
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, FileText } from "lucide-react";

interface ProjectDailyLogsTabProps {
  projectId: number;
}

export function ProjectDailyLogsTab({ projectId }: ProjectDailyLogsTabProps) {
  const {
    data: dailyLogs = [],
    isLoading,
    error,
  } = useQuery<DailyLog[]>({ // Adjust type if needed (e.g., DailyLogWithPhotos)
    queryKey: [`/api/projects/${projectId}/daily-logs`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // TODO: Implement create/view daily log dialogs/modals
  const handleAddLog = () => {
    console.log("Open Add Daily Log Dialog");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Daily Logs</CardTitle>
          <CardDescription>Daily reports from the field.</CardDescription>
        </div>
         <Button size="sm" onClick={handleAddLog} className="gap-1">
           <PlusCircle className="h-4 w-4" />
           Add Daily Log
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
         {error && (
          <div className="text-red-600 text-center py-4">
            Error loading daily logs: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}
        {!isLoading && !error && dailyLogs.length === 0 && (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No daily logs have been submitted for this project yet.</p>
                 <Button size="sm" onClick={handleAddLog} className="mt-4 gap-1">
                   <PlusCircle className="h-4 w-4" />
                   Add First Daily Log
                </Button>
            </div>
        )}
        {!isLoading && !error && dailyLogs.length > 0 && (
          <div>
            {/* TODO: Render list of DailyLogItems */}
            <p>Display {dailyLogs.length} daily logs here...</p>
            {/* Example:
            <ul className="space-y-4">
              {dailyLogs.map(log => <DailyLogItem key={log.id} log={log} />)}
            </ul>
            */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}