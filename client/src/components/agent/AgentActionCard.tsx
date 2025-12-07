import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Edit,
  Flag,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

export interface AgentAction {
  type: 'SUGGEST_ACTION' | 'RESPONSE';
  action?: 'CREATE_TASK' | 'UPDATE_TASK' | 'CREATE_MILESTONE' | 'SEND_INVOICE' | 'UPDATE_PROJECT_STATUS';
  payload?: Record<string, any>;
  message?: string;
  reasoning?: string;
}

interface AgentActionCardProps {
  action: AgentAction;
  onApprove: (action: AgentAction) => void | Promise<void>;
  onReject: (action: AgentAction) => void | Promise<void>;
  isProcessing?: boolean;
}

const ACTION_METADATA = {
  CREATE_TASK: {
    label: 'Create Task',
    description: 'Add a new task to the project',
    icon: FileText,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  UPDATE_TASK: {
    label: 'Update Task',
    description: 'Modify an existing task',
    icon: Edit,
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  CREATE_MILESTONE: {
    label: 'Create Milestone',
    description: 'Add a new project milestone',
    icon: Flag,
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  SEND_INVOICE: {
    label: 'Send Invoice',
    description: 'Generate and send an invoice',
    icon: DollarSign,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  UPDATE_PROJECT_STATUS: {
    label: 'Update Project Status',
    description: 'Change the project status',
    icon: TrendingUp,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
  },
};

export function AgentActionCard({
  action,
  onApprove,
  onReject,
  isProcessing = false,
}: AgentActionCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // If this is just a response (not an action), render a simple message card
  if (action.type === 'RESPONSE' || !action.action) {
    return (
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-700">{action.message || 'No message provided'}</p>
        </CardContent>
      </Card>
    );
  }

  const metadata = ACTION_METADATA[action.action];
  const Icon = metadata.icon;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(action);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject(action);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Card className={`border-2 ${metadata.bgColor} border-gray-200 transition-shadow hover:shadow-md`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${metadata.color} text-white`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{metadata.label}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {metadata.description}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={metadata.textColor}>
            Suggested Action
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-4">
        {/* Reasoning */}
        {(action.reasoning || action.message) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Reasoning</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {action.reasoning || action.message}
            </p>
          </div>
        )}

        {/* Payload Details */}
        {action.payload && Object.keys(action.payload).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Details</h4>
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              {Object.entries(action.payload).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start gap-4">
                  <span className="text-sm font-medium text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="text-sm text-gray-800 text-right flex-1">
                    {typeof value === 'object'
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReject}
          disabled={isProcessing || isApproving || isRejecting}
          className="gap-2"
        >
          {isRejecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Rejecting...
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" />
              Reject
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isProcessing || isApproving || isRejecting}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          {isApproving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
