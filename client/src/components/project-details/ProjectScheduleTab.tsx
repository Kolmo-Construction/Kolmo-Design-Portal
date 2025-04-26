/* -------- client/src/components/project-details/ProjectScheduleTab.tsx -------- */
import { useQuery } from "@tanstack/react-query";
import { Milestone } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { format, isBefore, isToday } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Loader2, ClockIcon, AlertTriangle } from "lucide-react";

interface ProjectScheduleTabProps {
  projectId: number;
}

// Format date (can be moved to a utils file)
const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "Not set";
  try {
      return format(new Date(dateString), "MMM d, yyyy");
  } catch {
      return "Invalid Date";
  }
};

export function ProjectScheduleTab({ projectId }: ProjectScheduleTabProps) {
  const {
    data: milestones = [],
    isLoading: isLoadingMilestones
  } = useQuery<Milestone[]>({
    queryKey: [`/api/projects/${projectId}/milestones`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Sort milestones (can be moved to utils)
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.status !== "completed" && b.status === "completed") return -1;
    if (a.status === "completed" && b.status !== "completed") return 1;
    const dateA = new Date(a.status === "completed" ? (a.actualDate || a.plannedDate) : a.plannedDate);
    const dateB = new Date(b.status === "completed" ? (b.actualDate || b.plannedDate) : b.plannedDate);
    return dateA.getTime() - dateB.getTime();
  });

  // Get milestone badge (can be moved to utils)
  const getMilestoneBadge = (milestone: Milestone) => {
    const now = new Date();
    // Set time to 00:00:00 for consistent date comparison
    now.setHours(0, 0, 0, 0);
    const plannedDate = new Date(milestone.plannedDate);
    plannedDate.setHours(0,0,0,0);

    if (milestone.status === "completed") return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
    if (milestone.status === "delayed") return <Badge className="bg-red-100 text-red-800 border-red-300">Delayed</Badge>;
    if (isBefore(plannedDate, now) && !isToday(plannedDate)) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Overdue</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Scheduled</Badge>;
  };

   // Get milestone icon and color (can be moved to utils)
   const getMilestoneVisuals = (milestone: Milestone) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const plannedDate = new Date(milestone.plannedDate);
    plannedDate.setHours(0,0,0,0);

    let icon;
    let colorClass;
    if (milestone.status === "completed") {
      icon = <CheckCircle2 className="h-4 w-4" />;
      colorClass = "bg-green-100 text-green-600";
    } else if (milestone.status === "delayed") {
       icon = <AlertTriangle className="h-4 w-4" />;
       colorClass = "bg-red-100 text-red-600";
    } else if (isBefore(plannedDate, now) && !isToday(plannedDate)){
       icon = <AlertTriangle className="h-4 w-4" />;
       colorClass = "bg-yellow-100 text-yellow-600";
    }
     else {
      icon = <ClockIcon className="h-4 w-4" />;
      colorClass = "bg-blue-100 text-blue-600";
    }
    return { icon, colorClass };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Timeline</CardTitle>
        <CardDescription>Key milestones and schedule for this project</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingMilestones ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary-50 p-3 mb-4">
              <Calendar className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-slate-500">No milestones have been set for this project yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-slate-200 -z-10"></div>
            <ul className="space-y-6">
              {sortedMilestones.map((milestone) => {
                const { icon, colorClass } = getMilestoneVisuals(milestone);
                return (
                  <li key={milestone.id} className="relative pl-12">
                    {/* Icon */}
                    <div className="absolute left-[2px] top-[1px] flex items-center justify-center w-10 h-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white ${colorClass}`}>
                        {icon}
                      </div>
                    </div>
                    {/* Content Card */}
                    <div className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-slate-800">{milestone.title}</h4>
                        {getMilestoneBadge(milestone)}
                      </div>
                       {milestone.description && <p className="text-sm text-slate-500 mb-3">{milestone.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium">Planned:</span> {formatDate(milestone.plannedDate)}
                        </div>
                        {milestone.actualDate && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
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
  );
}
