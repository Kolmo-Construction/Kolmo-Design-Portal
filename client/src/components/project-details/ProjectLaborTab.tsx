import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { TimeEntry } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, User, DollarSign, Calendar, MapPin, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface ProjectLaborTabProps {
  projectId: number;
}

interface TimeEntryWithUser extends TimeEntry {
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    hourlyRate?: string;
  };
  project?: {
    id: number;
    name: string;
  };
}

interface LaborSummary {
  totalEntries: number;
  totalHours: number;
  totalLaborCost: number;
  activeEntries: number;
  byWorker: Array<{
    userId: number;
    userName: string;
    hours: number;
    cost: number;
    entries: number;
  }>;
}

export function ProjectLaborTab({ projectId }: ProjectLaborTabProps) {
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'all'>('month');

  // Fetch time entries for the project
  const {
    data: timeEntriesResponse,
    isLoading: isLoadingEntries,
    error: entriesError,
  } = useQuery<{ success: boolean; entries: TimeEntryWithUser[]; summary: { totalEntries: number; totalHours: number } }>({
    queryKey: [`/api/time/entries?projectId=${projectId}&includeActive=true`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!projectId,
  });

  const timeEntries = timeEntriesResponse?.entries || [];

  // Calculate labor summary
  const laborSummary: LaborSummary = {
    totalEntries: timeEntries.length,
    totalHours: timeEntries.reduce((sum, entry) => sum + (entry.durationMinutes || 0) / 60, 0),
    totalLaborCost: timeEntries.reduce((sum, entry) => sum + Number(entry.laborCost || 0), 0),
    activeEntries: timeEntries.filter(entry => !entry.endTime).length,
    byWorker: Object.values(
      timeEntries.reduce((acc, entry) => {
        if (!entry.user) return acc;
        const userId = entry.user.id;
        if (!acc[userId]) {
          acc[userId] = {
            userId,
            userName: `${entry.user.firstName} ${entry.user.lastName}`,
            hours: 0,
            cost: 0,
            entries: 0,
          };
        }
        acc[userId].hours += (entry.durationMinutes || 0) / 60;
        acc[userId].cost += Number(entry.laborCost || 0);
        acc[userId].entries += 1;
        return acc;
      }, {} as Record<number, any>)
    ).sort((a, b) => b.cost - a.cost),
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'In progress';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getGeofenceBadge = (withinGeofence: boolean | null) => {
    if (withinGeofence === null) return null;
    return withinGeofence ? (
      <Badge className="bg-green-100 text-green-800">On Site</Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800 gap-1">
        <AlertCircle className="h-3 w-3" />
        Off Site
      </Badge>
    );
  };

  if (isLoadingEntries) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (entriesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Labor Data</CardTitle>
          <CardDescription>Failed to load time tracking information</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Labor Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Hours</p>
                <p className="text-2xl font-bold text-slate-900">
                  {laborSummary.totalHours.toFixed(1)}h
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Labor Cost</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${laborSummary.totalLaborCost.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Time Entries</p>
                <p className="text-2xl font-bold text-slate-900">
                  {laborSummary.totalEntries}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Now</p>
                <p className="text-2xl font-bold text-slate-900">
                  {laborSummary.activeEntries}
                </p>
              </div>
              <User className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Labor by Worker */}
      {laborSummary.byWorker.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Labor by Worker
            </CardTitle>
            <CardDescription>
              Time and costs breakdown per worker
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {laborSummary.byWorker.map((worker) => (
                <div key={worker.userId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{worker.userName}</p>
                      <p className="text-sm text-slate-600">{worker.entries} entries</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">${worker.cost.toFixed(2)}</p>
                    <p className="text-sm text-slate-600">{worker.hours.toFixed(1)} hours</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Time Entries
          </CardTitle>
          <CardDescription>
            Clock in/out history with labor costs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No time entries yet</p>
              <p className="text-sm mt-1">Workers will appear here when they clock in</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.slice(0, 20).map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">
                          {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown User'}
                        </span>
                        {!entry.endTime && (
                          <Badge className="bg-green-100 text-green-800">Currently Clocked In</Badge>
                        )}
                        {entry.clockInWithinGeofence !== null && getGeofenceBadge(entry.clockInWithinGeofence)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(entry.startTime), 'MMM dd, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(entry.startTime), 'h:mm a')}
                          {entry.endTime && ` - ${format(new Date(entry.endTime), 'h:mm a')}`}
                        </span>
                        <span>Duration: {formatDuration(entry.durationMinutes)}</span>
                      </div>

                      {entry.notes && (
                        <p className="text-sm text-slate-500 mt-2">{entry.notes}</p>
                      )}
                    </div>

                    <div className="text-right ml-4">
                      {entry.laborCost ? (
                        <>
                          <div className="text-xl font-bold text-slate-900">
                            ${Number(entry.laborCost).toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-500">
                            @ ${entry.user?.hourlyRate || '0'}/hr
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-500">
                          {entry.user?.hourlyRate ? 'In progress' : 'No rate set'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
