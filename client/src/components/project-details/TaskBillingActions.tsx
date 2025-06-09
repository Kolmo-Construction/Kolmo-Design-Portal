import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import type { Task } from "@shared/schema";

interface TaskBillingActionsProps {
  task: Task;
}

export function TaskBillingActions({ task }: TaskBillingActionsProps) {
  // Only show for billable tasks
  if (!task.isBillable) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
      <Badge variant="secondary" className="gap-1">
        <DollarSign className="h-3 w-3" />
        {task.billingType === 'fixed' 
          ? `$${task.billableAmount}` 
          : `${task.billingPercentage}% of project`
        }
      </Badge>
      
      {task.milestoneId && (
        <Badge variant="outline" className="gap-1">
          Milestone: #{task.milestoneId}
        </Badge>
      )}
    </div>
  );
}