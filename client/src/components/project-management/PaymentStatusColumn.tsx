import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Project } from '@shared/schema';

interface PaymentStatusColumnProps {
  project: Project;
  onTriggerDownPayment?: (projectId: number) => void;
  onTriggerMilestone?: (projectId: number, paymentType: 'milestone' | 'final') => void;
}

export function PaymentStatusColumn({ project, onTriggerDownPayment, onTriggerMilestone }: PaymentStatusColumnProps) {
  const totalBudget = parseFloat(project.totalBudget?.toString() || '0');
  
  // Calculate expected payment amounts (will be replaced with actual invoice data)
  const downPaymentAmount = totalBudget * 0.4; // Default 40%
  const milestoneAmount = totalBudget * 0.4;   // Default 40%
  const finalAmount = totalBudget * 0.2;       // Default 20%

  // Mock payment status - will be replaced with real data
  const paymentStatus = {
    downPaymentPaid: project.status !== 'planning', // Assume down payment paid if not planning
    milestonePaid: project.status === 'completed',
    finalPaid: project.status === 'completed',
  };

  const getPaymentStatusBadge = () => {
    if (paymentStatus.finalPaid) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid in Full</Badge>;
    }
    if (paymentStatus.milestonePaid) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Final Due</Badge>;
    }
    if (paymentStatus.downPaymentPaid) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Milestone Due</Badge>;
    }
    return <Badge variant="destructive"><DollarSign className="h-3 w-3 mr-1" />Down Payment Due</Badge>;
  };

  const getNextPaymentAction = () => {
    if (paymentStatus.finalPaid) return null;

    if (paymentStatus.milestonePaid && !paymentStatus.finalPaid) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onTriggerMilestone?.(project.id, 'final')}
          className="text-xs"
        >
          Request Final Payment
        </Button>
      );
    }

    if (paymentStatus.downPaymentPaid && !paymentStatus.milestonePaid) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onTriggerMilestone?.(project.id, 'milestone')}
          className="text-xs"
        >
          Request Milestone Payment
        </Button>
      );
    }

    // Show down payment button when project is in planning (no down payment paid yet)
    if (!paymentStatus.downPaymentPaid) {
      return (
        <Button
          size="sm"
          variant="default"
          onClick={() => onTriggerDownPayment?.(project.id)}
          className="text-xs bg-blue-600 hover:bg-blue-700"
        >
          <DollarSign className="h-3 w-3 mr-1" />
          Send Down Payment Request
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="space-y-2">
      {getPaymentStatusBadge()}
      <div className="text-xs text-gray-600">
        Budget: ${totalBudget.toFixed(2)}
      </div>
      {getNextPaymentAction()}
    </div>
  );
}