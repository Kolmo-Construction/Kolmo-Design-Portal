import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Project, Document, Invoice, Message, ProgressUpdate, Milestone } from "@shared/schema";
import { format } from "date-fns";
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
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import MessageItem from "@/components/MessageItem";
import UpdateItem from "@/components/UpdateItem";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Calendar,
  User,
  FileText,
  CreditCard,
  MessageSquare,
  Image,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Download
} from "lucide-react";

export default function ProjectDetails() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const params = useParams();
  const projectId = params.id ? parseInt(params.id) : 0;
  
  // Fetch project details
  const { 
    data: project,
    isLoading: isLoadingProject,
    error: projectError
  } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  // Fetch project documents
  const { 
    data: documents = [],
    isLoading: isLoadingDocuments
  } = useQuery<Document[]>({
    queryKey: [`/api/projects/${projectId}/documents`],
    enabled: !!project,
  });

  // Fetch project invoices
  const { 
    data: invoices = [],
    isLoading: isLoadingInvoices
  } = useQuery<Invoice[]>({
    queryKey: [`/api/projects/${projectId}/invoices`],
    enabled: !!project,
  });

  // Fetch project messages
  const { 
    data: messages = [],
    isLoading: isLoadingMessages
  } = useQuery<Message[]>({
    queryKey: [`/api/projects/${projectId}/messages`],
    enabled: !!project,
  });

  // Fetch project updates
  const { 
    data: updates = [],
    isLoading: isLoadingUpdates
  } = useQuery<ProgressUpdate[]>({
    queryKey: [`/api/projects/${projectId}/updates`],
    enabled: !!project,
  });

  // Fetch project milestones
  const { 
    data: milestones = [],
    isLoading: isLoadingMilestones
  } = useQuery<Milestone[]>({
    queryKey: [`/api/projects/${projectId}/milestones`],
    enabled: !!project,
  });

  // Format dates
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "Not set";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "planning":
        return <Badge className="bg-accent-600">{getStatusLabel(status)}</Badge>;
      case "in_progress":
        return <Badge className="bg-primary-600">{getStatusLabel(status)}</Badge>;
      case "on_hold":
        return <Badge className="bg-yellow-500">{getStatusLabel(status)}</Badge>;
      case "completed":
        return <Badge className="bg-green-600">{getStatusLabel(status)}</Badge>;
      default:
        return <Badge>{getStatusLabel(status)}</Badge>;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "planning":
        return "Planning";
      case "in_progress":
        return "In Progress";
      case "on_hold":
        return "On Hold";
      case "completed":
        return "Completed";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Calculate financial summary
  const totalInvoiced = invoices.reduce((sum, invoice) => {
    return sum + Number(invoice.amount);
  }, 0);
  
  const remainingBudget = project ? Number(project.totalBudget) - totalInvoiced : 0;
  const percentInvoiced = project && Number(project.totalBudget) > 0 
    ? (totalInvoiced / Number(project.totalBudget)) * 100 
    : 0;

  if (isLoadingProject) {
    return (
      <div className="flex h-screen bg-slate-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading project details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex h-screen bg-slate-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Project Not Found</CardTitle>
              <CardDescription>
                The project you are looking for does not exist or you don't have access to it.
              </CardDescription>
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

        {/* Project Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-slate-600 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {project.address}, {project.city}, {project.state} {project.zipCode}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Contact Team
            </Button>
            <Button 
              className="gap-2"
              onClick={() => {
                const tabsElement = document.querySelector('button[value="documents"]');
                if (tabsElement) {
                  (tabsElement as HTMLButtonElement).click();
                }
              }}
            >
              <FileText className="h-4 w-4" />
              View Documents
            </Button>
          </div>
        </div>

        {/* Project Overview Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Project Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Start Date</p>
                <p className="flex items-center gap-1 font-medium">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {formatDate(project.startDate)}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Estimated Completion</p>
                <p className="flex items-center gap-1 font-medium">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {formatDate(project.estimatedCompletionDate)}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Project Manager</p>
                <p className="flex items-center gap-1 font-medium">
                  <User className="h-4 w-4 text-slate-400" />
                  {project.projectManagerId ? "Assigned" : "Not Assigned"}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-slate-500">Total Budget</p>
                <p className="flex items-center gap-1 font-medium">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  ${Number(project.totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span>{project.progress || 0}% Complete</span>
              </div>
              <Progress value={project.progress || 0} className="h-2" />
            </div>

            {project.description && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-slate-600">{project.description}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Project Tabs */}
        <Tabs defaultValue="updates" className="mb-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
          
          {/* Updates Tab */}
          <TabsContent value="updates">
            <Card>
              <CardHeader>
                <CardTitle>Recent Updates</CardTitle>
                <CardDescription>Latest progress and status updates for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUpdates ? (
                  <div className="space-y-6 animate-pulse">
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                  </div>
                ) : updates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <Image className="h-6 w-6 text-primary-600" />
                    </div>
                    <p className="text-slate-500">No updates have been posted yet</p>
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {updates.map((update) => (
                        <UpdateItem key={update.id} update={update} />
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Project Documents</CardTitle>
                <CardDescription>Access all documents related to your project</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDocuments ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 border rounded-md flex items-center">
                        <div className="w-10 h-10 bg-slate-200 rounded mr-4"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                        </div>
                        <div className="w-20 h-8 bg-slate-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <FileText className="h-6 w-6 text-primary-600" />
                    </div>
                    <p className="text-slate-500">No documents have been uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-4 border rounded-md hover:bg-slate-50 flex items-center justify-between transition-colors">
                        <div className="flex items-center">
                          <div className="p-2 bg-primary-50 rounded mr-4">
                            <FileText className="h-6 w-6 text-primary-600" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-slate-500">{doc.category} • {(doc.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                            {doc.description && <p className="text-xs text-slate-400 mt-1">{doc.description}</p>}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-primary-600 gap-2"
                          onClick={() => window.open(doc.fileUrl, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Financials Tab */}
          <TabsContent value="financials">
            <Card>
              <CardHeader>
                <CardTitle>Financial Overview</CardTitle>
                <CardDescription>Track budget, invoices and payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium text-slate-500">Total Budget</p>
                    <p className="text-2xl font-semibold text-slate-800">
                      ${Number(project.totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium text-slate-500">Total Invoiced</p>
                    <p className="text-2xl font-semibold text-slate-800">
                      ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 text-xs text-slate-500">{percentInvoiced.toFixed(1)}% of budget</div>
                    <Progress value={percentInvoiced} className="mt-2 h-1.5" />
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium text-slate-500">Remaining Budget</p>
                    <p className="text-2xl font-semibold text-green-600">
                      ${remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 text-xs text-slate-500">
                      {(100 - percentInvoiced).toFixed(1)}% of budget remaining
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-medium mb-4">Invoices</h3>
                
                {isLoadingInvoices ? (
                  <div className="animate-pulse">
                    <div className="h-10 bg-slate-200 rounded mb-4"></div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-slate-200 rounded mb-2"></div>
                    ))}
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <CreditCard className="h-6 w-6 text-primary-600" />
                    </div>
                    <p className="text-slate-500">No invoices have been issued yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Invoice #
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Issue Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {invoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                              {invoice.invoiceNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {formatDate(invoice.issueDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {formatDate(invoice.dueDate)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                className={
                                  invoice.status === "paid" ? "bg-green-600" :
                                  invoice.status === "overdue" ? "bg-red-600" :
                                  "bg-yellow-500"
                                }
                              >
                                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <Button variant="link" className="text-primary-600">
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Project Communication</CardTitle>
                  <CardDescription>Messages and communication history</CardDescription>
                </div>
                <Button>New Message</Button>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-200">
                  {isLoadingMessages ? (
                    <>
                      <MessageItem isLoading={true} message={{} as Message} />
                      <MessageItem isLoading={true} message={{} as Message} />
                    </>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="rounded-full bg-primary-50 p-3 mb-4">
                        <MessageSquare className="h-6 w-6 text-primary-600" />
                      </div>
                      <p className="text-slate-500">No messages have been exchanged yet</p>
                      <Button variant="outline" className="mt-4 gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Start a conversation
                      </Button>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <MessageItem key={message.id} message={message} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Schedule Tab */}
          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Project Timeline</CardTitle>
                <CardDescription>Key milestones and schedule</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingMilestones ? (
                  <div className="space-y-6 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-200"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
                          <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : milestones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <Calendar className="h-6 w-6 text-primary-600" />
                    </div>
                    <p className="text-slate-500">No milestones have been set yet</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-slate-200"></div>
                    <ul className="space-y-6">
                      {milestones.map((milestone) => (
                        <li key={milestone.id} className="relative pl-12">
                          <div className="absolute left-0 flex items-center justify-center w-12 h-12">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white ${
                              milestone.status === "completed" ? "bg-green-100 text-green-600" :
                              milestone.status === "delayed" ? "bg-red-100 text-red-600" :
                              "bg-blue-100 text-blue-600"
                            }`}>
                              {milestone.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Calendar className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                          <div className="rounded-lg border p-4 bg-white">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{milestone.title}</h4>
                                <p className="text-sm text-slate-500">{milestone.description}</p>
                              </div>
                              <Badge
                                className={
                                  milestone.status === "completed" ? "bg-green-600" :
                                  milestone.status === "delayed" ? "bg-red-600" :
                                  "bg-blue-600"
                                }
                              >
                                {milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="mt-2 flex gap-4 text-sm text-slate-500">
                              <div>
                                <span className="font-medium">Planned:</span> {formatDate(milestone.plannedDate)}
                              </div>
                              {milestone.actualDate && (
                                <div>
                                  <span className="font-medium">Actual:</span> {formatDate(milestone.actualDate)}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
