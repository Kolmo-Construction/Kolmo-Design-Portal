import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patchMutationFn, getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TimeEntryWithUser {
  id: number;
  userId: number;
  projectId: number;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  project?: {
    id: number;
    name: string;
  };
}

interface EditTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimeEntryWithUser | null;
}

export function EditTimeEntryDialog({ open, onOpenChange, entry }: EditTimeEntryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  // Populate form when entry changes
  useEffect(() => {
    if (entry && open) {
      setUserId(String(entry.userId));
      setProjectId(String(entry.projectId));

      const startDate = new Date(entry.startTime);
      setDate(format(startDate, 'yyyy-MM-dd'));
      setStartTime(format(startDate, 'HH:mm'));

      if (entry.endTime) {
        const endDate = new Date(entry.endTime);
        setEndTime(format(endDate, 'HH:mm'));
      }

      setNotes(entry.notes || "");
    }
  }, [entry, open]);

  // Fetch users and projects for dropdowns
  const { data: usersData } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open,
  });

  const users = usersData || [];
  const projects = projectsData || [];

  // Update entry mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => patchMutationFn(`/api/time/entries/${entry?.id}`)(data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Time entry updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/time/entries'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update time entry",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!entry) return;

    // Combine date and time
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = endTime ? new Date(`${date}T${endTime}`) : null;

    // Validation
    if (endDateTime && endDateTime <= startDateTime) {
      toast({
        title: "Validation Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      userId: parseInt(userId),
      projectId: parseInt(projectId),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime ? endDateTime.toISOString() : null,
      notes,
    });
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
          <DialogDescription>
            Update the details of this time entry
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user">Worker *</Label>
            <select
              id="user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="">Select worker...</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.role})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              required
            >
              <option value="">Select project...</option>
              {projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this time entry..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
