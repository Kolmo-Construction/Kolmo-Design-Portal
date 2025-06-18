import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Tag,
  Edit,
  Save,
  X,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Calendar,
  User
} from "lucide-react";

interface ProjectExpensifyTabProps {
  project: Project;
}

interface ExpensifyConfig {
  configured: boolean;
  connected: boolean;
  message: string;
}

export function ProjectExpensifyTab({ project }: ProjectExpensifyTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOwnerName, setEditedOwnerName] = useState(project.customerName || '');
  const [editedDate, setEditedDate] = useState(
    project.createdAt ? new Date(project.createdAt).toISOString().split('T')[0] : ''
  );
  const [currentOwnerName, setCurrentOwnerName] = useState(project.customerName || '');
  const [currentDate, setCurrentDate] = useState(
    project.createdAt ? new Date(project.createdAt).toISOString().split('T')[0] : ''
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Expensify configuration
  const { data: expensifyConfig } = useQuery<ExpensifyConfig>({
    queryKey: ['/api/expensify/config'],
  });

  // Generate current tag
  const generateTag = (ownerName: string, date: string) => {
    if (!ownerName || !date) return '';
    const cleanOwnerName = ownerName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    return `${cleanOwnerName}_${date}`;
  };

  const currentTag = generateTag(currentOwnerName, currentDate);

  const newTag = generateTag(editedOwnerName, editedDate);

  // Update project tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/expensify/projects/${project.id}/sync`, {
        customerName: editedOwnerName,
        creationDate: editedDate
      });
      return response;
    },
    onSuccess: (data) => {
      console.log('Tag update successful:', data);
      // Update the current tag values to reflect the changes
      setCurrentOwnerName(editedOwnerName);
      setCurrentDate(editedDate);
      toast({
        title: "Tag Updated",
        description: `Expensify tag updated to: ${newTag}`,
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
    },
    onError: (error: any) => {
      console.error('Tag update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update Expensify tag",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!editedOwnerName.trim()) {
      toast({
        title: "Invalid Input",
        description: "Owner name is required",
        variant: "destructive",
      });
      return;
    }

    if (!editedDate) {
      toast({
        title: "Invalid Input", 
        description: "Creation date is required",
        variant: "destructive",
      });
      return;
    }

    updateTagMutation.mutate();
  };

  const handleCancel = () => {
    setEditedOwnerName(currentOwnerName);
    setEditedDate(currentDate);
    setIsEditing(false);
  };

  if (!expensifyConfig?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Expensify Integration
          </CardTitle>
          <CardDescription>
            Expensify is not configured. Contact your administrator to set up expense tracking.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tag Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Expensify Tag Management
          </CardTitle>
          <CardDescription>
            Manage the Expensify tag used for expense tracking on this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            // View Mode
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <div className="font-medium text-lg">{currentTag || 'No tag generated'}</div>
                  <div className="text-sm text-muted-foreground">
                    Use this tag when submitting expenses in Expensify
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Tag
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-background border rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Project Owner</div>
                    <div className="font-medium">{project.customerName || 'Not set'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-background border rounded-lg">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Creation Date</div>
                    <div className="font-medium">
                      {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Not set'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Project Owner Name</Label>
                  <Input
                    id="ownerName"
                    value={editedOwnerName}
                    onChange={(e) => setEditedOwnerName(e.target.value)}
                    placeholder="Enter owner name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creationDate">Creation Date</Label>
                  <Input
                    id="creationDate"
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                  />
                </div>
              </div>

              {newTag && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">New Tag Preview:</div>
                  <div className="text-lg font-mono">{newTag}</div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={updateTagMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {updateTagMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateTagMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            How to Use This Tag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">1</div>
              <div>
                <div className="font-medium">Submit Expenses in Expensify</div>
                <div className="text-sm text-muted-foreground">When creating expense reports, add the tag: <code className="px-1 py-0.5 bg-muted rounded text-xs">{currentTag || '[tag]'}</code></div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">2</div>
              <div>
                <div className="font-medium">Automatic Budget Tracking</div>
                <div className="text-sm text-muted-foreground">Expenses with this tag will automatically appear in the project's budget tracking dashboard</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">3</div>
              <div>
                <div className="font-medium">Real-time Monitoring</div>
                <div className="text-sm text-muted-foreground">View expense totals and budget utilization in the Finance tab</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={expensifyConfig?.connected ? "default" : "destructive"}>
              {expensifyConfig?.connected ? "Connected" : "Disconnected"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {expensifyConfig?.message}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}