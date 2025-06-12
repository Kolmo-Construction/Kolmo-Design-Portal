import React from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Target,
  TrendingUp,
  User,
  Users
} from 'lucide-react';
import { ClientNavigation } from '@/components/ClientNavigation';
import { Link } from 'wouter';

interface ProjectTask {
  id: number;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
}

interface ProjectDetails {
  id: number;
  name: string;
  description: string;
  status: string;
  progress: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  startDate: string;
  estimatedCompletionDate: string;
  totalBudget: string;
  projectManager: {
    firstName: string;
    lastName: string;
    email: string;
  };
  completedTasks: number;
  totalTasks: number;
  timeline: Array<{
    phase: string;
    status: 'completed' | 'in-progress' | 'pending';
    date: string;
  }>;
  recentTasks: ProjectTask[];
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: project, isLoading } = useQuery<ProjectDetails>({
    queryKey: ['/api/projects', id],
    enabled: !!user && !!id && (user.role === 'client' || user.role === 'admin')
  });

  if (!user || (user.role !== 'client' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6 text-center">
              <Building className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">This page is for client users and administrators only.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading project details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The project you're looking for doesn't exist or you don't have access to it.
              </p>
              <Link to="/client-portal">
                <Button>Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const progressPercentage = project.totalTasks > 0 ? (project.completedTasks / project.totalTasks) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <ClientNavigation />
      
      {/* Admin Banner - only show for admin users */}
      {user?.role === 'admin' && (
        <div className="bg-orange-500 text-white px-4 py-2 text-center text-sm font-medium mt-16">
          <div className="flex items-center justify-center gap-2">
            <User className="h-4 w-4" />
            Admin View: You are viewing this project from the client perspective
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex items-center gap-4 mb-6">
            <Link to={user?.role === 'admin' ? `/projects/${id}` : "/client-portal"}>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {user?.role === 'admin' ? 'Back to Project Details' : 'Back to Dashboard'}
              </Button>
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
              <div className="flex items-center gap-4 text-primary-foreground/80">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{project.city}, {project.state}</span>
                </div>
                <Badge variant="secondary" className="bg-accent text-white">
                  {project.status}
                </Badge>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-accent">{project.progress}%</div>
              <div className="text-sm opacity-80">Complete</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Progress Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <Card className="lg:col-span-2 border-accent/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-accent" />
                Project Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-medium">Overall Progress</span>
                    <span className="text-2xl font-bold text-accent">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-4" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium">Task Completion</span>
                    <span className="font-bold">{project.completedTasks}/{project.totalTasks}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-3" />
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{project.completedTasks}</div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">{project.totalTasks - project.completedTasks}</div>
                    <div className="text-sm text-muted-foreground">Remaining</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{project.totalTasks}</div>
                    <div className="text-sm text-muted-foreground">Total Tasks</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-6 w-6 text-accent" />
                Project Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="font-semibold text-lg">
                    {project.projectManager?.firstName && project.projectManager?.lastName 
                      ? `${project.projectManager.firstName} ${project.projectManager.lastName}`
                      : 'Project Manager'}
                  </div>
                  <div className="text-muted-foreground">Project Manager</div>
                </div>
                
                <div className="space-y-3">
                  {project.projectManager?.email && (
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <a href={`mailto:${project.projectManager.email}`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Email
                      </a>
                    </Button>
                  )}
                  
                  <Link to="/messages">
                    <Button className="w-full justify-start bg-accent hover:bg-accent/90">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Project Chat
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="border-accent/20 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-accent" />
              Project Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {project.timeline && project.timeline.length > 0 ? project.timeline.map((phase, index) => (
                <div key={index} className="flex items-center gap-4 p-4 rounded-lg border">
                  <div className={`w-4 h-4 rounded-full ${
                    phase.status === 'completed' ? 'bg-green-500' :
                    phase.status === 'in-progress' ? 'bg-accent' : 'bg-muted-foreground'
                  }`} />
                  
                  <div className="flex-1">
                    <div className="font-medium">{phase.phase}</div>
                    <div className="text-sm text-muted-foreground">
                      {phase.status === 'completed' ? 'Completed' :
                       phase.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(phase.date).toLocaleDateString()}
                  </div>
                  
                  <Badge variant={
                    phase.status === 'completed' ? 'default' :
                    phase.status === 'in-progress' ? 'secondary' : 'outline'
                  }>
                    {phase.status === 'completed' ? 'Done' :
                     phase.status === 'in-progress' ? 'Active' : 'Pending'}
                  </Badge>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No timeline data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-accent/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Building className="h-6 w-6 text-accent" />
                Project Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Address</div>
                <div className="font-medium">{project.address}</div>
                <div className="text-sm">{project.city}, {project.state} {project.zipCode}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Start Date</div>
                  <div className="font-medium">
                    {new Date(project.startDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Est. Completion</div>
                  <div className="font-medium">
                    {new Date(project.estimatedCompletionDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Target className="h-6 w-6 text-accent" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {project.recentTasks && project.recentTasks.length > 0 ? (
                  project.recentTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded">
                      <div className={`w-2 h-2 rounded-full ${
                        task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'in-progress' ? 'bg-accent' : 'bg-muted-foreground'
                      }`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {task.status === 'completed' ? 'Completed' :
                           task.status === 'in-progress' ? 'In Progress' : 'Pending'}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {task.priority}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                    <div className="text-sm">No recent activity</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}