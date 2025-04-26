import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  FileText,
  MessageSquare,
  ArrowLeft,
  Loader2,
} from "lucide-react";

// Import the new child components
import { ProjectOverviewCard } from "@/components/project-details/ProjectOverviewCard";
import { ProjectUpdatesTab } from "@/components/project-details/ProjectUpdatesTab";
import { ProjectDocumentsTab } from "@/components/project-details/ProjectDocumentsTab";
import { ProjectFinancialsTab } from "@/components/project-details/ProjectFinancialsTab";
import { ProjectMessagesTab } from "@/components/project-details/ProjectMessagesTab";
import { ProjectScheduleTab } from "@/components/project-details/ProjectScheduleTab";
import { cn } from "@/lib/utils"; // Import cn if needed for Badge styling

// Helper function to get status label (can be moved to a utils file)
const getStatusLabel = (status: string | undefined | null): string => {
    if (!status) return 'Unknown';
    switch (status) {
      case "planning": return "Planning";
      case "in_progress": return "In Progress";
      case "on_hold": return "On Hold";
      case "completed": return "Completed";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

// Helper function to get status badge variant/color (can be moved to a utils file)
const getStatusBadgeVariant = (status: string | undefined | null): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return "secondary";
    switch (status) {
        case "planning": return "default"; // Or choose a specific color
        case "in_progress": return "default"; // Use primary color via default variant
        case "on_hold": return "secondary"; // Or a yellow variant if defined
        case "completed": return "outline"; // Or a green variant if defined
        default: return "secondary";
    }
};

// Helper function for more specific coloring if needed (and theme supports it)
const getStatusColorClass = (status: string | undefined | null): string => {
     if (!status) return "bg-slate-100 text-slate-800 border-slate-300";
     switch (status) {
        case "planning": return "bg-blue-100 text-blue-800 border-blue-300";
        case "in_progress": return "bg-primary/10 text-primary border-primary/30"; // Example using primary
        case "on_hold": return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case "completed": return "bg-green-100 text-green-800 border-green-300";
        default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
};


export default function ProjectDetails() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const params = useParams();
  // Ensure projectId is parsed correctly and defaults to 0 if invalid/missing
  const projectId = params.id ? parseInt(params.id, 10) : 0;
  const [activeTab, setActiveTab] = useState('updates'); // Default tab

  // Fetch ONLY project details here
  const {
    data: project,
    isLoading: isLoadingProject,
    error: projectError
  } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !isNaN(projectId) && projectId > 0, // Only fetch if projectId is a valid number > 0
  });

  // --- Loading State ---
  if (isLoadingProject) {
    return (
      <div className="flex h-screen bg-slate-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-slate-600">Loading project details...</p>
          </div>
        </main>
      </div>
    );
  }

  // --- Error or Not Found State ---
  // Handle invalid projectId explicitly or rely on API 404 mapped to error by queryFn
  if ((!isNaN(projectId) && projectId <= 0) || projectError || !project) {
    const errorMessage = projectError instanceof Error
      ? projectError.message
      : "The project you are looking for does not exist or you don't have access to it.";
    return (
      <div className="flex h-screen bg-slate-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Project Not Found</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/projects">
                <Button className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Projects
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Success State ---
  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        {/* Back Button */}
        <div className="mb-4">
          <Link href="/projects">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        </div>

        {/* Project Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1"> {/* Allow wrapping */}
              <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
               <Badge variant="outline" className={getStatusColorClass(project.status)}>
                    {getStatusLabel(project.status)}
                </Badge>
            </div>
            <p className="text-slate-600 flex items-center gap-1 text-sm md:text-base">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              {project.address}, {project.city}, {project.state} {project.zipCode}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0"> {/* Prevent buttons shrinking */}
            {/* Adjusted button actions to switch tabs */}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab('messages')}>
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Contact Team</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setActiveTab('documents')}>
              <FileText className="h-4 w-4" />
               <span className="hidden sm:inline">View Documents</span>
            </Button>
          </div>
        </div>

        {/* Project Overview Card */}
        <ProjectOverviewCard project={project} />

        {/* Project Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          {/* Make TabsList scrollable on small screens */}
          <div className="overflow-x-auto mb-4 pb-1">
             <TabsList className="grid grid-flow-col auto-cols-max w-max sm:w-full sm:grid-cols-5 gap-1">
                <TabsTrigger value="updates">Updates</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
             </TabsList>
          </div>


          {/* Render Tab Content using new components */}
          <TabsContent value="updates" className="mt-0">
             {activeTab === 'updates' && <ProjectUpdatesTab projectId={projectId} />}
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
             {activeTab === 'documents' && <ProjectDocumentsTab projectId={projectId} />}
          </TabsContent>
          <TabsContent value="financials" className="mt-0">
              {activeTab === 'financials' && <ProjectFinancialsTab project={project} />}
          </TabsContent>
          <TabsContent value="messages" className="mt-0">
             {activeTab === 'messages' && <ProjectMessagesTab projectId={projectId} />}
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
             {activeTab === 'schedule' && <ProjectScheduleTab projectId={projectId} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}