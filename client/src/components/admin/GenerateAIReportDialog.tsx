import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, AlertCircle, CheckCircle, DollarSign, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GenerateAIReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
}

export function GenerateAIReportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: GenerateAIReportDialogProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation to generate AI report
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/updates/generate-ai-report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            batchByDate: true, // Group images by date
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate AI report');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'AI Report Generated!',
        description: `Report created successfully with ${data.data.imageCount} images analyzed.`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/updates`] });
      queryClient.invalidateQueries({ queryKey: ['/api/progress-updates/ai-generated'] });

      // Close dialog
      onOpenChange(false);

      // Navigate to AI report review page
      navigate('/admin/ai-report-review');
    },
    onError: (error: Error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    generateReportMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Generate AI Progress Report
          </DialogTitle>
          <DialogDescription>
            Create an AI-powered progress report for {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Gemini 2.0 Flash will analyze all unanalyzed progress images for this project and generate a comprehensive status report.
            </AlertDescription>
          </Alert>

          {/* Features List */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm">Report will include:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Executive summary of project progress</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Key observations from site photos</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Progress estimates by construction phase</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Safety concerns and quality issues</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Recommended next actions</span>
              </li>
            </ul>
          </div>

          {/* Cost & Model Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50">
                <Brain className="h-3 w-3 mr-1" />
                Google Gemini 2.0 Flash
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <DollarSign className="h-3 w-3" />
              <span className="font-medium">~$0.001 per 8 images</span>
            </div>
          </div>

          {/* Status Badge */}
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-sm">
              The generated report will be saved as a <Badge variant="outline">Draft</Badge> and require admin review before client visibility.
            </AlertDescription>
          </Alert>

          {/* Error Display */}
          {generateReportMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {generateReportMutation.error instanceof Error
                  ? generateReportMutation.error.message
                  : 'Failed to generate report'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generateReportMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateReportMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {generateReportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
