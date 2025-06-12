import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Building, 
  MessageSquare, 
  FileText, 
  Calendar,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  User,
  Target,
  TrendingUp,
  Activity,
  BarChart3,
  Timer
} from 'lucide-react';
import { ClientNavigation } from '@/components/ClientNavigation';

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
}

export default function ClientPortal() {
  const { user, authState } = useAuth();

  const { data: dashboardData, isLoading } = useQuery<ClientDashboardData>({
    queryKey: ['/api/client/dashboard'],
    enabled: !!user && user.role === 'client'
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

  if (!user || user.role !== 'client') {
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
      
      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 pt-24 pb-16">
          <div className="max-w-4xl">
            <h1 className="text-4xl font-bold mb-4">
              Welcome back, {user.firstName}
            </h1>
            <p className="text-xl opacity-90 mb-8">
              Track your project progress and stay connected with your construction team.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Building className="h-8 w-8 text-accent" />
                  <div>
                    <div className="text-2xl font-bold">{stats.totalProjects}</div>
                    <div className="text-sm opacity-80">Active Projects</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-accent" />
                  <div>
                    <div className="text-2xl font-bold">{stats.completedTasks}</div>
                    <div className="text-sm opacity-80">Tasks Completed</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Target className="h-8 w-8 text-accent" />
                  <div>
                    <div className="text-2xl font-bold">{stats.totalTasks}</div>
                    <div className="text-sm opacity-80">Total Tasks</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-accent" />
                  <div>
                    <div className="text-2xl font-bold">{Math.round(progressPercentage)}%</div>
                    <div className="text-sm opacity-80">Overall Progress</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Simplified Progress Overview */}
        <div className="mb-8">
          <Card className="border-accent/20 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Your Progress</h2>
                <span className="text-3xl font-bold text-accent">{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-3 mb-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{stats.completedTasks} of {stats.totalTasks} tasks completed</span>
                <span>{stats.totalTasks - stats.completedTasks} remaining</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project Timeline */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-primary">Project Timeline</h2>
          
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
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
                  
                  {/* Mock tasks for visual timeline - replace with real task data */}
                  {[
                    { id: 1, name: 'Initial Planning & Design', status: 'completed', date: 'Jan 15', type: 'design' },
                    { id: 2, name: 'Permits & Documentation', status: 'completed', date: 'Jan 22', type: 'admin' },
                    { id: 3, name: 'Site Preparation', status: 'in-progress', date: 'Feb 1', type: 'construction' },
                    { id: 4, name: 'Foundation Work', status: 'pending', date: 'Feb 8', type: 'construction' },
                    { id: 5, name: 'Framing & Structure', status: 'pending', date: 'Feb 15', type: 'construction' },
                    { id: 6, name: 'Final Inspection', status: 'pending', date: 'Mar 1', type: 'admin' }
                  ].map((task, index) => (
                    <div key={task.id} className="relative flex items-start gap-4 pb-6">
                      {/* Timeline Dot */}
                      <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        task.status === 'completed' 
                          ? 'bg-green-100 border-green-500' 
                          : task.status === 'in-progress' 
                            ? 'bg-accent/10 border-accent' 
                            : 'bg-gray-100 border-gray-300'
                      }`}>
                        {task.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : task.status === 'in-progress' ? (
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
                              task.status === 'completed' ? 'text-green-700' : 'text-foreground'
                            }`}>
                              {task.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" size="sm" className="text-xs">
                                {task.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {task.date}
                              </span>
                            </div>
                          </div>
                          <Badge 
                            variant={task.status === 'completed' ? 'default' : 'secondary'}
                            className={`text-xs ${
                              task.status === 'completed' 
                                ? 'bg-green-100 text-green-800 border-green-200' 
                                : task.status === 'in-progress'
                                  ? 'bg-accent/10 text-accent border-accent/20'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {task.status === 'completed' ? 'Complete' : 
                             task.status === 'in-progress' ? 'In Progress' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-accent/20 hover:border-accent/40 transition-colors">
            <CardContent className="pt-6">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-accent mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Team Messages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Stay connected with your project team
                </p>
                <Link to="/messages">
                  <Button className="w-full bg-accent hover:bg-accent/90">
                    View Messages
                    {dashboardData?.unreadMessages.length ? (
                      <Badge className="ml-2 bg-destructive">{dashboardData.unreadMessages.length}</Badge>
                    ) : null}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 hover:border-accent/40 transition-colors">
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="h-12 w-12 text-accent mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Project Documents</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Access contracts, plans, and reports
                </p>
                <Link to="/documents">
                  <Button className="w-full bg-accent hover:bg-accent/90">
                    View Documents
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 hover:border-accent/40 transition-colors">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-12 w-12 text-accent mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Invoices & Payments</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Review billing and payment status
                </p>
                <Link to="/invoices">
                  <Button className="w-full bg-accent hover:bg-accent/90">
                    View Invoices
                    {dashboardData?.pendingInvoices.length ? (
                      <Badge className="ml-2 bg-destructive">{dashboardData.pendingInvoices.length}</Badge>
                    ) : null}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}