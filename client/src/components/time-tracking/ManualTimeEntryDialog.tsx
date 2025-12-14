import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postMutationFn, getQueryFn } from "@/lib/queryClient";
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

interface ManualTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualTimeEntryDialog({ open, onOpenChange }: ManualTimeEntryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");

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

  // Create manual entry mutation
  const createMutation = useMutation({
    mutationFn: postMutationFn('/api/time/manual-entry'),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Time entry created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/time/entries'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create time entry",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setUserId("");
    setProjectId("");
    setDate(new Date().toISOString().split('T')[0]);
    setStartTime("09:00");
    setEndTime("17:00");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Combine date and time
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    // Validation
    if (!userId || !projectId) {
      toast({
        title: "Validation Error",
        description: "Please select a user and project",
        variant: "destructive",
      });
      return;
    }

    if (endDateTime <= startDateTime) {
      toast({
        title: "Validation Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      userId: parseInt(userId),
      projectId: parseInt(projectId),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Manual Time Entry</DialogTitle>
          <DialogDescription>
            Create a time entry manually without GPS tracking
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
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
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
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
