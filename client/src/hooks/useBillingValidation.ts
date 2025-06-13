import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';

interface BillingValidationResult {
  isValid: boolean;
  currentTotal: number;
  remainingPercentage: number;
  errorMessage?: string;
  totalFromTasks: number;
  totalFromMilestones: number;
}

interface UseBillingValidationProps {
  projectId: number;
  billingPercentage?: number;
  excludeTaskId?: number;
  excludeMilestoneId?: number;
  enabled?: boolean;
}

export function useBillingValidation({
  projectId,
  billingPercentage = 0,
  excludeTaskId,
  excludeMilestoneId,
  enabled = true
}: UseBillingValidationProps) {
  const query = useQuery({
    queryKey: ['billing-validation', projectId, billingPercentage, excludeTaskId, excludeMilestoneId],
    queryFn: getQueryFn({
      on401: 'throw'
    }),
    enabled: enabled && projectId > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Calculate validation result from fetched data
  const calculateValidation = (): BillingValidationResult => {
    if (!query.data) {
      return {
        isValid: true,
        currentTotal: 0,
        remainingPercentage: 100,
        totalFromTasks: 0,
        totalFromMilestones: 0
      };
    }

    const { totalFromTasks, totalFromMilestones, grandTotal, remainingPercentage } = query.data;
    const proposedTotal = grandTotal + billingPercentage;

    if (proposedTotal > 100) {
      return {
        isValid: false,
        currentTotal: grandTotal,
        remainingPercentage,
        totalFromTasks,
        totalFromMilestones,
        errorMessage: `Total billing percentage would exceed 100%. Current total: ${grandTotal.toFixed(2)}%. Available: ${remainingPercentage.toFixed(2)}%. Please reduce the percentage to ${remainingPercentage.toFixed(2)}% or less.`
      };
    }

    return {
      isValid: true,
      currentTotal: grandTotal,
      remainingPercentage,
      totalFromTasks,
      totalFromMilestones
    };
  };

  return {
    ...query,
    validation: calculateValidation(),
    isLoading: query.isLoading,
    error: query.error
  };
}

// Helper hook for task billing validation
export function useTaskBillingValidation(
  projectId: number,
  billingPercentage?: number,
  excludeTaskId?: number,
  enabled = true
) {
  return useBillingValidation({
    projectId,
    billingPercentage,
    excludeTaskId,
    enabled
  });
}

// Helper hook for milestone billing validation
export function useMilestoneBillingValidation(
  projectId: number,
  billingPercentage?: number,
  excludeMilestoneId?: number,
  enabled = true
) {
  return useBillingValidation({
    projectId,
    billingPercentage,
    excludeMilestoneId,
    enabled
  });
}