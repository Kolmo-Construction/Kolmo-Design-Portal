import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { 
  Project, 
  InsertProject, 
  User,
  insertProjectSchema
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

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

import {
  Card,
  CardContent,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import {
  Building2,
  CalendarIcon,
  Loader2,
  PencilIcon,
  PlusCircle,
  RotateCw,
  Search,
  Users,
  X
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Extend the project schema for form validation
const projectFormSchema = insertProjectSchema
  .extend({
    startDate: z.union([z.date(), z.string()]).optional(),
    estimatedCompletionDate: z.union([z.date(), z.string()]).optional(),
    actualCompletionDate: z.union([z.date(), z.string()]).optional(),
    totalBudget: z.union([
      z.string().min(1, "Budget is required").refine(
        (val) => !isNaN(Number(val)) && Number(val) > 0,
        { message: "Budget must be a positive number" }
      ),
      z.number().min(1, "Budget must be a positive number")
    ]),
    projectManagerId: z.union([
      z.number().positive("Project manager ID must be positive"),
      z.string().transform((val) => val === "" ? undefined : parseInt(val, 10)),
      z.undefined()
    ]).optional(),
    description: z.string().optional().or(z.literal('')),
    imageUrl: z.string().optional().or(z.literal('')),
    progress: z.number().optional().default(0),
  });

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function ProjectManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Redirect if not an admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  // Get all projects
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    refetch: refetchProjects,
  } = useQuery<Project[], Error>({
    queryKey: ["/api/projects"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Get all project managers for assignment
  const {
    data: projectManagers = [],
    isLoading: managersLoading,
  } = useQuery<User[], Error>({
    queryKey: ["/api/admin/users?role=projectManager"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Project created",
        description: "New project has been successfully created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit project mutation
  const editProjectMutation = useMutation({
    mutationFn: async (data: { id: number; project: ProjectFormValues }) => {
      const res = await apiRequest("PUT", `/api/projects/${data.id}`, data.project);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsEditDialogOpen(false);
      setSelectedProject(null);
      toast({
        title: "Project updated",
        description: "Project has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create project form
  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      status: "planning",
      totalBudget: "",
      progress: 0,
      projectManagerId: undefined,
      imageUrl: "",
    },
  });

  // Edit project form
  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      status: "planning",
      totalBudget: "",
      progress: 0,
      projectManagerId: undefined,
      imageUrl: "",
    },
  });

  // Open edit project dialog
  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    
    // Set form values
    editForm.reset({
      name: project.name,
      description: project.description || "",
      address: project.address,
      city: project.city,
      state: project.state,
      zipCode: project.zipCode,
      status: project.status,
      totalBudget: project.totalBudget.toString(),
      progress: project.progress || 0,
      imageUrl: project.imageUrl || "",
      startDate: project.startDate ? new Date(project.startDate) : undefined,
      estimatedCompletionDate: project.estimatedCompletionDate ? new Date(project.estimatedCompletionDate) : undefined,
      actualCompletionDate: project.actualCompletionDate ? new Date(project.actualCompletionDate) : undefined,
      projectManagerId: project.projectManagerId || undefined,
    });
    
    setIsEditDialogOpen(true);
  };

  // Handle create project submission
  const onCreateSubmit = (values: ProjectFormValues) => {
    // Process values (convert string to number for totalBudget)
    const formattedValues = {
      ...values,
      totalBudget: typeof values.totalBudget === 'string' ? parseFloat(values.totalBudget) : values.totalBudget,
    };
    
    createProjectMutation.mutate(formattedValues);
  };

  // Handle edit project submission
  const onEditSubmit = (values: ProjectFormValues) => {
    if (!selectedProject) return;
    
    // Process values (convert string to number for totalBudget)
    const formattedValues = {
      ...values,
      totalBudget: typeof values.totalBudget === 'string' ? parseFloat(values.totalBudget) : values.totalBudget,
    };
    
    editProjectMutation.mutate({
      id: selectedProject.id,
      project: formattedValues
    });
  };

  // Format date for display
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

  // Filter projects based on status and search query
  const filteredProjects = projects.filter(project => {
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          project.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          project.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          project.state.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Project Management</h1>
            <p className="text-slate-600">Create, edit and manage construction projects</p>
          </div>
          <Button 
            onClick={() => {
              createForm.reset();
              setIsCreateDialogOpen(true);
            }}
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Create Project
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6 flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full sm:w-1/3">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-2/3 relative">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search projects by name or address"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project List */}
        <Card>
          <CardHeader className="px-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Projects</CardTitle>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => refetchProjects()}
              >
                <RotateCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
            <CardDescription>
              All construction and renovation projects
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            {projectsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : projectsError ? (
              <div className="text-center py-8 text-red-500">
                Error loading projects. Please try again.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Project Manager</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>
                          {project.city}, {project.state}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(project.status)}
                        </TableCell>
                        <TableCell>
                          ${Number(project.totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {project.projectManagerId ? (
                            <Badge variant="outline" className="bg-slate-100">
                              Assigned
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-400">
                              Unassigned
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditProject(project)}
                            className="gap-1"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No projects found. Create a new project to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new construction or renovation project to the system.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Name */}
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Status */}
                <FormField
                  control={createForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Description */}
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter project description" 
                        {...field} 
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Address */}
                <FormField
                  control={createForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* City */}
                <FormField
                  control={createForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* State */}
                <FormField
                  control={createForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter state" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Zip Code */}
                <FormField
                  control={createForm.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter zip code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date */}
                <FormField
                  control={createForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Estimated Completion Date */}
                <FormField
                  control={createForm.control}
                  name="estimatedCompletionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Estimated Completion Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Total Budget */}
                <FormField
                  control={createForm.control}
                  name="totalBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Budget*</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                            $
                          </span>
                          <Input 
                            placeholder="Enter budget amount" 
                            {...field} 
                            className="pl-7"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Project Manager */}
                <FormField
                  control={createForm.control}
                  name="projectManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Manager</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "" ? null : parseInt(value))} 
                        defaultValue={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {projectManagers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.firstName} {manager.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Optional: Assign a project manager to this project
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Image URL */}
                <FormField
                  control={createForm.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter image URL" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: URL to project image
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Progress */}
                <FormField
                  control={createForm.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progress (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="Enter progress percentage" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: Percentage of project completed (0-100)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the details of an existing project.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Name */}
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Status */}
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Description */}
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter project description" 
                        {...field} 
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Address */}
                <FormField
                  control={editForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* City */}
                <FormField
                  control={editForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* State */}
                <FormField
                  control={editForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter state" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Zip Code */}
                <FormField
                  control={editForm.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter zip code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date */}
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                          {field.value && (
                            <div className="p-2 border-t border-border">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-destructive gap-2"
                                onClick={() => field.onChange(undefined)}
                              >
                                <X className="h-4 w-4" />
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Estimated Completion Date */}
                <FormField
                  control={editForm.control}
                  name="estimatedCompletionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Estimated Completion Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                          {field.value && (
                            <div className="p-2 border-t border-border">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-destructive gap-2"
                                onClick={() => field.onChange(undefined)}
                              >
                                <X className="h-4 w-4" />
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Actual Completion Date */}
                <FormField
                  control={editForm.control}
                  name="actualCompletionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Actual Completion Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                          {field.value && (
                            <div className="p-2 border-t border-border">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-destructive gap-2"
                                onClick={() => field.onChange(undefined)}
                              >
                                <X className="h-4 w-4" />
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Total Budget */}
                <FormField
                  control={editForm.control}
                  name="totalBudget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Budget*</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                            $
                          </span>
                          <Input 
                            placeholder="Enter budget amount" 
                            {...field} 
                            className="pl-7"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Project Manager */}
                <FormField
                  control={editForm.control}
                  name="projectManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Manager</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "" ? null : parseInt(value))} 
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {projectManagers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id.toString()}>
                              {manager.firstName} {manager.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Optional: Assign a project manager to this project
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Image URL */}
                <FormField
                  control={editForm.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter image URL" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: URL to project image
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Progress */}
                <FormField
                  control={editForm.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progress (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="100" 
                          placeholder="Enter progress percentage" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: Percentage of project completed (0-100)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedProject(null);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={editProjectMutation.isPending}
                >
                  {editProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Project
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}