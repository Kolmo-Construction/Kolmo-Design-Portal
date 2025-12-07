import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Project, User } from "@shared/schema"; // Keep User type for managers
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient"; // Keep getQueryFn
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Loader2,
  PlusCircle,
  RotateCw,
  Search,
} from "lucide-react";
// Import the child components
import { ProjectListTable } from "@/components/project-management/ProjectListTable";
import { CreateProjectDialog } from "@/components/project-management/CreateProjectDialog";
import { EditProjectDialog } from "@/components/project-management/EditProjectDialog";
import { DeleteProjectDialog } from "@/components/project-management/DeleteProjectDialog";
// --- ADDED: Import the new hook ---
import { useProjectManagementDialogs } from '@/hooks/useProjectManagementDialogs';
import { usePaymentManagement } from '@/hooks/usePaymentManagement';
// --- END ADDED ---


export default function ProjectManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // --- REMOVED: Dialog state useState hooks ---
  // --- REMOVED: selectedProject useState hook ---
  const [statusFilter, setStatusFilter] = useState("all"); // Keep filter state
  const [searchQuery, setSearchQuery] = useState(""); // Keep search state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // --- ADDED: Get dialog state and handlers from hook ---
  const {
      isCreateDialogOpen,
      setIsCreateDialogOpen, // Use if Dialog uses onOpenChange
      // openCreateDialog, // Use if Button needs explicit open handler

      isEditDialogOpen,
      setIsEditDialogOpen, // Use if Dialog uses onOpenChange

      selectedProject, // Pass down to EditProjectDialog

      openEditDialog, // Pass down to ProjectListTable
  } = useProjectManagementDialogs();

  // --- ADDED: Get payment management functionality ---
  const { triggerDownPayment, triggerMilestone } = usePaymentManagement();

  const handleTriggerDownPayment = (projectId: number) => {
    triggerDownPayment.mutate({ projectId });
  };

  const handleTriggerMilestone = (projectId: number, paymentType: 'milestone' | 'final') => {
    triggerMilestone.mutate({ projectId, paymentType });
  };
  // --- END ADDED ---

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}`);
      return res;
    },
    onSuccess: async () => {
      // Invalidate and refetch projects list for immediate UI update
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      await refetchProjects();

      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);

      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      console.error("Delete project error:", error);
      toast({
        title: "Failed to delete project",
        description: error.message || "An unexpected error occurred while deleting the project.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProject = () => {
    if (projectToDelete) {
      deleteProjectMutation.mutate(projectToDelete.id);
    }
  };

  // Redirect if not an admin
  useEffect(() => {
      if (user && user.role !== "admin") {
        navigate("/");
      }
  }, [user, navigate]);

  // Get all projects
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useQuery<Project[], Error>({
    queryKey: ["/api/projects"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: user?.role === 'admin', // Ensure enabled only when appropriate
  });

  // Get all project managers for assignment dropdowns
  const {
    data: projectManagers = [],
    isLoading: managersLoading,
  } = useQuery<User[], Error>({
    queryKey: ["/api/project-managers"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: user?.role === 'admin', // Ensure enabled only when appropriate
  });

  // Filter projects based on status and search query
  const filteredProjects = projects.filter(project => {
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.address?.toLowerCase().includes(searchQuery.toLowerCase()) || // Add null checks
      project.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||    // Add null checks
      project.state?.toLowerCase().includes(searchQuery.toLowerCase());   // Add null checks
    return matchesStatus && matchesSearch;
  });

  // --- REMOVED: handleEditProject function ---

  // Render error state for initial data load
  if (projectsError) {
     return (
          <div className="flex h-screen bg-slate-50">
              <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
              <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
              <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-24 flex items-center justify-center">
                <p className="text-red-600">Error loading project data. Please try refreshing.</p>
              </main>
          </div>
       );
  }

  // Main component render
  return (
    <div className="h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="lg:ml-64 p-4 lg:p-8 pt-24 overflow-auto h-full">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Project Management</h1>
            <p className="text-slate-600">Create, edit and manage construction projects</p>
          </div>
          {/* --- MODIFIED: Use setter from hook --- */}
          <Button
            onClick={() => setIsCreateDialogOpen(true)} // Use direct setter
            // onClick={openCreateDialog} // Alternative: use explicit handler
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Create Project
          </Button>
          {/* --- END MODIFIED --- */}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6 flex flex-col sm:flex-row gap-4 items-end">
            {/* Status Filter */}
            <div className="w-full sm:w-1/3">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Search Filter */}
            <div className="w-full sm:w-2/3 relative">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search projects by name or address"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project List */}
        <Card>
          <CardHeader className="px-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Projects</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => refetchProjects()}
                disabled={projectsLoading}
              >
                 <RotateCw className={`h-4 w-4 ${projectsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <CardDescription>
              All construction and renovation projects
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
             <div className="overflow-x-auto">
                {/* --- MODIFIED: Pass handler from hook --- */}
                <ProjectListTable
                    projects={filteredProjects}
                    projectManagers={projectManagers}
                    isLoading={projectsLoading || managersLoading}
                    onEditProject={openEditDialog} // Pass handler from hook
                    onDeleteProject={handleDeleteProject}
                    onTriggerDownPayment={handleTriggerDownPayment}
                    onTriggerMilestone={handleTriggerMilestone}
                />
                {/* --- END MODIFIED --- */}
             </div>
          </CardContent>
        </Card>
      </main>

       {/* --- MODIFIED: Use state and setters from hook --- */}
       <CreateProjectDialog
         isOpen={isCreateDialogOpen}
         onOpenChange={setIsCreateDialogOpen} // Use setter from hook
         projectManagers={projectManagers}
         isLoadingManagers={managersLoading}
       />

        <EditProjectDialog
         projectToEdit={selectedProject} // Use project from hook state
         isOpen={isEditDialogOpen}
         setIsOpen={setIsEditDialogOpen} // Use controlled setter from hook
         projectManagers={projectManagers}
         isLoadingManagers={managersLoading}
       />

       <DeleteProjectDialog
         isOpen={isDeleteDialogOpen}
         onOpenChange={setIsDeleteDialogOpen}
         projectName={projectToDelete?.name || ""}
         onConfirm={confirmDeleteProject}
         isDeleting={deleteProjectMutation.isPending}
       />
       {/* --- END MODIFIED --- */}
    </div>
  );
}