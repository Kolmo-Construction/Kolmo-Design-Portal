import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface AgentAction {
  type: 'SUGGEST_ACTION' | 'RESPONSE';
  action?: 'CREATE_TASK' | 'UPDATE_TASK' | 'CREATE_MILESTONE' | 'SEND_INVOICE' | 'UPDATE_PROJECT_STATUS';
  payload?: Record<string, any>;
  message?: string;
  reasoning?: string;
}

export interface AgentConsultRequest {
  userPrompt: string;
  projectId?: number;
  context?: Record<string, any>;
}

export interface AgentConsultResponse {
  success: boolean;
  answer: string;
  actions?: AgentAction[];
  rawOutput?: string;
}

export function useAgentConsult() {
  const { toast } = useToast();

  const consultMutation = useMutation({
    mutationFn: async (request: AgentConsultRequest): Promise<AgentConsultResponse> => {
      return apiRequest('POST', '/api/agent/consult', request);
    },
    onError: (error: any) => {
      console.error('Agent consultation error:', error);
      toast({
        title: 'Agent Error',
        description: error.message || 'Failed to consult the AI agent',
        variant: 'destructive',
      });
    },
  });

  return {
    consult: consultMutation.mutate,
    consultAsync: consultMutation.mutateAsync,
    isConsulting: consultMutation.isPending,
    error: consultMutation.error,
    data: consultMutation.data,
    reset: consultMutation.reset,
  };
}
