import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DialCircle } from '@/components/ui/dial-circle';
import {
  Building,
  MessageSquare,
  FileText,
  Calendar,
  Clock,
  DollarSign,
  Circle,
  CheckCircle,
  AlertCircle,
  User,
  Target,
  TrendingUp,
  Activity,
  BarChart3,
  Timer,
  Image
} from 'lucide-react';
import { ClientNavigation } from '@/components/ClientNavigation';
import { DashboardRecentUpdates } from '@/components/client/DashboardRecentUpdates';
import { getQueryFn } from '@/lib/queryClient';
import type { Task } from '@shared/schema';

// TaskTimeline component for displaying project tasks in timeline format
function TaskTimeline({ projectId }: { projectId: number }) {
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-start gap-4">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No tasks yet for this project</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
      
      {tasks.map((task, index) => {
        const isCompleted = task.status?.toLowerCase() === 'done' || task.status?.toLowerCase() === 'completed';
        const isInProgress = task.status?.toLowerCase() === 'in_progress' || task.status?.toLowerCase() === 'in progress';
        const taskDate = task.startDate ? new Date(task.startDate).toLocaleDateString() : 'Not scheduled';
        
        return (
          <div key={task.id} className="relative flex items-start gap-4 pb-6">
            {/* Timeline Dot */}
            <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              isCompleted 
                ? 'bg-green-100 border-green-500' 
                : isInProgress 
                  ? 'bg-accent/10 border-accent' 
                  : 'bg-gray-100 border-gray-300'
            }`}>
              {isCompleted ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : isInProgress ? (
                <Clock className="h-4 w-4 text-accent" />
              ) : (
                <Circle className="h-3 w-3 text-gray-400" />
              )}
            </div>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex-1">
                  <h4 className={`font-medium text-sm ${
                    isCompleted ? 'text-green-700' : 'text-foreground'
                  }`}>
                    {task.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {task.priority || 'General'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {taskDate}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
                <Badge 
                  variant={isCompleted ? 'default' : 'secondary'}
                  className={`text-xs ${
                    isCompleted 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : isInProgress
                        ? 'bg-accent/10 text-accent border-accent/20'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {isCompleted ? 'Complete' : 
                   isInProgress ? 'In Progress' : 'Pending'}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Project {
  id: number;
  name: string;
  status: string;
  progress: number;
  description?: string;
  completedTasks?: number;
  totalTasks?: number;
  estimatedCompletion?: string;
  timeline?: {
    phase: string;
    status: 'completed' | 'in-progress' | 'pending';
    date: string;
  }[];
}

interface ClientDashboardData {
  projects: Project[];
  recentUpdates: any[];
  unreadMessages: any[];
  pendingInvoices: any[];
  overallStats: {
    totalProjects: number;
    completedTasks: number;
    totalTasks: number;
    avgProgress: number;
  };
  financialStats: {
    totalBudget: number;
    totalInvoiced: number;
    remaining: number;
    percentageUsed: number;
  };
}

export default function ClientPortal() {
  const { user, authState } = useAuth();

  const { data: dashboardData, isLoading } = useQuery<ClientDashboardData>({
    queryKey: ['/api/client/dashboard'],
    enabled: !!user && (user.role === 'client' || user.role === 'admin')
  });

  if (authState === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'client' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
                <p className="text-muted-foreground mb-4">
                  This portal is exclusively for client users. Please contact support if you need access.
                </p>
                <Link to="/auth">
                  <Button variant="outline" className="w-full">
                    Return to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.overallStats || {
    totalProjects: 0,
    completedTasks: 0,
    totalTasks: 0,
    avgProgress: 0
  };

  const progressPercentage = stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <ClientNavigation />
      
      {/* Hero Section - Simplified */}
      <div className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground">
        <div className="container mx-auto px-6 pt-24 pb-12">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Welcome back, {user.firstName}
            </h1>
            <p className="text-lg opacity-90 mb-10">
              Track your project progress and stay connected with your team.
            </p>

            {/* Stats Overview - Compact Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-center">
                <div className="text-3xl font-bold mb-1">{stats.totalProjects}</div>
                <div className="text-sm opacity-90">Active Projects</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-center">
                <div className="text-3xl font-bold mb-1">{stats.completedTasks}</div>
                <div className="text-sm opacity-90">Tasks Done</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-center">
                <div className="text-3xl font-bold mb-1">{Math.round(progressPercentage)}%</div>
                <div className="text-sm opacity-90">Progress</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 text-center">
                <div className="text-3xl font-bold mb-1">{stats.totalTasks - stats.completedTasks}</div>
                <div className="text-sm opacity-90">Remaining</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-10 max-w-7xl">
        {/* Main Content Grid - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Left Column - Budget & Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Budget Tracker */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 rounded-full p-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Budget Tracker</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Budget Overview */}
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs text-muted-foreground">Total Budget</p>
                    <p className="text-xl font-bold text-primary">
                      ${(dashboardData?.financialStats?.totalBudget || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs text-muted-foreground">Invoiced</p>
                    <p className="text-xl font-bold text-accent">
                      ${(dashboardData?.financialStats?.totalInvoiced || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>{Math.round(dashboardData?.financialStats?.percentageUsed || 0)}% used</span>
                    <span>${(dashboardData?.financialStats?.remaining || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} left</span>
                  </div>
                  <Progress
                    value={dashboardData?.financialStats?.percentageUsed || 0}
                    className="h-2.5"
                  />
                </div>

                {/* Budget Status Alert */}
                {(dashboardData?.financialStats?.percentageUsed || 0) > 90 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      Budget over 90% used. Review upcoming expenses.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions - Compact */}
            <Card className="border-muted shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/messages">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Messages
                    {dashboardData?.unreadMessages.length ? (
                      <Badge className="ml-auto bg-destructive text-destructive-foreground text-xs">{dashboardData.unreadMessages.length}</Badge>
                    ) : null}
                  </Button>
                </Link>
                <Link to="/documents">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents
                  </Button>
                </Link>
                <Link to="/photos">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Image className="h-4 w-4 mr-2" />
                    Photos
                  </Button>
                </Link>
                <Link to="/invoices">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Invoices
                    {dashboardData?.pendingInvoices.length ? (
                      <Badge className="ml-auto bg-amber-500 text-white text-xs">{dashboardData.pendingInvoices.length}</Badge>
                    ) : null}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Updates & Projects */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Updates */}
            <DashboardRecentUpdates />

            {/* Project Timeline */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-primary flex items-center gap-2">
                <Building className="h-6 w-6" />
                Your Projects
              </h2>
          
          {dashboardData?.projects.length === 0 ? (
            <Card className="border-muted">
              <CardContent className="pt-8 pb-8 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your projects will appear here once they are assigned to you.
                </p>
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.projects.map((project, projectIndex) => (
              <div key={project.id} className="mb-8">
                {/* Project Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {project.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {project.progress}% complete
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/messages?project=${project.id}`}>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                    </Link>
                    <Link to={`/documents?project=${project.id}`}>
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-1" />
                        Docs
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <Progress value={project.progress} className="h-2" />
                </div>

                {/* Timeline of Tasks */}
                <TaskTimeline projectId={project.id} />
              </div>
            ))
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}