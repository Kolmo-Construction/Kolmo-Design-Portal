import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building2, 
  MessageSquare, 
  FileText, 
  Calendar, 
  DollarSign, 
  Clock, 
  Camera,
  ArrowRight,
  Bell,
  MapPin,
  Phone,
  Mail,
  User,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project, ProgressUpdate, Message, Invoice } from '@shared/schema';

interface ClientDashboardData {
  projects: (Project & {
    clients?: Array<{ firstName: string; lastName: string; email: string; phone?: string }>;
    projectManager?: { firstName: string; lastName: string; email: string };
  })[];
  recentUpdates: ProgressUpdate[];
  unreadMessages: Message[];
  pendingInvoices: Invoice[];
  overallStats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalInvestment: string;
  };
}

export default function ClientPortalPage() {
  const { user } = useAuth();
  
  const { data, isLoading, error } = useQuery<ClientDashboardData>({
    queryKey: ['/api/client/dashboard'],
    enabled: !!user && user.role === 'client',
    retry: false,
    // Fallback to show demo data structure
    placeholderData: {
      projects: [],
      recentUpdates: [],
      unreadMessages: [],
      pendingInvoices: [],
      overallStats: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalInvestment: "0.00"
      }
    }
  });

  if (!user || user.role !== 'client') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Access restricted to clients only.</p>
            <Button asChild className="mt-4">
              <Link href="/">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-96 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-600 mb-4">Error loading your projects</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getProjectStatusColor = (status: string) => {
    const colors = {
      planning: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-green-100 text-green-800 border-green-300',
      on_hold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      completed: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      planning: 'Planning',
      in_progress: 'In Progress',
      on_hold: 'On Hold',
      completed: 'Completed',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user.firstName}
              </h1>
              <p className="text-gray-600 mt-1">
                Here's what's happening with your projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="relative">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
                {data.unreadMessages.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                    {data.unreadMessages.length}
                  </Badge>
                )}
              </Button>
              <Avatar>
                <AvatarFallback>
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Projects</p>
                  <p className="text-2xl font-bold">{data.overallStats.totalProjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Projects</p>
                  <p className="text-2xl font-bold">{data.overallStats.activeProjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold">{data.overallStats.completedProjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Investment</p>
                  <p className="text-2xl font-bold">${data.overallStats.totalInvestment}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Projects */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Your Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.projects.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No projects assigned yet</p>
                  </div>
                ) : (
                  data.projects.map((project) => (
                    <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{project.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                            <MapPin className="h-3 w-3" />
                            {project.address}, {project.city}
                          </div>
                        </div>
                        <Badge className={cn("border", getProjectStatusColor(project.status))}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </div>
                      
                      {project.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${Number(project.totalBudget).toLocaleString()}
                          </div>
                          {project.progress !== undefined && (
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              {project.progress}% Complete
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/projects/${project.id}`}>
                            View Details
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Feed */}
          <div className="space-y-6">
            {/* Recent Updates */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-green-600" />
                  Recent Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentUpdates.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">No recent updates</p>
                ) : (
                  <div className="space-y-4">
                    {data.recentUpdates.slice(0, 3).map((update) => (
                      <div key={update.id} className="border-l-2 border-green-200 pl-4">
                        <h4 className="font-medium text-sm">{update.title}</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(update.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {data.recentUpdates.length > 3 && (
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        View All Updates
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  Messages
                  {data.unreadMessages.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {data.unreadMessages.length} new
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.unreadMessages.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">No new messages</p>
                ) : (
                  <div className="space-y-3">
                    {data.unreadMessages.slice(0, 3).map((message) => (
                      <div key={message.id} className="p-3 bg-blue-50 rounded-lg">
                        <p className="font-medium text-sm">{message.subject}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full">
                      View All Messages
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Invoices */}
            {data.pendingInvoices.length > 0 && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                    Pending Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.pendingInvoices.slice(0, 2).map((invoice) => (
                      <div key={invoice.id} className="p-3 bg-amber-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-600">
                              Due: {new Date(invoice.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="font-semibold text-sm">
                            ${Number(invoice.amount).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full">
                      View All Invoices
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                <MessageSquare className="h-6 w-6" />
                <span>Contact Team</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                <FileText className="h-6 w-6" />
                <span>View Documents</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                <Calendar className="h-6 w-6" />
                <span>Schedule Meeting</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                <DollarSign className="h-6 w-6" />
                <span>Payment History</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}