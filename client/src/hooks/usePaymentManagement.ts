import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface PaymentSummary {
  projectId: number;
  totalBudget: number;
  downPaymentPaid: boolean;
  milestonePaid: boolean;
  finalPaid: boolean;
  nextPaymentAmount: number;
  nextPaymentType: 'milestone' | 'final' | null;
}

export function usePaymentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  // Get payment status for all projects
  const { data: paymentSummaries = [], isLoading: loadingPayments } = useQuery<PaymentSummary[]>({
    queryKey: ['/api/projects/payment-summaries'],
    retry: 2,
  });

  // Trigger down payment
  const triggerDownPayment = useMutation({
    mutationFn: async ({ projectId }: { projectId: number }) => {
      return apiRequest('POST', `/api/payment/projects/${projectId}/trigger-down-payment`);
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Down Payment Request Sent",
        description: "Down payment invoice has been sent to the customer with payment link.",
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/projects/payment-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.projectId}/invoices`] });
    },
    onError: (error: any) => {
      toast({
        title: "Down Payment Request Failed",
        description: error.message || "Failed to send down payment request",
        variant: "destructive",
      });
    },
  });

  // Trigger milestone payment
  const triggerMilestone = useMutation({
    mutationFn: async ({ projectId, paymentType, description }: {
      projectId: number;
      paymentType: 'milestone' | 'final';
      description?: string;
    }) => {
      const endpoint = paymentType === 'milestone'
        ? `/api/projects/${projectId}/milestone-payment`
        : `/api/projects/${projectId}/final-payment`;

      return apiRequest('POST', endpoint, {
        milestoneDescription: description || `${paymentType} payment request`
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Payment Request Created",
        description: `${variables.paymentType === 'milestone' ? 'Milestone' : 'Final'} payment request sent to customer.`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/projects/payment-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${variables.projectId}/invoices`] });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Request Failed",
        description: error.message || "Failed to create payment request",
        variant: "destructive",
      });
    },
  });

  return {
    paymentSummaries,
    loadingPayments,
    triggerDownPayment,
    triggerMilestone,
    selectedProject,
    setSelectedProject,
  };
}