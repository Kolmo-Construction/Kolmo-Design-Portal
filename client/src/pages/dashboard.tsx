import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import MessageItem from "@/components/MessageItem";
import UpdateItem from "@/components/UpdateItem";
import ApprovalItem from "@/components/ApprovalItem";
import QuoteAnalyticsOverview from "@/components/dashboard/QuoteAnalyticsOverview";
import { ChatDashboard } from "@/components/dashboard/ChatDashboard";
import { Project, Message, ProgressUpdate, Selection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  MessageSquare, 
  CheckCircle2, 
  ImageIcon, 
  Building2, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Users,
  AlertCircle,
  CalendarCheck,
  FileCheck,
  User as UserIcon
} from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";

export default function ClientDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Use query for messages
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages 
  } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });
  
  // Simplified approach: fetch first project's selections and updates
  // This will be sufficient for dashboard preview
  const firstProjectId = projects.length > 0 ? projects[0].id : undefined;
  
  // Query for project selections
  const { 
    data: selections = [],
    isLoading: isLoadingSelections 
  } = useQuery<Selection[]>({
    queryKey: ["/api/projects", firstProjectId, "selections"],
    queryFn: async () => {
      if (!firstProjectId) return [];
      const response = await fetch(`/api/projects/${firstProjectId}/selections`);
      if (!response.ok) {
        throw new Error('Failed to fetch project selections');
      }
      return response.json();
    },
    enabled: !!firstProjectId,
  });
  
  // Query for project updates
  const { 
    data: updates = [],
    isLoading: isLoadingUpdates 
  } = useQuery<ProgressUpdate[]>({
    queryKey: ["/api/projects", firstProjectId, "updates"],
    queryFn: async () => {
      if (!firstProjectId) return [];
      const response = await fetch(`/api/projects/${firstProjectId}/updates`);
      if (!response.ok) {
        throw new Error('Failed to fetch project updates');
      }
      return response.json();
    },
    enabled: !!firstProjectId,
  });

  const handleReviewSelection = (id: number) => {
    toast({
      title: "Review Selection",
      description: `Opening selection #${id} for review`,
    });
  };

  const isLoading = isLoadingProjects || isLoadingMessages || isLoadingUpdates || isLoadingSelections;

  // Calculate action items counts for dashboard stats
  const pendingApprovals = selections.filter(s => s.status === "pending").length;
  const unreadMessages = messages.filter(m => !m.isRead).length;
  
  // Calculate next upcoming event (deadline, milestone, etc.)
  const getNextEvent = () => {
    // In a real app, this would combine milestones, payment due dates, etc.
    const activeMilestones = projects.flatMap(p => 
      p.startDate ? [{ 
        date: new Date(p.startDate),
        title: `${p.name} - Project Start`,
        projectId: p.id
      }] : []
    ).concat(
      projects.flatMap(p => 
        p.estimatedCompletionDate ? [{ 
          date: new Date(p.estimatedCompletionDate),
          title: `${p.name} - Estimated Completion`,
          projectId: p.id
        }] : []
      )
    );
    
    const future = activeMilestones.filter(m => m.date > new Date())
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return future.length > 0 ? future[0] : null;
  };
  
  const nextEvent = getNextEvent();

  // Format dates
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "Not set";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        {/* Hero/Welcome Section */}
        <div className="mb-8 relative overflow-hidden bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl text-white p-6 md:p-8">
          <div className="relative z-10">
            <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.firstName || "User"}!</h1>
            <p className="text-primary-100 max-w-xl mb-6">
              Your construction project hub is here. Track progress, make decisions, and stay in the loop.
            </p>
            
            <div className="flex flex-wrap gap-4">
              {pendingApprovals > 0 && (
                <Link href="/selections">
                  <Button className="bg-white text-primary-700 hover:bg-primary-50 font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {pendingApprovals} Pending Approval{pendingApprovals !== 1 ? 's' : ''}
                  </Button>
                </Link>
              )}
              
              <Link href="/messages">
                <Button variant="outline" className="bg-primary-700/30 text-white border-primary-300 hover:bg-primary-700/50">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message Your Team
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Background pattern */}
          <div className="absolute top-0 right-0 w-64 h-full opacity-10">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <path fill="currentColor" d="M100 0H0V100H100V0ZM90 10V90H10V10H90Z" />
              <path fill="currentColor" d="M80 20H20V80H80V20ZM70 30V70H30V30H70Z" />
            </svg>
          </div>
        </div>

        {/* Project Timeline */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Left column - Action items */}
          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Action Center</h2>
            
            <div className="flex flex-col gap-4">
              {/* Pending Approvals Quick View */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-50 p-2 rounded-lg">
                      <FileCheck className="h-5 w-5 text-yellow-600" />
                    </div>
                    <h3 className="font-medium">Selections & Approvals</h3>
                  </div>
                  {pendingApprovals > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                      {pendingApprovals} Pending
                    </Badge>
                  )}
                </div>
                
                {isLoadingSelections ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-12 bg-slate-100 rounded"></div>
                    <div className="h-12 bg-slate-100 rounded"></div>
                  </div>
                ) : selections.filter(s => s.status === "pending").length === 0 ? (
                  <div className="text-center py-3 text-slate-500 text-sm">
                    No pending approvals
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selections
                      .filter(selection => selection.status === "pending")
                      .slice(0, 2)
                      .map((selection) => (
                        <div key={selection.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-slate-800">{selection.title || 'Pending Selection'}</p>
                              <p className="text-xs text-slate-500">Requested {selection.createdAt ? formatDistanceToNow(new Date(selection.createdAt), { addSuffix: true }) : 'recently'}</p>
                            </div>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => handleReviewSelection(selection.id)}
                              className="text-xs h-8"
                            >
                              Review
                            </Button>
                          </div>
                        </div>
                      ))
                    }
                    
                    {selections.filter(s => s.status === "pending").length > 2 && (
                      <Link href="/selections">
                        <Button variant="link" size="sm" className="text-primary-600 w-full">
                          View All Approvals
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </div>
              
              {/* Time-sensitive items */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <CalendarCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-medium">Coming Up</h3>
                </div>
                
                {isLoadingProjects ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-14 bg-slate-100 rounded"></div>
                  </div>
                ) : nextEvent ? (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm font-medium text-slate-800">
                      {nextEvent.title}
                    </div>
                    <div className="flex items-center mt-1 text-xs text-slate-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(nextEvent.date)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-slate-500">
                        {formatDistanceToNow(nextEvent.date, { addSuffix: true })}
                      </div>
                      <Link href={`/projects/${nextEvent.projectId}`}>
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3 text-slate-500 text-sm">
                    No upcoming events scheduled
                  </div>
                )}
              </div>
              
              {/* Messages quick view */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-50 p-2 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-primary-600" />
                    </div>
                    <h3 className="font-medium">Recent Messages</h3>
                  </div>
                  {unreadMessages > 0 && (
                    <Badge className="bg-primary-100 text-primary-800 hover:bg-primary-200">
                      {unreadMessages} New
                    </Badge>
                  )}
                </div>
                
                {isLoadingMessages ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-12 bg-slate-100 rounded"></div>
                    <div className="h-12 bg-slate-100 rounded"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-3 text-slate-500 text-sm">
                    No messages yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.slice(0, 2).map((message) => (
                      <div key={message.id} className={`p-3 rounded-lg ${!message.isRead ? 'bg-primary-50' : 'bg-slate-50'}`}>
                        <div className="flex justify-between">
                          <div className="text-sm font-medium text-slate-800">
                            {message.subject}
                          </div>
                          {!message.isRead && (
                            <div className="h-2 w-2 rounded-full bg-primary-500"></div>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          From: {message.senderId ? 'Team Member' : 'Team Member'}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {message.createdAt ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true }) : 'recently'}
                        </div>
                      </div>
                    ))}
                    
                    <Link href="/messages">
                      <Button variant="link" size="sm" className="text-primary-600 w-full">
                        View All Messages
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Middle column - Project highlights */}
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Project Highlights</h2>
            
            {isLoadingProjects ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-64 bg-slate-200 rounded-xl"></div>
                <div className="h-64 bg-slate-200 rounded-xl"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <div className="rounded-full bg-primary-50 p-3 inline-flex mb-4">
                  <Building2 className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Projects Yet</h3>
                <p className="text-center text-slate-500 mb-6 max-w-md mx-auto">
                  You don't have any projects assigned to you yet. Check back later or contact your project manager.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {projects.map((project) => (
                  <div key={project.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* Project header with image background */}
                    <div className="h-48 sm:h-56 relative">
                      <img 
                        src={project.imageUrl || 
                          `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`} 
                        alt={project.name} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                      
                      {/* Project info overlay */}
                      <div className="absolute bottom-0 left-0 w-full p-4 text-white">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-bold text-xl text-white">{project.name}</h3>
                          <Badge className={`${
                            project.status === "planning" ? "bg-accent-600" :
                            project.status === "in_progress" ? "bg-primary-600" :
                            project.status === "on_hold" ? "bg-yellow-500" :
                            project.status === "completed" ? "bg-green-600" : "bg-slate-600"
                          } text-white hover:opacity-90`}>
                            {project.status === "planning" ? "Planning" :
                             project.status === "in_progress" ? "In Progress" :
                             project.status === "on_hold" ? "On Hold" :
                             project.status === "completed" ? "Completed" :
                             project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-primary-50 text-sm mb-3">{project.address}, {project.city}, {project.state}</p>
                        
                        <div className="flex flex-wrap gap-4">
                          {/* Project Manager */}
                          {project.projectManagerId && (
                            <div className="flex items-center text-xs text-primary-50">
                              <UserIcon className="h-3 w-3 mr-1" />
                              PM: {project.projectManagerId}
                            </div>
                          )}
                          
                          {/* Start Date */}
                          <div className="flex items-center text-xs text-primary-50">
                            <Calendar className="h-3 w-3 mr-1" />
                            Start: {formatDate(project.startDate)}
                          </div>
                          
                          {/* Completion Date */}
                          <div className="flex items-center text-xs text-primary-50">
                            <Clock className="h-3 w-3 mr-1" />
                            Est. Completion: {formatDate(project.estimatedCompletionDate)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Project progress and quick actions */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-slate-800">Project Progress</div>
                        <div className="text-sm text-slate-600">{project.progress || 0}% Complete</div>
                      </div>
                      <Progress value={project.progress || 0} className="h-2 mb-4" />
                      
                      <div className="flex gap-3 justify-end">
                        <Link href={`/projects/${project.id}/media`}>
                          <Button size="sm" variant="outline" className="text-xs gap-1">
                            <ImageIcon className="h-3.5 w-3.5" />
                            View Photos
                          </Button>
                        </Link>
                        <Link href={`/projects/${project.id}`}>
                          <Button size="sm" className="text-xs gap-1">
                            View Details
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Quote Analytics Overview */}
        <div className="mb-8">
          <QuoteAnalyticsOverview />
        </div>
        
        {/* Centralized Chat Management */}
        <div className="mb-8">
          <ChatDashboard />
        </div>
        
        {/* Recent Updates with Image Showcase */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Progress</h2>
          
          {isLoadingUpdates ? (
            <div className="h-64 bg-slate-200 rounded-xl animate-pulse"></div>
          ) : updates.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="rounded-full bg-green-50 p-3 inline-flex mb-4">
                <ImageIcon className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-slate-500">No updates yet</p>
            </div>
          ) : (
            // Simple timeline view for updates
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flow-root">
                <ul className="-mb-8">
                  {updates.slice(0, 3).map((update) => (
                    <UpdateItem key={update.id} update={update} />
                  ))}
                </ul>
              </div>
              <div className="pt-4 text-center">
                <Link href="/progress-updates">
                  <Button variant="link" className="text-primary-600 hover:text-primary-700">
                    View All Updates
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
