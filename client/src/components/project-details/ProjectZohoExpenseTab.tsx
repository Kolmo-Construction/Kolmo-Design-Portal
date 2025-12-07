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

interface ProjectZohoExpenseTabProps {
  project: Project;
}

interface ZohoExpenseConfig {
  configured: boolean;
  connected: boolean;
  message: string;
}

export function ProjectTaggunTab({ project }: ProjectTaggunTabProps) {
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

  // Fetch Taggun configuration
  const { data: taggunConfig } = useQuery<TaggunConfig>({
    queryKey: ['/api/taggun/status'],
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
      const response = await apiRequest('POST', `/api/zoho-expense/projects/${project.id}/sync`, {
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
        description: `Zoho tag updated to: ${newTag}`,
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
    },
    onError: (error: any) => {
      console.error('Tag update error:', error);
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update Zoho tag",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!editedOwnerName || !editedDate) {
      toast({
        title: "Validation Error",
        description: "Please provide both owner name and creation date",
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

  if (!taggunConfig?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Taggun Receipt Scanning
          </CardTitle>
          <CardDescription>
            Taggun is not configured. Contact your administrator to set up receipt scanning.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tag Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Zoho Expense Tag Configuration
          </CardTitle>
          <CardDescription>
            Configure the project tag used for expense tracking in Zoho Expense. 
            This tag helps categorize expenses for this specific project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Tag Display */}
          <div className="p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-slate-700">Current Zoho Tag</Label>
                <div className="mt-1">
                  <code className="px-2 py-1 bg-white border rounded text-sm font-mono">
                    {currentTag || 'Not configured'}
                  </code>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && (
            <div className="space-y-4 p-4 border rounded-lg bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Project Owner Name
                  </Label>
                  <Input
                    id="ownerName"
                    value={editedOwnerName}
                    onChange={(e) => setEditedOwnerName(e.target.value)}
                    placeholder="Enter project owner name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creationDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Project Creation Date
                  </Label>
                  <Input
                    id="creationDate"
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <Label className="text-sm font-medium text-blue-800">Preview Tag</Label>
                <div className="mt-1">
                  <code className="text-blue-900 font-mono text-sm">
                    {newTag || 'Enter owner name and date to preview'}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
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
                  {updateTagMutation.isPending ? 'Updating...' : 'Save Changes'}
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

          {/* Tag Usage Instructions */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-medium text-amber-800 mb-2">How to Use This Tag</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Use this tag when submitting expenses in Zoho Expense</li>
              <li>• Add the tag to the "Project" field in your expense reports</li>
              <li>• All expenses with this tag will appear in the project budget tracking</li>
              <li>• Format: OwnerName_YYYY-MM-DD (spaces and special characters removed)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Budget Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget vs Expenses
          </CardTitle>
          <CardDescription>
            Real-time comparison of project budget against Zoho Expense data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                ${Number(project.totalBudget).toLocaleString()}
              </div>
              <div className="text-sm text-blue-600">Total Budget</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">$0</div>
              <div className="text-sm text-orange-600">Total Expenses</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${Number(project.totalBudget).toLocaleString()}
              </div>
              <div className="text-sm text-green-600">Remaining Budget</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-slate-600">
            Expense data will appear here once Zoho Expense is authorized and expenses are submitted with the project tag.
          </div>
        </CardContent>
      </Card>

      {/* Integration Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={taggunConfig?.connected ? "default" : "destructive"}>
              {taggunConfig?.connected ? "Connected" : "Disconnected"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {taggunConfig?.message}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
