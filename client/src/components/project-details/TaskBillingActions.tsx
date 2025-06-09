import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Task } from "@shared/schema";
import { useProjectTaskMutations } from "@/hooks/useProjectTaskMutations";

interface TaskBillingActionsProps {
  task: Task;
  projectId: number;
}

export function TaskBillingActions({ task, projectId }: TaskBillingActionsProps) {
  // Only show for billable tasks
  if (!task.isBillable) return null;

  const { completeAndBillMutation } = useProjectTaskMutations(projectId);
  const [actualHours, setActualHours] = useState<number | undefined>();

  // Check if task is completed (status is "Done")
  const isCompleted = task.status === "Done";
  
  // Check if task can be billed (not yet completed or no milestone created)
  const canBeBilled = !isCompleted && !task.milestoneId;

  const handleCompleteAndBill = () => {
    completeAndBillMutation.mutate({ 
      taskId: task.id, 
      actualHours: actualHours 
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2">
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

        {isCompleted && (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        )}
      </div>

      {canBeBilled && (
        <div className="flex items-center gap-2">
          {task.billingType === 'hourly' && (
            <input
              type="number"
              placeholder="Hours"
              className="w-16 px-2 py-1 text-xs border rounded"
              value={actualHours || ''}
              onChange={(e) => setActualHours(e.target.value ? Number(e.target.value) : undefined)}
            />
          )}
          <Button
            size="sm"
            onClick={handleCompleteAndBill}
            disabled={completeAndBillMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {completeAndBillMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete & Bill
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}