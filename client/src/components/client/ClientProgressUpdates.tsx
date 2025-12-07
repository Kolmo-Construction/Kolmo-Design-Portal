import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Brain,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Eye,
  Clock,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProgressUpdate {
  id: number;
  projectId: number;
  title: string;
  description: string;
  updateType: string;
  createdAt: string;
  generatedByAI: boolean;
  aiAnalysisMetadata?: {
    confidence?: number;
    imageIds?: number[];
  };
  rawLLMResponse?: {
    progressEstimate?: Record<string, number>;
    concernsOrIssues?: string[];
    recommendedActions?: string[];
  };
  isNew?: boolean;
}

interface ClientProgressUpdatesProps {
  projectId: number;
}

export function ClientProgressUpdates({ projectId }: ClientProgressUpdatesProps) {
  const queryClient = useQueryClient();
  const [selectedUpdate, setSelectedUpdate] = useState<ProgressUpdate | null>(null);

  // Fetch progress updates with read status
  const { data: response, isLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'updates', 'with-read-status'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/updates/with-read-status`, {
        credentials: 'include',
      });
      return res.json();
    },
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (updateId: number) => {
      const res = await fetch(`/api/projects/${projectId}/updates/${updateId}/mark-read`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'updates'] });
    },
  });

  const updates = response?.updates || [];
  const newUpdatesCount = updates.filter((u: ProgressUpdate) => u.isNew).length;

  const handleViewUpdate = (update: ProgressUpdate) => {
    setSelectedUpdate(update);
    if (update.isNew) {
      markReadMutation.mutate(update.id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-kolmo-accent" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">No Updates Yet</h3>
          <p className="text-sm text-muted-foreground">
            Progress updates from your project team will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with new updates badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Progress Updates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {updates.length} update{updates.length !== 1 ? 's' : ''}
            {newUpdatesCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-kolmo-accent" />
                <span className="font-medium text-kolmo-accent">
                  {newUpdatesCount} new
                </span>
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Timeline View */}
      <div className="relative space-y-6">
        {/* Vertical timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        {updates.map((update: ProgressUpdate, index: number) => (
          <div key={update.id} className="relative">
            {/* Timeline dot */}
            <div className="absolute left-3 top-6 w-6 h-6 rounded-full border-4 border-background bg-kolmo-accent z-10 flex items-center justify-center">
              {update.generatedByAI ? (
                <Brain className="h-3 w-3 text-white" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-white" />
              )}
            </div>

            {/* Update card */}
            <Card
              className={`ml-16 cursor-pointer transition-all hover:shadow-lg ${
                update.isNew ? 'ring-2 ring-kolmo-accent ring-offset-2' : ''
              }`}
              onClick={() => handleViewUpdate(update)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {update.isNew && (
                        <Badge className="bg-kolmo-accent text-white">
                          <Sparkles className="h-3 w-3 mr-1" />
                          New
                        </Badge>
                      )}
                      {update.generatedByAI && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          <Brain className="h-3 w-3 mr-1" />
                          AI Report
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize">
                        {update.updateType.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{update.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(update.createdAt)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {update.description.split('\n')[0]}
                </p>

                {/* Progress preview for AI reports */}
                {update.generatedByAI && update.rawLLMResponse?.progressEstimate && (
                  <div className="mt-4 space-y-2">
                    {Object.entries(update.rawLLMResponse.progressEstimate)
                      .slice(0, 2)
                      .map(([phase, percentage]) => (
                        <div key={phase} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="capitalize text-muted-foreground">{phase}</span>
                              <span className="font-medium">{percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-kolmo-accent h-1.5 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Metadata footer */}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  {update.aiAnalysisMetadata?.imageIds && (
                    <div className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      {update.aiAnalysisMetadata.imageIds.length} images
                    </div>
                  )}
                  {update.aiAnalysisMetadata?.confidence && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {(update.aiAnalysisMetadata.confidence * 100).toFixed(0)}% confidence
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedUpdate} onOpenChange={() => setSelectedUpdate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUpdate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {selectedUpdate.generatedByAI && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      <Brain className="h-4 w-4 mr-1" />
                      AI-Generated Report
                    </Badge>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {selectedUpdate.updateType.replace('_', ' ')}
                  </Badge>
                </div>
                <DialogTitle>{selectedUpdate.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedUpdate.createdAt)}
                </p>
              </DialogHeader>

              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h4 className="font-semibold mb-2">Update Details</h4>
                  <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                    {selectedUpdate.description}
                  </div>
                </div>

                {/* Progress Breakdown for AI reports */}
                {selectedUpdate.generatedByAI &&
                  selectedUpdate.rawLLMResponse?.progressEstimate &&
                  Object.keys(selectedUpdate.rawLLMResponse.progressEstimate).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-kolmo-accent" />
                        Progress Breakdown
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(selectedUpdate.rawLLMResponse.progressEstimate).map(
                          ([phase, percentage]) => (
                            <div key={phase}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="capitalize font-medium">{phase}</span>
                                <span className="text-kolmo-accent font-bold">{percentage}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-kolmo-accent h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Concerns for AI reports */}
                {selectedUpdate.generatedByAI &&
                  selectedUpdate.rawLLMResponse?.concernsOrIssues &&
                  selectedUpdate.rawLLMResponse.concernsOrIssues.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        Items to Note
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {selectedUpdate.rawLLMResponse.concernsOrIssues.map((concern, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            {concern}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Recommended Actions for AI reports */}
                {selectedUpdate.generatedByAI &&
                  selectedUpdate.rawLLMResponse?.recommendedActions &&
                  selectedUpdate.rawLLMResponse.recommendedActions.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Next Steps</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {selectedUpdate.rawLLMResponse.recommendedActions.map((action, idx) => (
                          <li key={idx} className="text-muted-foreground">
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* AI Report Info */}
                {selectedUpdate.generatedByAI && (
                  <Alert className="bg-purple-50 border-purple-200">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <AlertDescription className="text-sm text-purple-900">
                      This report was generated using AI analysis of project photos and has been
                      reviewed by your project team before being shared with you.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
