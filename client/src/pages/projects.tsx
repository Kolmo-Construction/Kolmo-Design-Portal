import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import ProjectCard from "@/components/ProjectCard";
import { Project, ProjectWithDetails } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, Search } from "lucide-react";

export default function Projects() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  
  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<(Project & {
    projectManager?: { id: number; firstName: string; lastName: string } | null;
    clients?: { id: number; firstName: string; lastName: string }[];
  })[]>({
    queryKey: ["/api/projects"],
  });

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter(project => {
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      
      if (!searchQuery) return matchesStatus;
      
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        project.name.toLowerCase().includes(query) || 
        project.address.toLowerCase().includes(query) ||
        project.city.toLowerCase().includes(query) ||
        project.state.toLowerCase().includes(query) ||
        // Search by client names
        (project.clients && project.clients.some(client => 
          `${client.firstName} ${client.lastName}`.toLowerCase().includes(query) ||
          client.firstName.toLowerCase().includes(query) ||
          client.lastName.toLowerCase().includes(query)
        )) ||
        // Search by project manager name
        (project.projectManager && 
          `${project.projectManager.firstName} ${project.projectManager.lastName}`.toLowerCase().includes(query));
      
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "oldest":
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case "name":
          return a.name.localeCompare(b.name);
        case "client":
          const clientA = a.clients?.[0] ? `${a.clients[0].firstName} ${a.clients[0].lastName}` : "";
          const clientB = b.clients?.[0] ? `${b.clients[0].firstName} ${b.clients[0].lastName}` : "";
          return clientA.localeCompare(clientB);
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Projects</h1>
          <p className="text-slate-600">View and manage all your construction and remodeling projects</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6 flex flex-col lg:flex-row gap-4 items-end">
            <div className="w-full lg:w-1/4">
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
            <div className="w-full lg:w-1/4">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Sort by</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Project Name</SelectItem>
                  <SelectItem value="client">Client Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full lg:w-1/2 relative">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by project name, address, client name, or project manager"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
        ) : filteredAndSortedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary-50 p-3 mb-4">
                <Building2 className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Projects Found</h3>
              <p className="text-center text-slate-500 mb-6 max-w-md">
                {projects.length === 0 
                  ? "You don't have any projects assigned to you yet. Check back later or contact your project manager."
                  : "No projects match your current filters. Try adjusting your search or filter criteria."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
