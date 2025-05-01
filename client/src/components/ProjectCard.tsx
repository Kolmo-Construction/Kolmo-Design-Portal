import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Project } from "@shared/schema";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  // Determine status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning":
        return "bg-accent-600";
      case "in_progress":
        return "bg-primary-600";
      case "on_hold":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-600";
      default:
        return "bg-slate-600";
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

  // Format dates
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "Not set";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  return (
    <div className="dashboard-card bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-md">
      <div className="h-40 bg-slate-200 relative">
        <img
          src={project.imageUrl ||
            `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`}
          alt={project.name}
          className="w-full h-full object-cover"
        />
        <div className={cn(
          "absolute top-3 right-3 text-white text-xs px-2 py-1 rounded-full",
          getStatusColor(project.status)
        )}>
          {getStatusLabel(project.status)}
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-slate-800 text-lg mb-2">{project.name}</h3>
        <p className="text-slate-600 text-sm mb-4">{project.address}, {project.city}, {project.state}</p>

        <div className="flex items-center text-sm text-slate-500 mb-4">
          <CalendarIcon className="h-5 w-5 mr-1" />
          Start: {formatDate(project.startDate)}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
          <div
            className={cn(
              "h-2.5 rounded-full",
              project.status === "on_hold" ? "bg-yellow-500" : "bg-primary-600"
            )}
            style={{ width: `${project.progress || 0}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{project.progress || 0}% Complete</span>
          <span className="text-slate-500">
            Est. Completion: {formatDate(project.estimatedCompletionDate)}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <Link href={`/projects/${project.id}`}>
            <Button variant="outline" className="w-full text-primary-600 border-primary-600 hover:bg-primary-50">
              View Project Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
