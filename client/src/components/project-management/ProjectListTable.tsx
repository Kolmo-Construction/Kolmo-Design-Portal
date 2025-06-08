import { Project, User, ProjectStatus } from "@shared/schema"; // ADDED ProjectStatus
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, PencilIcon } from "lucide-react";
// REMOVED: format import from date-fns (not used here)
// ADDED Imports from utils
import { getProjectStatusLabel, getProjectStatusBadgeClasses } from "@/lib/utils";
import { PaymentStatusColumn } from "./PaymentStatusColumn";

interface ProjectListTableProps {
  projects: Project[];
  projectManagers: User[];
  isLoading: boolean;
  onEditProject: (project: Project) => void;
  onTriggerMilestone?: (projectId: number, paymentType: 'milestone' | 'final') => void;
}

// REMOVED: Local getStatusLabel helper function
// REMOVED: Local getStatusBadgeClasses helper function


export function ProjectListTable({
  projects,
  projectManagers,
  isLoading,
  onEditProject,
  onTriggerMilestone,
}: ProjectListTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
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

        {projects.length > 0 ? (
          projects.map((project) => {
            const manager = projectManagers?.find(
              (pm) => pm.id === project.projectManagerId
            );
            return (
              <TableRow key={project.id}>

                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>
                  {project.city}, {project.state}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className={getProjectStatusBadgeClasses(project.status as ProjectStatus)}> {/* USE Imported helper */}

                        {getProjectStatusLabel(project.status as ProjectStatus)} {/* USE Imported helper */}
                    </Badge>
                </TableCell>
                <TableCell>
                  ${Number(project.totalBudget ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}

                </TableCell>
                <TableCell>
                  {manager
                    ? `${manager.firstName} ${manager.lastName}`

                    : project.projectManagerId
                    ? <span className="text-slate-400 italic">Loading...</span>

                    : <span className="text-slate-400">Unassigned</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"

                    onClick={() => onEditProject(project)}
                    className="gap-1"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Edit

                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
              No projects match the current filters.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}