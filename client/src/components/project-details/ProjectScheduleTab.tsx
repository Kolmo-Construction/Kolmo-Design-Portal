import { useQuery, useMutation } from "@tanstack/react-query";
import { Milestone } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
// REMOVED: format, isBefore, isToday imports from date-fns (now handled in utils)
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// REMOVED: Badge import (now handled in utils)
import { Calendar, CheckCircle2, Loader2, Plus, DollarSign, Edit2 } from "lucide-react"; // Removed ClockIcon, AlertTriangle (now in utils)
// ADDED: Import centralized helpers
import { formatDate, getMilestoneBadge, getMilestoneVisuals } from "@/lib/utils";

interface ProjectScheduleTabProps {
  projectId: number;
}

// REMOVED: Local formatDate helper function
// REMOVED: Local getMilestoneBadge helper function
// REMOVED: Local getMilestoneVisuals helper function

export function ProjectScheduleTab({ projectId }: ProjectScheduleTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  
  // Form state for milestone creation/editing
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    plannedDate: "",
    category: "",
    isBillable: false,
    billingPercentage: 0,
    status: "pending"
  });

  const {
    data: milestones = [],
    isLoading: isLoadingMilestones
  } = useQuery<Milestone[]>({
    queryKey: [`/api/projects/${projectId}/milestones`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Create milestone mutation
  const createMilestoneMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/projects/${projectId}/milestones`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Milestone created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create milestone",
        variant: "destructive",
      });
    },
  });

  // Update milestone mutation
  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/projects/${projectId}/milestones/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] });
      setEditingMilestone(null);
      resetForm();
      toast({
        title: "Success",
        description: "Milestone updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update milestone",
        variant: "destructive",
      });
    },
  });

  // Complete milestone mutation (triggers billing)
  const completeMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: number) => {
      // First complete the milestone
      await apiRequest(`/api/projects/${projectId}/milestones/${milestoneId}/complete`, "PATCH");
      // Then trigger billing for billable milestones
      return await apiRequest(`/api/projects/${projectId}/milestones/${milestoneId}/bill`, "POST");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] });
      toast({
        title: "Success",
        description: `Milestone completed and invoice ${data.invoice?.invoiceNumber} created`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete milestone",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      plannedDate: "",
      category: "",
      isBillable: false,
      billingPercentage: 0,
      status: "pending"
    });
  };

  const handleCreateMilestone = () => {
    createMilestoneMutation.mutate(formData);
  };

  const handleUpdateMilestone = () => {
    if (editingMilestone) {
      updateMilestoneMutation.mutate({
        id: editingMilestone.id,
        data: formData
      });
    }
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setFormData({
      title: milestone.title,
      description: milestone.description || "",
      plannedDate: milestone.plannedDate ? new Date(milestone.plannedDate).toISOString().split('T')[0] : "",
      category: milestone.category || "",
      isBillable: milestone.isBillable || false,
      billingPercentage: Number(milestone.billingPercentage) || 0,
      status: milestone.status || "pending"
    });
  };

  const handleCompleteMilestone = (milestoneId: number) => {
    completeMilestoneMutation.mutate(milestoneId);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'project_manager';

  // Sort milestones (can be moved to utils, but okay here too)
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.status !== "completed" && b.status === "completed") return -1;
    if (a.status === "completed" && b.status !== "completed") return 1;
    // Ensure dates are valid before creating Date objects
    const dateAStr = a.status === "completed" ? (a.actualDate || a.plannedDate) : a.plannedDate;
    const dateBStr = b.status === "completed" ? (b.actualDate || b.plannedDate) : b.plannedDate;
    const dateA = dateAStr ? new Date(dateAStr) : new Date(0); // Fallback to epoch if undefined/null
    const dateB = dateBStr ? new Date(dateBStr) : new Date(0);
    if (isNaN(dateA.getTime())) return 1; // Invalid dates last
    if (isNaN(dateB.getTime())) return -1;
    return dateA.getTime() - dateB.getTime();
  });

  // Milestone creation/edit dialog component
  const MilestoneDialog = ({ isOpen, onClose, isEdit = false }: { isOpen: boolean; onClose: () => void; isEdit?: boolean }) => (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Milestone' : 'Create New Milestone'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update milestone details and billing information' : 'Add a new milestone to track project progress and billing'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Milestone Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Foundation Complete, Framing Started"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the milestone"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plannedDate">Planned Date</Label>
              <Input
                id="plannedDate"
                type="date"
                value={formData.plannedDate}
                onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="permits">Permits</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="completion">Completion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isBillable"
              checked={formData.isBillable}
              onCheckedChange={(checked) => setFormData({ ...formData, isBillable: !!checked })}
            />
            <Label htmlFor="isBillable" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              This is a billable milestone
            </Label>
          </div>
          {formData.isBillable && (
            <div>
              <Label htmlFor="billingPercentage">Billing Percentage</Label>
              <Input
                id="billingPercentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.billingPercentage}
                onChange={(e) => setFormData({ ...formData, billingPercentage: parseFloat(e.target.value) || 0 })}
                placeholder="25.0"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Percentage of total project value to bill when completed
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={isEdit ? handleUpdateMilestone : handleCreateMilestone}
            disabled={!formData.title || !formData.plannedDate || (createMilestoneMutation.isPending || updateMilestoneMutation.isPending)}
          >
            {(createMilestoneMutation.isPending || updateMilestoneMutation.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isEdit ? 'Update Milestone' : 'Create Milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Project Timeline</CardTitle>
            <CardDescription>Internal milestones for project tracking and billing management</CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingMilestones ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary-50 p-3 mb-4">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-slate-500">No milestones have been set for this project yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-slate-200 -z-10"></div>
            <ul className="space-y-6">
              {sortedMilestones.map((milestone) => {
                 // USE Imported helper
                 const { icon, colorClass } = getMilestoneVisuals(milestone);
                return (
                  <li key={milestone.id} className="relative pl-12">
                    {/* Icon */}
                    <div className="absolute left-[2px] top-[1px] flex items-center justify-center w-10 h-10">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white ${colorClass}`}>
                        {icon}
                      </div>
                    </div>
                    {/* Content Card */}
                    <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-800">{milestone.title}</h4>
                          {milestone.isBillable && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                              <DollarSign className="h-3 w-3" />
                              {milestone.billingPercentage}%
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* USE Imported helper */}
                          {getMilestoneBadge(milestone)}
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditMilestone(milestone)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              {milestone.status === 'pending' && milestone.isBillable && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCompleteMilestone(milestone.id)}
                                  disabled={completeMilestoneMutation.isPending}
                                >
                                  {completeMilestoneMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Complete & Bill
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {milestone.description && <p className="text-sm text-slate-500 mb-3">{milestone.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                         <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {/* USE Imported helper */}
                          <span className="font-medium">Planned:</span> {formatDate(milestone.plannedDate)}
                        </div>
                         {milestone.actualDate && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                             {/* USE Imported helper */}
                             <span className="font-medium">Completed:</span> {formatDate(milestone.actualDate)}
                          </div>
                        )}
                        {milestone.category && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Category:</span> {milestone.category}
                          </div>
                        )}
                        {milestone.billedAt && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-green-500" />
                            <span className="font-medium">Billed:</span> {formatDate(milestone.billedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                   </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Milestone Creation Dialog */}
        <MilestoneDialog 
          isOpen={isCreateDialogOpen} 
          onClose={() => {
            setIsCreateDialogOpen(false);
            resetForm();
          }} 
        />

        {/* Milestone Edit Dialog */}
        <MilestoneDialog 
          isOpen={!!editingMilestone} 
          onClose={() => {
            setEditingMilestone(null);
            resetForm();
          }} 
          isEdit={true}
        />
      </CardContent>
    </Card>
  );
}