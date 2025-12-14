import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, deleteMutationFn } from "@/lib/queryClient";
import { TimeEntry } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Clock, User, Calendar, MapPin, AlertCircle,
  Plus, Download, Edit, Trash2
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ManualTimeEntryDialog } from "@/components/time-tracking/ManualTimeEntryDialog";
import { EditTimeEntryDialog } from "@/components/time-tracking/EditTimeEntryDialog";

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

interface TimeEntriesResponse {
  success: boolean;
  entries: TimeEntryWithUser[];
  summary: {
    totalEntries: number;
    totalHours: number;
  };
}

export default function TimeTracking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntryWithUser | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');

  // Fetch all time entries
  const { data: timeEntriesData, isLoading } = useQuery<TimeEntriesResponse>({
    queryKey: [`/api/time/entries?includeActive=true`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const timeEntries = timeEntriesData?.entries || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMutationFn(`/api/time/entries/${id}`)(),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Time entry deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/time/entries'] });
      setDeleteDialogOpen(false);
      setDeletingEntryId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete time entry",
        variant: "destructive",
      });
    },
  });

  // Calculate statistics
  const activeSessions = timeEntries.filter(entry => !entry.endTime);
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const todayEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.startTime);
    return entryDate >= todayStart && entryDate <= todayEnd;
  });
  const todayHours = todayEntries.reduce((sum, entry) => sum + (entry.durationMinutes || 0) / 60, 0);

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.startTime);
    return entryDate >= weekStart && entryDate <= weekEnd;
  });
  const weekHours = weekEntries.reduce((sum, entry) => sum + (entry.durationMinutes || 0) / 60, 0);
  const weekCost = weekEntries.reduce((sum, entry) => sum + Number(entry.laborCost || 0), 0);

  const uniqueProjects = Array.from(new Set(timeEntries.map(e => e.project?.name).filter(Boolean)));
  const uniqueWorkers = Array.from(new Set(timeEntries.map(e =>
    e.user ? `${e.user.firstName} ${e.user.lastName}` : null
  ).filter(Boolean)));

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Active';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getGeofenceBadge = (withinGeofence: boolean | null) => {
    if (withinGeofence === null) return null;
    return withinGeofence ? (
      <Badge className="bg-green-100 text-green-800 text-xs">On Site</Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800 text-xs gap-1">
        <AlertCircle className="h-3 w-3" />
        Off Site
      </Badge>
    );
  };

  const calculateActiveDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleEdit = (entry: TimeEntryWithUser) => {
    setEditingEntry(entry);
    setShowEditDialog(true);
  };

  const handleDelete = (entryId: number) => {
    setDeletingEntryId(entryId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingEntryId) {
      deleteMutation.mutate(deletingEntryId);
    }
  };

  const exportToCSV = () => {
    const headers = ['Worker', 'Project', 'Date', 'Start Time', 'End Time', 'Duration (hrs)', 'Labor Cost', 'Geofence', 'Notes'];
    const rows = timeEntries.map(entry => [
      entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown',
      entry.project?.name || 'Unknown',
      format(new Date(entry.startTime), 'yyyy-MM-dd'),
      format(new Date(entry.startTime), 'HH:mm'),
      entry.endTime ? format(new Date(entry.endTime), 'HH:mm') : 'Active',
      entry.durationMinutes ? (entry.durationMinutes / 60).toFixed(2) : '0',
      entry.laborCost || '0',
      entry.clockInWithinGeofence ? 'On Site' : 'Off Site',
      entry.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `time-entries-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: "Success",
      description: `Exported ${timeEntries.length} time entries to CSV`,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Time Tracking</h1>
          <p className="text-slate-600 mt-1">Manage time entries across all projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button className="gap-2" onClick={() => setShowManualDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Manual Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-slate-600 mt-1">
              {activeSessions.length === 1 ? 'worker clocked in' : 'workers clocked in'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayHours.toFixed(1)}</div>
            <p className="text-xs text-slate-600 mt-1">
              {todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekHours.toFixed(1)}h</div>
            <p className="text-xs text-slate-600 mt-1">
              ${weekCost.toFixed(2)} labor cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <User className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeEntries.length}</div>
            <p className="text-xs text-slate-600 mt-1">all time records</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions Widget */}
      {activeSessions.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
              Currently Clocked In ({activeSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeSessions.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-slate-600" />
                    <div>
                      <div className="font-medium text-sm">
                        {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-600">
                        {entry.project?.name || 'Unknown Project'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-green-700">
                      {calculateActiveDuration(entry.startTime)}
                    </div>
                    {getGeofenceBadge(entry.clockInWithinGeofence)}
                  </div>
                </div>
              ))}
              {activeSessions.length > 5 && (
                <p className="text-xs text-slate-600 text-center pt-2">
                  +{activeSessions.length - 5} more active sessions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Time Entries</CardTitle>
            <div className="flex gap-2">
              <select
                className="text-sm border rounded-md px-3 py-1.5"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
              <select
                className="text-sm border rounded-md px-3 py-1.5"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="all">All Projects</option>
                {uniqueProjects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
              <select
                className="text-sm border rounded-md px-3 py-1.5"
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
              >
                <option value="all">All Workers</option>
                {uniqueWorkers.map(worker => (
                  <option key={worker} value={worker}>{worker}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No time entries found</p>
              </div>
            ) : (
              timeEntries.slice(0, 50).map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">
                          {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Unknown User'}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-sm text-slate-600">{entry.project?.name || 'Unknown Project'}</span>
                        {!entry.endTime && (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
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
                        <span className="font-medium">
                          {entry.endTime ? formatDuration(entry.durationMinutes) : calculateActiveDuration(entry.startTime)}
                        </span>
                        {entry.clockInDistanceMeters && (
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3" />
                            {Math.round(Number(entry.clockInDistanceMeters))}m from site
                          </span>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-sm text-slate-500 mt-2">{entry.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        {entry.laborCost ? (
                          <>
                            <div className="text-lg font-bold text-slate-900">
                              ${Number(entry.laborCost).toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-500">
                              @ ${entry.user?.hourlyRate || '0'}/hr
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500">
                            {entry.user?.hourlyRate ? 'In progress' : 'No rate'}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ManualTimeEntryDialog
        open={showManualDialog}
        onOpenChange={setShowManualDialog}
      />
      <EditTimeEntryDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        entry={editingEntry}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this time entry
              from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
