import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import ProjectCard from "@/components/ProjectCard";
import MessageItem from "@/components/MessageItem";
import UpdateItem from "@/components/UpdateItem";
import ApprovalItem from "@/components/ApprovalItem";
import DashboardStats from "@/components/DashboardStats";
import { Project, Message, ProgressUpdate, Selection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, MessageSquare } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
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

  // Use an empty array for these examples to avoid making too many API calls at once
  // In a real application, you would fetch all of these with useQuery
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages 
  } = useQuery<Message[]>({
    queryKey: ["/api/projects/messages"],
    // Only fetch if we have projects
    enabled: projects.length > 0,
  });

  const { 
    data: updates = [], 
    isLoading: isLoadingUpdates 
  } = useQuery<ProgressUpdate[]>({
    queryKey: ["/api/projects/updates"],
    // Only fetch if we have projects
    enabled: projects.length > 0,
  });

  const { 
    data: selections = [], 
    isLoading: isLoadingSelections 
  } = useQuery<Selection[]>({
    queryKey: ["/api/projects/selections"],
    // Only fetch if we have projects
    enabled: projects.length > 0,
  });

  const handleReviewSelection = (id: number) => {
    toast({
      title: "Review Selection",
      description: `Opening selection #${id} for review`,
    });
  };

  const isLoading = isLoadingProjects || isLoadingMessages || isLoadingUpdates || isLoadingSelections;

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        {/* Welcome Banner */}
        <Card className="mb-6">
          <CardContent className="px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-800">Welcome back, {user?.firstName || "User"}!</h1>
                <p className="mt-1 text-slate-600">Here's what's happening with your construction projects.</p>
              </div>
              <div className="mt-4 md:mt-0">
                <Button className="gap-2">
                  <Plus className="h-5 w-5" />
                  New Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Stats */}
        <DashboardStats 
          projects={projects}
          messages={messages}
          updates={updates}
          selections={selections}
          isLoading={isLoading}
        />

        {/* Projects Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Your Projects</h2>
            <Link href="/projects">
              <Button variant="link" className="text-primary-600 hover:text-primary-700">
                View All
              </Button>
            </Link>
          </div>
          
          {isLoadingProjects ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200 animate-pulse">
                  <div className="h-40 bg-slate-200"></div>
                  <div className="p-5">
                    <div className="h-6 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-full mb-4"></div>
                    <div className="h-2 bg-slate-200 rounded-full w-full mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-full mb-4"></div>
                    <div className="h-10 bg-slate-200 rounded w-full mt-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-primary-50 p-3 mb-4">
                  <Building2 className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Projects Yet</h3>
                <p className="text-center text-slate-500 mb-6 max-w-md">
                  You don't have any projects assigned to you yet. Check back later or contact your project manager.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 3).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Tabs for Messages and Updates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="px-6 py-5 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <CardTitle>Recent Messages</CardTitle>
                <Link href="/messages">
                  <Button variant="link" className="text-primary-600 hover:text-primary-700">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <div className="divide-y divide-slate-200">
              {isLoadingMessages ? (
                <>
                  <MessageItem isLoading={true} message={{} as Message} />
                  <MessageItem isLoading={true} message={{} as Message} />
                  <MessageItem isLoading={true} message={{} as Message} />
                </>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-blue-50 p-3 mb-4">
                    <MessageSquare className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-slate-500">No messages yet</p>
                </div>
              ) : (
                <>
                  {messages.slice(0, 3).map((message) => (
                    <MessageItem key={message.id} message={message} />
                  ))}
                  <div className="p-4 text-center">
                    <Button variant="ghost" className="text-primary-600 hover:text-primary-700">
                      Load More
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader className="px-6 py-5 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <CardTitle>Progress Updates</CardTitle>
                <Link href="/progress-updates">
                  <Button variant="link" className="text-primary-600 hover:text-primary-700">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingUpdates ? (
                <div className="flow-root">
                  <ul className="-mb-8">
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                  </ul>
                </div>
              ) : updates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-green-50 p-3 mb-4">
                    <Image className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-slate-500">No updates yet</p>
                </div>
              ) : (
                <div className="flow-root">
                  <ul className="-mb-8">
                    {updates.slice(0, 3).map((update) => (
                      <UpdateItem key={update.id} update={update} />
                    ))}
                  </ul>
                  <div className="pt-4 text-center">
                    <Button variant="ghost" className="text-primary-600 hover:text-primary-700">
                      View All Updates
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals */}
        <Card className="mb-8">
          <CardHeader className="px-6 py-5 border-b border-slate-200">
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Material and design selections that need your review</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            {isLoadingSelections ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : selections.filter(s => s.status === "pending").length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-green-50 p-3 mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-slate-500">No pending approvals</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date Requested</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {selections
                    .filter(selection => selection.status === "pending")
                    .slice(0, 3)
                    .map((selection) => (
                      <ApprovalItem 
                        key={selection.id} 
                        approval={selection} 
                        onReview={handleReviewSelection}
                      />
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-200">
            <Link href="/selections">
              <Button variant="link" className="text-primary-600 hover:text-primary-700">
                View All Approvals
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
