import { Project } from "@shared/schema";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Calendar,
  User,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectOverviewCardProps {
  project: Project;
}

// Helper function to format dates (can be moved to a utils file)
const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "Not set";
  try {
      return format(new Date(dateString), "MMM d, yyyy");
  } catch {
      return "Invalid Date";
  }
};

export function ProjectOverviewCard({ project }: ProjectOverviewCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Project Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Start Date */}
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Start Date</p>
            <p className="flex items-center gap-1 font-medium">
              <Calendar className="h-4 w-4 text-slate-400" />
              {formatDate(project.startDate)}
            </p>
          </div>

          {/* Estimated Completion */}
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Estimated Completion</p>
            <p className="flex items-center gap-1 font-medium">
              <Calendar className="h-4 w-4 text-slate-400" />
              {formatDate(project.estimatedCompletionDate)}
            </p>
          </div>

          {/* Project Manager */}
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Project Manager</p>
            {/* Note: Displaying the actual manager name requires fetching user data */}
            <p className="flex items-center gap-1 font-medium">
              <User className="h-4 w-4 text-slate-400" />
              {project.projectManagerId ? `ID: ${project.projectManagerId}` : "Not Assigned"}
            </p>
          </div>

          {/* Total Budget */}
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Total Budget</p>
            <p className="flex items-center gap-1 font-medium">
              <CreditCard className="h-4 w-4 text-slate-400" />
              ${Number(project.totalBudget ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Progress</span>
            <span>{project.progress ?? 0}% Complete</span>
          </div>
          <Progress value={project.progress ?? 0} className="h-2" />
        </div>

        {/* Description */}
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
  );
}
