import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import ApprovalItem from "@/components/ApprovalItem";
import { Selection, Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckSquare,
  Loader2,
  Calendar,
  Filter
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export default function Selections() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const { toast } = useToast();

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all selections across all projects
  const { 
    data: allSelections = [],
    isLoading: isLoadingSelections 
  } = useQuery<Selection[]>({
    queryKey: ["/api/selections"],
    enabled: projects.length > 0,
  });

  // Filter selections based on project and status
  const filteredSelections = allSelections.filter(selection => {
    const matchesProject = projectFilter === "all" || selection.projectId.toString() === projectFilter;
    const matchesStatus = statusFilter === "all" || selection.status === statusFilter;
    return matchesProject && matchesStatus;
  });

  // Update selection choice mutation
  const updateSelectionMutation = useMutation({
    mutationFn: async (data: { id: number, selection: string }) => {
      const res = await apiRequest(
        "PUT", 
        `/api/projects/${selectedSelection?.projectId}/selections/${data.id}`, 
        { selectedOption: data.selection }
      );
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Selection Saved",
        description: "Your selection has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/selections"] });
      setSelectedSelection(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Save Selection",
        description: error.message || "There was an error saving your selection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle opening the selection review dialog
  const handleReviewSelection = (id: number) => {
    const selection = allSelections.find(s => s.id === id);
    if (selection) {
      setSelectedSelection(selection);
      setSelectedOption(selection.selectedOption || "");
    }
  };

  // Handle saving the selection choice
  const handleSaveSelection = () => {
    if (selectedSelection && selectedOption) {
      updateSelectionMutation.mutate({
        id: selectedSelection.id,
        selection: selectedOption
      });
    } else {
      toast({
        title: "Selection Required",
        description: "Please select an option before submitting.",
        variant: "destructive",
      });
    }
  };

  // Format date
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "No deadline";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-24 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Selections & Approvals</h1>
          <p className="text-slate-600">Review and approve material selections for your projects</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-500 mb-1 block">Project</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-500 mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Selection Review Dialog */}
        {selectedSelection && (
          <Dialog open={!!selectedSelection} onOpenChange={(open) => !open && setSelectedSelection(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Review Selection: {selectedSelection.title}</DialogTitle>
                <DialogDescription>
                  Please review the options and make your selection for {selectedSelection.category}
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div className="mb-4">
                  <p className="text-sm text-slate-500 mb-1">Project</p>
                  <p className="font-medium">
                    {projects.find(p => p.id === selectedSelection.projectId)?.name || `Project ID: ${selectedSelection.projectId}`}
                  </p>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-slate-500 mb-1">Description</p>
                  <p className="text-slate-700">{selectedSelection.description || "No description provided"}</p>
                </div>
                
                {selectedSelection.selectionDeadline && (
                  <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Selection deadline:</span> {formatDate(selectedSelection.selectionDeadline)}
                    </p>
                  </div>
                )}
                
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Options:</h4>
                  
                  {selectedSelection.options && (
                    <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
                      <div className="space-y-3">
                        {Object.entries(selectedSelection.options as Record<string, any>).map(([key, option]) => (
                          <div key={key} className="flex items-start space-x-2 border p-3 rounded-md hover:bg-slate-50">
                            <RadioGroupItem value={key} id={`option-${key}`} className="mt-1" />
                            <div className="flex-1">
                              <Label htmlFor={`option-${key}`} className="font-medium">
                                {option.name || key}
                              </Label>
                              {option.description && (
                                <p className="text-sm text-slate-500 mt-1">{option.description}</p>
                              )}
                              {option.price && (
                                <p className="text-sm text-slate-700 mt-1">
                                  <span className="font-medium">Price:</span> ${option.price}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedSelection(null)}
                  disabled={updateSelectionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveSelection}
                  disabled={!selectedOption || updateSelectionMutation.isPending}
                >
                  {updateSelectionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Selection"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Content Tabs */}
        <Tabs defaultValue="pending" className="mb-6">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="selected">Selected</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
          </TabsList>
          
          {/* Tab Contents */}
          {["pending", "selected", "approved"].map((status) => (
            <TabsContent key={status} value={status}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {status === "pending" ? "Pending Selections" : 
                     status === "selected" ? "Selected Items" : 
                     "Approved Selections"}
                  </CardTitle>
                  <CardDescription>
                    {status === "pending" ? "Items waiting for your selection" : 
                     status === "selected" ? "Items you have selected but pending final approval" : 
                     "Items that have received final approval"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(isLoadingProjects || isLoadingSelections) ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  ) : filteredSelections.filter(s => statusFilter === "all" ? s.status === status : true).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="rounded-full bg-primary-50 p-3 mb-4">
                        <CheckSquare className="h-6 w-6 text-primary-600" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No {status} items</h3>
                      <p className="text-center text-slate-500 mb-6 max-w-md">
                        {status === "pending" 
                          ? "You don't have any pending selections to review." 
                          : status === "selected" 
                          ? "You haven't made any selections yet."
                          : "No approvals have been finalized yet."}
                      </p>
                      {(projectFilter !== "all" || statusFilter !== "all") && (
                        <Button 
                          variant="outline" 
                          className="gap-2"
                          onClick={() => {
                            setProjectFilter("all");
                            setStatusFilter("all");
                          }}
                        >
                          <Filter className="h-4 w-4" />
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              {status === "pending" ? "Deadline" : "Date Selected"}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredSelections
                            .filter(selection => selection.status === status)
                            .map((selection) => (
                              <ApprovalItem 
                                key={selection.id} 
                                approval={selection} 
                                onReview={handleReviewSelection}
                              />
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
