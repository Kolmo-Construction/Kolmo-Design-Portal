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
  ArrowLeft,
  Loader2,
  User,
  ListChecks,
  ClipboardList,
  NotebookText,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  MessageSquare,
  Clock,
  Target,
  Tag,
  Images,
  Brain,
  Receipt,
  CheckCircle
} from "lucide-react";
import { ProjectOverviewCard } from "@/components/project-details/ProjectOverviewCard";
import { ProjectUpdatesTab } from "@/components/project-details/ProjectUpdatesTab";
import { ProjectDocumentsTab } from "@/components/project-details/ProjectDocumentsTab";
import { ProjectFinanceTab } from "@/components/project-details/ProjectFinanceTab";
import { ProjectMessagesTab } from "@/components/project-details/ProjectMessagesTab";
import { ProjectScheduleTab } from "@/components/project-details/ProjectScheduleTab";
import { ProjectTasksTab } from "@/components/project-details/ProjectTasksTab";
import { ProjectDailyLogsTab } from "@/components/project-details/ProjectDailyLogsTab";
import { ProjectPunchListTab } from "@/components/project-details/ProjectPunchListTab";
import { ProjectReceiptsTab } from "@/components/project-details/ProjectReceiptsTab";
import { ProjectImagesTab } from "@/components/project-details/ProjectImagesTab";
import { ProjectLaborTab } from "@/components/project-details/ProjectLaborTab";
import { UnifiedContentReviewTab } from "@/components/project-details/UnifiedContentReviewTab";
import { GenerateAIReportDialog } from "@/components/admin/GenerateAIReportDialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-unified";

export default function ProjectDetails() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const params = useParams();
  const projectId = params.id ? parseInt(params.id, 10) : 0;
  const [activeTab, setActiveTab] = useState('updates');
  const [generateReportDialogOpen, setGenerateReportDialogOpen] = useState(false);

  const { user } = useAuth();

  // Fetch project details
  const {
    data: project,
    isLoading: isLoadingProject,
    error: projectError
  } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !isNaN(projectId) && projectId > 0,
  });

  // Helper function to get status badge styling
  const getStatusBadgeStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Loading State
  if (isLoadingProject) {
    return (
      <div className="h-screen bg-kolmo-background">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="lg:ml-64 p-4 lg:p-8 pt-24 h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-kolmo-accent mx-auto mb-4" />
            <p className="text-kolmo-secondary">Loading project details...</p>
          </div>
        </main>
      </div>
    );
  }

  // Error or Not Found State
  if ((!isNaN(projectId) && projectId <= 0) || projectError || !project) {
    const errorMessage = projectError instanceof Error
      ? projectError.message
      : "The project you are looking for does not exist or you don't have access to it.";
    return (
      <div className="h-screen bg-kolmo-background">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="lg:ml-64 p-4 lg:p-8 pt-24 h-full flex items-center justify-center">
          <Card className="w-full max-w-md border-red-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Not Found
              </CardTitle>
              <CardDescription className="text-kolmo-secondary">{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/projects">
                <Button className="w-full gap-2 bg-kolmo-primary hover:bg-kolmo-secondary text-white">
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

  // Success State
  return (
    <div className="min-h-screen bg-kolmo-background-accent">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="lg:ml-64 pt-24 pb-8 px-4 lg:px-8">
        {/* Header Section with Kolmo.io branding */}
        <div className="mb-8">
          {/* Navigation & Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <Link href="/projects">
              <Button variant="outline" size="sm" className="gap-2 border-kolmo-secondary text-kolmo-secondary hover:bg-kolmo-secondary hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Back to Projects
              </Button>
            </Link>
            
            <div className="flex flex-wrap gap-2">
              {user?.role === 'admin' && (
                <a href="/client-portal" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2 border-kolmo-accent text-kolmo-accent hover:bg-kolmo-accent hover:text-white">
                    <User className="h-4 w-4" />
                    View Client Portal
                  </Button>
                </a>
              )}

              {user?.role !== 'client' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
                    onClick={() => setGenerateReportDialogOpen(true)}
                  >
                    <Brain className="h-4 w-4" />
                    Generate AI Report
                  </Button>
                  <Link href={`/project-generation/${projectId}`}>
                    <Button size="sm" className="gap-2 bg-kolmo-accent hover:bg-kolmo-accent/90 text-white">
                      <ClipboardList className="h-4 w-4" />
                      Generate Tasks
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Project Header Card */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-kolmo-primary to-kolmo-secondary text-white">
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <Building2 className="h-8 w-8 text-kolmo-accent" />
                    <div>
                      <h1 className="text-3xl font-bold">{project.name}</h1>
                      <Badge className={cn("mt-2", getStatusBadgeStyle(project.status))}>
                        {project.status?.charAt(0).toUpperCase() + project.status?.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  
                  {project.description && (
                    <p className="text-white/90 text-lg mb-4 max-w-2xl">{project.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-6 text-white/80">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{project.address}, {project.city}, {project.state}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span>${project.totalBudget}</span>
                    </div>
                    {project.estimatedCompletionDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {new Date(project.estimatedCompletionDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Progress Circle */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-white/20"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - (project.progress || 0) / 100)}`}
                        className="text-kolmo-accent transition-all duration-300"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold">{project.progress || 0}%</span>
                    </div>
                  </div>
                  <span className="text-white/80 text-sm font-medium">Progress</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project Overview Stats */}
        <ProjectOverviewCard project={project} />

        {/* Project Tabs with Kolmo.io styling */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <div className="overflow-x-auto mb-6">
            <TabsList className={cn(
              "grid grid-flow-col auto-cols-max w-max sm:w-full gap-1 bg-white border border-kolmo-primary/10 p-1",
              user?.role === 'client' ? 'sm:grid-cols-7' : 'sm:grid-cols-12'
            )}>
              <TabsTrigger value="updates" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <TrendingUp className="h-4 w-4 mr-2" />
                Updates
              </TabsTrigger>
              <TabsTrigger value="images" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <Images className="h-4 w-4 mr-2" />
                Images
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <ListChecks className="h-4 w-4 mr-2" />
                Tasks
              </TabsTrigger>

              {user?.role !== 'client' && (
                <>
                  <TabsTrigger value="dailylogs" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                    <NotebookText className="h-4 w-4 mr-2" />
                    Daily Logs
                  </TabsTrigger>
                  <TabsTrigger value="punchlist" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                    <Target className="h-4 w-4 mr-2" />
                    Punch List
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="documents" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="financials" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <DollarSign className="h-4 w-4 mr-2" />
                Financials
              </TabsTrigger>
              {user?.role !== 'client' && (
                <TabsTrigger value="labor" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                  <Clock className="h-4 w-4 mr-2" />
                  Labor
                </TabsTrigger>
              )}
              <TabsTrigger value="messages" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                <Clock className="h-4 w-4 mr-2" />
                Schedule
              </TabsTrigger>
              {user?.role === 'admin' && (
                <>
                  <TabsTrigger value="receipts" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                    <Receipt className="h-4 w-4 mr-2" />
                    Receipts
                  </TabsTrigger>
                  <TabsTrigger value="review" className="data-[state=active]:bg-kolmo-accent data-[state=active]:text-white">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Review & Publish
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-kolmo-primary/10">
            <TabsContent value="updates" className="mt-0 p-6">
              {activeTab === 'updates' && <ProjectUpdatesTab projectId={projectId} />}
            </TabsContent>

            <TabsContent value="images" className="mt-0 p-6">
              {activeTab === 'images' && <ProjectImagesTab projectId={projectId} />}
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 p-6">
              {activeTab === 'tasks' && <ProjectTasksTab projectId={projectId} user={user || undefined} project={project} />}
            </TabsContent>
            
            {user?.role !== 'client' && (
              <>
                <TabsContent value="dailylogs" className="mt-0 p-6">
                  {activeTab === 'dailylogs' && <ProjectDailyLogsTab projectId={projectId} />}
                </TabsContent>
                <TabsContent value="punchlist" className="mt-0 p-6">
                  {activeTab === 'punchlist' && <ProjectPunchListTab projectId={projectId} />}
                </TabsContent>
              </>
            )}
            <TabsContent value="documents" className="mt-0 p-6">
              {activeTab === 'documents' && <ProjectDocumentsTab projectId={projectId} />}
            </TabsContent>
            <TabsContent value="financials" className="mt-0 p-6">
              {activeTab === 'financials' && <ProjectFinanceTab projectId={projectId} />}
            </TabsContent>
            {user?.role !== 'client' && (
              <TabsContent value="labor" className="mt-0 p-6">
                {activeTab === 'labor' && <ProjectLaborTab projectId={projectId} />}
              </TabsContent>
            )}
            <TabsContent value="messages" className="mt-0 p-6">
              {activeTab === 'messages' && <ProjectMessagesTab projectId={projectId} />}
            </TabsContent>
            <TabsContent value="schedule" className="mt-0 p-6">
              {activeTab === 'schedule' && <ProjectScheduleTab projectId={projectId} />}
            </TabsContent>
            {user?.role === 'admin' && (
              <>
                <TabsContent value="receipts" className="mt-0 p-6">
                  {activeTab === 'receipts' && <ProjectReceiptsTab project={project} />}
                </TabsContent>
                <TabsContent value="review" className="mt-0 p-6">
                  {activeTab === 'review' && <UnifiedContentReviewTab projectId={projectId} />}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </main>

      {/* Generate AI Report Dialog */}
      <GenerateAIReportDialog
        open={generateReportDialogOpen}
        onOpenChange={setGenerateReportDialogOpen}
        projectId={projectId}
        projectName={project?.name || 'Project'}
      />
    </div>
  );
}