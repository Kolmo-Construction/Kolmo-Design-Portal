import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  useQuery, 
  useQueryClient 
} from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { User, Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  AlertCircle, 
  Building2,
  CheckCircle2, 
  Clipboard, 
  Copy, 
  Loader2, 
  Plus, 
  RotateCw, 
  Users 
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const newUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "projectManager", "client"], {
    required_error: "Role is required",
  }),
  projectIds: z.array(z.number()).optional(),
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("users");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [createdMagicLink, setCreatedMagicLink] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, createMagicLinkMutation } = useAuth();
  const [, navigate] = useLocation();

  // Redirect if not an admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  // Get all users
  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery<User[], Error>({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Get all projects for assignment
  const {
    data: projects,
    isLoading: projectsLoading,
  } = useQuery<Project[], Error>({
    queryKey: ["/api/projects"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Get client's assigned projects when a client is selected
  const {
    data: clientProjects,
    isLoading: clientProjectsLoading,
    isError: clientProjectsError,
  } = useQuery<Project[], Error>({
    queryKey: ["/api/admin/client-projects", selectedUserId],
    queryFn: selectedUserId ? getQueryFn({ on401: "throw" }) : () => Promise.resolve([]),
    enabled: !!selectedUserId && activeTab === "client-projects"
  });

  // Get selected client's details
  const selectedClient = selectedUserId
    ? users?.find(u => u.id === selectedUserId)
    : null;

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "client",
    },
  });

  const onSubmit = (data: NewUserFormValues) => {
    createMagicLinkMutation.mutate(data, {
      onSuccess: (response) => {
        // Only set magic link if it's available
        if (response.magicLink) {
          setCreatedMagicLink(response.magicLink);
        }
        refetchUsers();
        // Don't close the dialog so the admin can copy the magic link
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied to clipboard",
          description: "Magic link has been copied to clipboard",
        });
      },
      (err) => {
        toast({
          title: "Copy failed",
          description: "Could not copy text to clipboard",
          variant: "destructive",
        });
      }
    );
  };

  const closeDialog = () => {
    setIsCreateUserDialogOpen(false);
    setCreatedMagicLink(null);
    form.reset();
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-600">
              Manage user accounts and send access invitations
            </p>
          </div>
          <Button
            onClick={() => setIsCreateUserDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New User
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="users" onClick={() => setActiveTab("users")}>
              User Accounts
            </TabsTrigger>
            {selectedClient && (
              <TabsTrigger value="client-projects" onClick={() => setActiveTab("client-projects")}>
                {selectedClient.firstName}'s Projects
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {activeTab === "client-projects" && selectedClient ? (
          <Card>
            <CardHeader className="px-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Projects for {selectedClient.firstName} {selectedClient.lastName}</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveTab("users")}
                >
                  Back to Users
                </Button>
              </div>
              <CardDescription>
                Projects that this client has access to
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6">
              {clientProjectsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : clientProjectsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading client projects. Please try again.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientProjects && clientProjects.length > 0 ? (
                      clientProjects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell>{project.address}, {project.city}, {project.state}</TableCell>
                          <TableCell>${project.totalBudget ? parseFloat(project.totalBudget.toString()).toLocaleString() : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              project.status === "active" 
                                ? "outline" 
                                : project.status === "completed" 
                                  ? "default" 
                                  : "secondary"
                            }>
                              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          This client doesn't have access to any projects yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="px-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>User Accounts</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => refetchUsers()}
                >
                  <RotateCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                All user accounts in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6">
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : usersError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Error loading users. Please try again.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users && users.length > 0 ? (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>
                            <Badge variant={
                              user.role === "admin" 
                                ? "default" 
                                : user.role === "projectManager" 
                                  ? "outline" 
                                  : "secondary"
                            }>
                              {user.role === "admin" 
                                ? "Admin" 
                                : user.role === "projectManager" 
                                  ? "Project Manager" 
                                  : "Client"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.isActivated ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                Pending Setup
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.role === "client" && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setActiveTab("client-projects");
                                }}
                                className="gap-1 text-xs"
                              >
                                <Building2 className="h-3.5 w-3.5" />
                                View Projects
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No users found. Create a new user to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create User Dialog */}
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{createdMagicLink ? "Magic Link Created" : "Create New User"}</DialogTitle>
              <DialogDescription>
                {createdMagicLink 
                  ? "Share this magic link with the user to give them access to the portal" 
                  : "Create a user account and send them a magic link invitation"}
              </DialogDescription>
            </DialogHeader>
            
            {createdMagicLink ? (
              <div className="space-y-4">
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700">
                    User account created successfully!
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Magic Link</label>
                  <div className="flex items-center">
                    <div className="bg-slate-100 rounded-l-md p-2 border border-r-0 border-input flex-grow truncate text-sm">
                      {createdMagicLink}
                    </div>
                    <Button
                      onClick={() => createdMagicLink && copyToClipboard(createdMagicLink)}
                      variant="outline"
                      size="icon"
                      className="rounded-l-none h-9"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {createMagicLinkMutation.data?.warning 
                      ? "Email service is not configured. Please manually share this link with the user." 
                      : "The magic link has been emailed to the user with instructions."}
                  </p>
                </div>
                
                <DialogFooter>
                  <Button className="w-full" onClick={closeDialog}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== "client") {
                              form.setValue("projectIds", []);
                            }
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="projectManager">Project Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The user's role determines their level of access
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("role") === "client" && (
                    <FormField
                      control={form.control}
                      name="projectIds"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Assign Projects</FormLabel>
                            <FormDescription>
                              Select which projects this client can access
                            </FormDescription>
                          </div>
                          <div className="space-y-2">
                            {projectsLoading ? (
                              <div className="py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2 inline" />
                                <span className="text-sm text-muted-foreground">Loading projects...</span>
                              </div>
                            ) : projects && projects.length > 0 ? (
                              projects.map((project) => (
                                <FormField
                                  key={project.id}
                                  control={form.control}
                                  name="projectIds"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={project.id}
                                        className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(project.id)}
                                            onCheckedChange={(checked) => {
                                              const currentValues = field.value || [];
                                              return checked
                                                ? field.onChange([...currentValues, project.id])
                                                : field.onChange(
                                                    currentValues.filter(
                                                      (value) => value !== project.id
                                                    )
                                                  );
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="font-medium">
                                            {project.name}
                                          </FormLabel>
                                          <FormDescription>
                                            {project.address}, {project.city}, {project.state}
                                          </FormDescription>
                                        </div>
                                      </FormItem>
                                    );
                                  }}
                                />
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground py-2">
                                No projects available. Create projects before adding clients.
                              </div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  {createMagicLinkMutation.isError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {createMagicLinkMutation.error?.message || "Error creating user. Please try again."}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <DialogFooter className="pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeDialog}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMagicLinkMutation.isPending}
                    >
                      {createMagicLinkMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create User"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}