import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Milestone, Project } from "@shared/schema";
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
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckCircle2,
  ClockIcon,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { format, isBefore, addDays } from "date-fns";

export default function Schedule() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all milestones across all projects
  const { 
    data: allMilestones = [],
    isLoading: isLoadingMilestones 
  } = useQuery<Milestone[]>({
    queryKey: ["/api/milestones"],
    enabled: projects.length > 0,
  });

  // Filter milestones based on project
  const filteredMilestones = allMilestones.filter(milestone => 
    projectFilter === "all" || milestone.projectId.toString() === projectFilter
  );

  // Sort milestones by date (upcoming first, then completed)
  const sortedMilestones = [...filteredMilestones].sort((a, b) => {
    // First check by status - pending/delayed first, then completed
    if (a.status !== "completed" && b.status === "completed") return -1;
    if (a.status === "completed" && b.status !== "completed") return 1;
    
    // Then by date
    const dateA = new Date(a.status === "completed" ? a.actualDate || a.plannedDate : a.plannedDate);
    const dateB = new Date(b.status === "completed" ? b.actualDate || b.plannedDate : b.plannedDate);
    return dateA.getTime() - dateB.getTime();
  });

  // Format date
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "Not set";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Get milestone status badge
  const getMilestoneBadge = (milestone: Milestone) => {
    const now = new Date();
    const plannedDate = new Date(milestone.plannedDate);
    
    if (milestone.status === "completed") {
      return (
        <Badge className="bg-green-600">Completed</Badge>
      );
    } else if (milestone.status === "delayed") {
      return (
        <Badge className="bg-red-600">Delayed</Badge>
      );
    } else if (isBefore(plannedDate, now)) {
      // If the planned date is in the past but not marked as delayed or completed
      return (
        <Badge className="bg-yellow-500">Overdue</Badge>
      );
    } else if (isBefore(plannedDate, addDays(now, 7))) {
      // If the planned date is within the next 7 days
      return (
        <Badge className="bg-orange-500">Upcoming</Badge>
      );
    } else {
      // Otherwise, it's a future milestone
      return (
        <Badge className="bg-blue-600">Scheduled</Badge>
      );
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Project Schedule</h1>
          <p className="text-slate-600">Track key milestones and timeline for your projects</p>
        </div>

        {/* Project Filter */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6">
            <div className="w-full sm:w-1/3">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Select Project</label>
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
          </CardContent>
        </Card>

        {/* Project Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Project Timeline</CardTitle>
            <CardDescription>
              Key milestones and scheduled events for your construction projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(isLoadingProjects || isLoadingMilestones) ? (
              <div className="space-y-6 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
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
            ) : filteredMilestones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-primary-50 p-3 mb-4">
                  <Calendar className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Milestones Found</h3>
                <p className="text-center text-slate-500 mb-6 max-w-md">
                  {allMilestones.length === 0 
                    ? "No milestones have been set for any of your projects yet."
                    : "No milestones match your current filter. Try selecting a different project."}
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-slate-200"></div>
                <ul className="space-y-6">
                  {sortedMilestones.map((milestone) => {
                    // Find the associated project
                    const project = projects.find(p => p.id === milestone.projectId);
                    
                    // Determine icon based on status
                    let icon;
                    let colorClass;
                    
                    if (milestone.status === "completed") {
                      icon = <CheckCircle2 className="h-4 w-4" />;
                      colorClass = "bg-green-100 text-green-600";
                    } else if (milestone.status === "delayed") {
                      icon = <AlertTriangle className="h-4 w-4" />;
                      colorClass = "bg-red-100 text-red-600";
                    } else {
                      icon = <ClockIcon className="h-4 w-4" />;
                      colorClass = "bg-blue-100 text-blue-600";
                    }
                    
                    return (
                      <li key={milestone.id} className="relative pl-12">
                        <div className="absolute left-0 flex items-center justify-center w-12 h-12">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white ${colorClass}`}>
                            {icon}
                          </div>
                        </div>
                        <div className="rounded-lg border p-4 bg-white">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{milestone.title}</h4>
                              <p className="text-sm text-slate-600">{project?.name || `Project ID: ${milestone.projectId}`}</p>
                              <p className="text-sm text-slate-500 mt-1">{milestone.description}</p>
                            </div>
                            {getMilestoneBadge(milestone)}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span className="font-medium">Planned:</span> {formatDate(milestone.plannedDate)}
                            </div>
                            {milestone.actualDate && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">Completed:</span> {formatDate(milestone.actualDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
