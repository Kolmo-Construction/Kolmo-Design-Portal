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
  User,          // Icon used for View Client Portal button
  // --- ADDED Icons used only for Tabs (kept): ---
  ListChecks, // For Punch List
  ClipboardList, // For Tasks
  NotebookText // For Daily Logs
} from "lucide-react";
// Import the existing child components
import { ProjectOverviewCard } from "@/components/project-details/ProjectOverviewCard";
import { ProjectUpdatesTab } from "@/components/project-details/ProjectUpdatesTab";
import { ProjectDocumentsTab } from "@/components/project-details/ProjectDocumentsTab";
import { ProjectFinanceTab } from "@/components/project-details/ProjectFinanceTab";
import { ProjectMessagesTab } from "@/components/project-details/ProjectMessagesTab";
import { ProjectScheduleTab } from "@/components/project-details/ProjectScheduleTab";
import { ProjectTasksTab } from "@/components/project-details/ProjectTasksTab";
import { ProjectDailyLogsTab } from "@/components/project-details/ProjectDailyLogsTab";
import { ProjectPunchListTab } from "@/components/project-details/ProjectPunchListTab";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-unified";
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
      <div className="h-screen bg-slate-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="lg:ml-64 p-4 lg:p-8 pt-28 h-full flex items-center justify-center">
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
      <div className="h-screen bg-slate-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="lg:ml-64 p-4 lg:p-8 pt-28 h-full flex items-center justify-center">
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
    <div className="h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="lg:ml-64 p-4 lg:p-8 pt-28 overflow-auto h-full">
        {/* Navigation Buttons */}
        <div className="mb-4 flex justify-between">
          <Link href="/projects">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
          
          <div className="flex gap-2">
            {/* Admin-only link to view client portal */}
            {user?.role === 'admin' && (
              <Link href={`/project-details/${projectId}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  View Client Portal
                </Button>
              </Link>
            )}
            
            {/* Only show task generation button for admin and project managers */}
            {user?.role !== 'client' && (
              <Link href={`/project-generation/${projectId}`}>
                <Button variant="default" size="sm" className="gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Generate Tasks
                </Button>
              </Link>
            )}
          </div>
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
                  user?.role === 'client' ? 'sm:grid-cols-6' : 'sm:grid-cols-8' // 6 for client (added tasks), 8 for internal
              )}>
                 <TabsTrigger value="updates">Updates</TabsTrigger>
                  {/* Make Tasks tab available to all users (including clients) */}
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  
                  {/* Conditionally render internal-only tabs */}
                  {user?.role !== 'client' && (
                     <>
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
          
          {/* Make Tasks tab content available to all users (including clients) */}
          <TabsContent value="tasks" className="mt-0">
            {activeTab === 'tasks' && <ProjectTasksTab projectId={projectId} user={user || undefined} project={project} />}
          </TabsContent>
          
          {/* Conditionally render internal-only tab content */}
          {user?.role !== 'client' && (
            <>
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
              {activeTab === 'financials' && <ProjectFinanceTab projectId={projectId} />}
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