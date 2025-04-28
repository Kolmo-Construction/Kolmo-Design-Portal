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
  CardDescription, // Keep if used by error card
  CardHeader,      // Keep if used by error card
  CardTitle        // Keep if used by error card
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button"; // Keep for Back button
// --- REMOVED: Badge import (now in ProjectHeader) ---
import {
  // Building2, // Icon not used directly here anymore
  // MapPin,      // Icon moved to ProjectHeader
  // FileText,    // Icon moved to ProjectHeader
  // MessageSquare, // Icon moved to ProjectHeader
  ArrowLeft,     // Icon used for Back button
  Loader2,       // Icon used for loading state
  // --- ADDED Icons used only for Tabs (kept): ---
  ListChecks, // For Punch List
  ClipboardList, // For Tasks
  NotebookText // For Daily Logs
} from "lucide-react";
// Import the existing child components
import { ProjectOverviewCard } from "@/components/project-details/ProjectOverviewCard";
import { ProjectUpdatesTab } from "@/components/project-details/ProjectUpdatesTab";
import { ProjectDocumentsTab } from "@/components/project-details/ProjectDocumentsTab";
import { ProjectFinancialsTab } from "@/components/project-details/ProjectFinancialsTab";
import { ProjectMessagesTab } from "@/components/project-details/ProjectMessagesTab";
import { ProjectScheduleTab } from "@/components/project-details/ProjectScheduleTab";
import { ProjectTasksTab } from "@/components/project-details/ProjectTasksTab";
import { ProjectDailyLogsTab } from "@/components/project-details/ProjectDailyLogsTab";
import { ProjectPunchListTab } from "@/components/project-details/ProjectPunchListTab";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
// --- ADDED: Import the new ProjectHeader component ---
import { ProjectHeader } from "@/components/project-details/ProjectHeader";
// --- END ADDED ---


// --- REMOVED: Helper functions getStatusLabel, getStatusBadgeVariant, getStatusColorClass (assumed moved to utils.txt previously) ---


export default function ProjectDetails() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const params = useParams();
  const projectId = params.id ? parseInt(params.id, 10) : 0;
  const [activeTab, setActiveTab] = useState('updates'); // Default tab

  const { user } = useAuth();

  // Fetch ONLY project details here
  const {
    data: project,
    isLoading: isLoadingProject,
    error: projectError
  } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !isNaN(projectId) && projectId > 0,
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

        {/* --- MODIFIED: Render ProjectHeader component --- */}
        <ProjectHeader project={project} setActiveTab={setActiveTab} />
        {/* --- END MODIFIED --- */}

        {/* --- REMOVED: Original Project Header JSX --- */}

        {/* Project Overview Card */}
        <ProjectOverviewCard project={project} />

        {/* Project Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
           {/* Make TabsList scrollable on small screens */}
           <div className="overflow-x-auto mb-4 pb-1">
              <TabsList className={cn(
                  "grid grid-flow-col auto-cols-max w-max sm:w-full gap-1",
                  user?.role === 'client' ? 'sm:grid-cols-5' : 'sm:grid-cols-8' // 5 for client, 8 for internal
              )}>
                 <TabsTrigger value="updates">Updates</TabsTrigger>
                  {/* Conditionally render internal tabs */}
                  {user?.role !== 'client' && (
                     <>
                       <TabsTrigger value="tasks">Tasks</TabsTrigger>
                       <TabsTrigger value="dailylogs">Daily Logs</TabsTrigger>
                       <TabsTrigger value="punchlist">Punch List</TabsTrigger>
                    </>
                  )}
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="financials">Financials</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
               </TabsList>
           </div>

          {/* Render Tab Content using child components */}
          <TabsContent value="updates" className="mt-0">
             {activeTab === 'updates' && <ProjectUpdatesTab projectId={projectId} />}
          </TabsContent>
          {/* Conditionally render internal tab content */}
          {user?.role !== 'client' && (
            <>
              <TabsContent value="tasks" className="mt-0">
                {activeTab === 'tasks' && <ProjectTasksTab projectId={projectId} />}
              </TabsContent>
              <TabsContent value="dailylogs" className="mt-0">
                {activeTab === 'dailylogs' && <ProjectDailyLogsTab projectId={projectId} />}
              </TabsContent>
              <TabsContent value="punchlist" className="mt-0">
                {activeTab === 'punchlist' && <ProjectPunchListTab projectId={projectId} />}
              </TabsContent>
            </>
          )}
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