import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Added useQueryClient
import { useAuth } from "@/hooks/use-auth-unified"; // *** ADDED: Import useAuth ***
// Removed queryClient import as it's obtained via hook
import { apiRequest, getQueryFn } from "@/lib/queryClient"; // *** UPDATED: Import getQueryFn ***
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import MessageItem from "@/components/MessageItem";
import { Message, Project, User } from "@shared/schema"; // *** ADDED: Import User ***
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Search,
  Plus,
  Send,
  Loader2,
  XCircle
} from "lucide-react";

// Schema for the message form
const messageSchema = z.object({
  // Ensure projectId is treated as a string initially for the Select component
  projectId: z.string().min(1, "Please select a project"),
  // recipientId can be number or null
  recipientId: z.number().nullable().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

type MessageFormValues = z.infer<typeof messageSchema>;

export default function Messages() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth(); // *** ADDED: Get user from auth hook ***
  const { toast } = useToast();
  const queryClient = useQueryClient(); // *** ADDED: Get queryClient via hook ***

  // Fetch projects
  const {
    data: projects = [],
    isLoading: isLoadingProjects
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: getQueryFn({ on401: "throw" }), // *** UPDATED: Use getQueryFn ***
  });

  // Fetch all messages across all projects
  const {
    data: allMessages = [],
    isLoading: isLoadingMessages
  } = useQuery<Message[]>({
    queryKey: ["/api/messages"], // Endpoint might need adjustment based on backend
    queryFn: getQueryFn({ on401: "throw" }), // *** UPDATED: Use getQueryFn ***
    // enabled: projects.length > 0, // Can fetch messages regardless of projects loaded
  });

  // Fetch users for recipient selection (only if not a client)
  const {
    data: users = [],
    isLoading: isLoadingUsers
  } = useQuery<User[]>({
    queryKey: ["/api/users"], // Or a more specific endpoint like /api/message-recipients
    queryFn: getQueryFn({ on401: "throw" }), // *** UPDATED: Use getQueryFn ***
    enabled: user?.role !== 'client', // *** ADDED: Enable only if user is NOT a client ***
  });

  // Filter messages based on project and search query
  const filteredMessages = allMessages.filter(msg => {
    const matchesProject = projectFilter === "all" || msg.projectId.toString() === projectFilter;
    const matchesSearch = msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        msg.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesSearch;
  });

  // Form setup
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    // Set default projectId as string if projects are loaded, otherwise empty string
    defaultValues: {
      projectId: projects[0]?.id.toString() || "",
      recipientId: null,
      subject: "",
      message: "",
    },
  });

  // Reset form projectId when projects load
  React.useEffect(() => {
    if (projects.length > 0 && !form.getValues('projectId')) {
        form.reset({ ...form.getValues(), projectId: projects[0].id.toString() });
    }
  }, [projects, form]);

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (data: MessageFormValues) => {
      // Convert projectId back to number before sending
      const payload = {
          ...data,
          projectId: parseInt(data.projectId, 10),
          // recipientId is already number | null | undefined
      };
      const res = await apiRequest("POST", `/api/projects/${payload.projectId}/messages`, payload);
      // apiRequest should throw on non-ok status, so we assume success here
      return res.json(); // Assuming backend returns the created message
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] }); // Invalidate general messages query
      // Optionally invalidate project-specific messages if using separate keys
      // queryClient.invalidateQueries({ queryKey: [`/api/projects/${form.getValues('projectId')}/messages`] });
      setDialogOpen(false);
      form.reset({ // Reset form to defaults (or specific values)
        projectId: projects[0]?.id.toString() || "",
        recipientId: null,
        subject: "",
        message: ""
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Message",
        description: error instanceof Error ? error.message : "An unknown error occurred.", // Display error message
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MessageFormValues) => {
    // *** ADDED: Ensure recipientId is null for clients ***
    const submissionData = user?.role === 'client'
      ? { ...data, recipientId: null }
      : data;
    // *** END ADDED ***
    createMessageMutation.mutate(submissionData);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Messages</h1>
            <p className="text-slate-600">Communicate with your project team</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Send a New Message</DialogTitle>
                <DialogDescription>
                  Send a message regarding a project.
                  {/* Clarify recipient based on role */}
                  {user?.role === 'client'
                    ? " Your message will be sent to the project team."
                    : " Select a recipient or send to all project members."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Project Selection */}
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project*</FormLabel>
                        <Select
                          onValueChange={field.onChange} // RHF expects string here
                          value={field.value} // Value is string from form state
                          disabled={isLoadingProjects}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingProjects ? "Loading..." : "Select a project"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects.map(project => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* --- Conditional Recipient Field --- */}
                  {user?.role !== 'client' && ( // Only show if NOT a client
                    <FormField
                      control={form.control}
                      name="recipientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient (Optional)</FormLabel>
                          <Select
                            // Ensure value is string or "null" for Select component
                            onValueChange={(value) => field.onChange(value === "null" ? null : parseInt(value))}
                            value={field.value?.toString() ?? "null"}
                            disabled={isLoadingUsers}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingUsers ? "Loading..." : "All project members"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="null">All Project Members</SelectItem>
                              {/* Filter users (e.g., only show PMs and Admins, or clients on the selected project) */}
                              {users
                                // Example: Filter out the current user and potentially other clients
                                .filter(u => u.id !== user?.id)
                                .map(u => (
                                <SelectItem key={u.id} value={u.id.toString()}>
                                  {u.firstName} {u.lastName} ({u.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Leave blank to send to all project members.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {/* --- End Conditional Field --- */}

                  {/* Subject */}
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter message subject" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message*</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter your message here..."
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={createMessageMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMessageMutation.isPending}
                    >
                      {createMessageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6 flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-1/3">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Project</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-2/3 relative">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search messages by subject or content"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages List */}
        <Card>
          <CardHeader>
            <CardTitle>Communication Log</CardTitle>
            <CardDescription>
              {isLoadingMessages ? "Loading messages..." : `${filteredMessages.length} message${filteredMessages.length !== 1 ? 's' : ''} found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(isLoadingProjects || isLoadingMessages || isLoadingUsers) ? ( // Check all relevant loading states
              <div>
                {/* Placeholder loading items */}
                <MessageItem isLoading={true} message={{} as Message} />
                <MessageItem isLoading={true} message={{} as Message} />
                <MessageItem isLoading={true} message={{} as Message} />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-primary-50 p-3 mb-4">
                  <MessageSquare className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Messages Found</h3>
                <p className="text-center text-slate-500 mb-6 max-w-md">
                  {allMessages.length === 0
                    ? "No messages have been exchanged yet. Send a message to get started."
                    : "No messages match your current filters. Try adjusting your search or filter criteria."}
                </p>
                 {allMessages.length > 0 && ( // Show Clear Filters button only if filters might be active
                    <Button
                        variant="outline"
                        onClick={() => {
                            setProjectFilter("all");
                            setSearchQuery("");
                        }}
                    >
                        Clear Filters
                    </Button>
                 )}
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredMessages.map((message) => {
                  // Enrich message with sender details (if users are loaded)
                  const sender = users.find(u => u.id === message.senderId);
                  return (
                    <MessageItem
                      key={message.id}
                      message={{ ...message, sender }} // Pass enriched message
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
          {filteredMessages.length > 10 && ( // Example: Show Load More if more than 10 messages match filter
            <CardFooter className="justify-center border-t py-4">
              {/* TODO: Implement actual Load More functionality */}
              <Button variant="outline" disabled>Load More Messages</Button>
            </CardFooter>
          )}
        </Card>
      </main>
    </div>
  );
}
