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
        {/* Overall Progress Section */}
        <div className="mb-12">
          <Card className="border-accent/20 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <BarChart3 className="h-7 w-7 text-accent" />
                Project Progress Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium">Overall Completion</span>
                    <span className="text-2xl font-bold text-accent">{Math.round(progressPercentage)}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-4" />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>{stats.completedTasks} completed</span>
                    <span>{stats.totalTasks - stats.completedTasks} remaining</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary mb-2">{stats.totalProjects}</div>
                    <div className="text-sm text-muted-foreground">Active Projects</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-accent mb-2">{stats.completedTasks}</div>
                    <div className="text-sm text-muted-foreground">Tasks Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-secondary mb-2">{Math.round(stats.avgProgress)}%</div>
                    <div className="text-sm text-muted-foreground">Average Progress</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-primary">Your Projects</h2>
          
          {dashboardData?.projects.length === 0 ? (
            <Card className="border-muted">
              <CardContent className="pt-12 pb-12 text-center">
                <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Your projects will appear here once they are assigned to you.
                </p>
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {dashboardData?.projects.map((project) => (
                <Card key={project.id} className="border-accent/20 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl text-primary">{project.name}</CardTitle>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="bg-accent/10 text-accent border-accent/20">
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Project Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Project Progress</span>
                        <span className="text-lg font-bold text-accent">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-3" />
                    </div>

                    {/* Task Progress */}
                    {project.completedTasks !== undefined && project.totalTasks !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">Tasks Progress</span>
                          <span className="text-sm font-medium">{project.completedTasks}/{project.totalTasks}</span>
                        </div>
                        <Progress 
                          value={project.totalTasks > 0 ? (project.completedTasks / project.totalTasks) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>
                    )}

                    {/* Timeline Preview */}
                    {project.timeline && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Project Timeline
                        </h4>
                        <div className="space-y-2">
                          {project.timeline.slice(0, 3).map((phase, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                phase.status === 'completed' ? 'bg-green-500' :
                                phase.status === 'in-progress' ? 'bg-accent' : 'bg-muted'
                              }`} />
                              <span className="text-sm">{phase.phase}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{phase.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Project Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <div className="font-medium">{project.address ? `${project.city}, ${project.state}` : 'Not specified'}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div className="font-medium capitalize">{project.status}</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Link to={`/messages?project=${project.id}`}>
                        <Button className="flex-1 bg-accent hover:bg-accent/90">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Team Chat
                        </Button>
                      </Link>
                      <Link to={`/documents?project=${project.id}`}>
                        <Button variant="outline" className="flex-1">
                          <FileText className="h-4 w-4 mr-2" />
                          Documents
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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