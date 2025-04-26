import { useQuery } from "@tanstack/react-query";
import { Milestone } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
// REMOVED: format, isBefore, isToday imports from date-fns (now handled in utils)
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
// REMOVED: Badge import (now handled in utils)
import { Calendar, CheckCircle2, Loader2 } from "lucide-react"; // Removed ClockIcon, AlertTriangle (now in utils)
// ADDED: Import centralized helpers
import { formatDate, getMilestoneBadge, getMilestoneVisuals } from "@/lib/utils";

interface ProjectScheduleTabProps {
  projectId: number;
}

// REMOVED: Local formatDate helper function
// REMOVED: Local getMilestoneBadge helper function
// REMOVED: Local getMilestoneVisuals helper function

export function ProjectScheduleTab({ projectId }: ProjectScheduleTabProps) {
  const {
    data: milestones = [],
    isLoading: isLoadingMilestones
  } = useQuery<Milestone[]>({
    queryKey: [`/api/projects/${projectId}/milestones`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Sort milestones (can be moved to utils, but okay here too)
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.status !== "completed" && b.status === "completed") return -1;
    if (a.status === "completed" && b.status !== "completed") return 1;
    // Ensure dates are valid before creating Date objects
    const dateAStr = a.status === "completed" ? (a.actualDate || a.plannedDate) : a.plannedDate;
    const dateBStr = b.status === "completed" ? (b.actualDate || b.plannedDate) : b.plannedDate;
    const dateA = dateAStr ? new Date(dateAStr) : new Date(0); // Fallback to epoch if undefined/null
    const dateB = dateBStr ? new Date(dateBStr) : new Date(0);
    if (isNaN(dateA.getTime())) return 1; // Invalid dates last
    if (isNaN(dateB.getTime())) return -1;
    return dateA.getTime() - dateB.getTime();
  });

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
                 // USE Imported helper
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
                         {/* USE Imported helper */}
                         {getMilestoneBadge(milestone)}
                      </div>
                       {milestone.description && <p className="text-sm text-slate-500 mb-3">{milestone.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                         <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {/* USE Imported helper */}
                          <span className="font-medium">Planned:</span> {formatDate(milestone.plannedDate)}
                        </div>
                         {milestone.actualDate && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                             {/* USE Imported helper */}
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