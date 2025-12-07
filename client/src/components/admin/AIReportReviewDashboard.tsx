import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Edit3,
  Loader2,
  DollarSign,
  Calendar,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AIProgressUpdate {
  id: number;
  projectId: number;
  title: string;
  description: string;
  updateType: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  visibility: 'admin_only' | 'published';
  generatedByAI: boolean;
  reviewedById?: number;
  reviewedAt?: string;
  createdAt: string;
  aiAnalysisMetadata?: {
    confidence?: number;
    tokensUsed?: { input: number; output: number };
    cost?: { total: number };
    imageIds?: number[];
  };
  rawLLMResponse?: {
    executiveSummary?: string;
    keyObservations?: string[];
    progressEstimate?: Record<string, number>;
    concernsOrIssues?: string[];
    recommendedActions?: string[];
  };
}

interface AIReportReviewDashboardProps {
  projectId?: number; // Optional: filter by specific project
}

export function AIReportReviewDashboard({ projectId }: AIReportReviewDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<AIProgressUpdate | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [activeTab, setActiveTab] = useState<string>('draft');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch AI-generated progress updates
  const { data: updates, isLoading } = useQuery({
    queryKey: ['/api/progress-updates/ai-generated', projectId, activeTab],
    queryFn: async () => {
      const url = projectId
        ? `/api/projects/${projectId}/updates`
        : `/api/progress-updates`;

      const response = await fetch(url, {
        credentials: 'include',
      });

      const data = await response.json();

      // Filter AI-generated updates by status
      return (data.updates || []).filter((update: AIProgressUpdate) => {
        if (!update.generatedByAI) return false;
        if (activeTab === 'all') return true;
        return update.status === activeTab;
      });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ updateId, publish }: { updateId: number; publish: boolean }) => {
      const update = updates?.find((u: AIProgressUpdate) => u.id === updateId);
      if (!update) throw new Error('Update not found');

      const response = await fetch(
        `/api/projects/${update.projectId}/updates/${updateId}/approve`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            publish,
            editedDescription: isEditingDescription ? editedDescription : undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-updates/ai-generated'] });
      setSelectedReport(null);
      setIsEditingDescription(false);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ updateId, reason }: { updateId: number; reason: string }) => {
      const update = updates?.find((u: AIProgressUpdate) => u.id === updateId);
      if (!update) throw new Error('Update not found');

      const response = await fetch(
        `/api/projects/${update.projectId}/updates/${updateId}/reject`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-updates/ai-generated'] });
      setSelectedReport(null);
      setShowRejectDialog(false);
      setRejectionReason('');
    },
  });

  // Publish/Unpublish mutation
  const togglePublishMutation = useMutation({
    mutationFn: async ({ updateId, action }: { updateId: number; action: 'publish' | 'unpublish' }) => {
      const update = updates?.find((u: AIProgressUpdate) => u.id === updateId);
      if (!update) throw new Error('Update not found');

      const response = await fetch(
        `/api/projects/${update.projectId}/updates/${updateId}/${action}`,
        {
          method: 'PUT',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/progress-updates/ai-generated'] });
      setSelectedReport(null);
    },
  });

  const handleEditDescription = (report: AIProgressUpdate) => {
    setEditedDescription(report.description);
    setIsEditingDescription(true);
  };

  const handleApprove = (updateId: number, publish: boolean) => {
    approveMutation.mutate({ updateId, publish });
  };

  const handleReject = () => {
    if (selectedReport) {
      rejectMutation.mutate({ updateId: selectedReport.id, reason: rejectionReason });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-gray-500', label: 'Draft' },
      pending_review: { color: 'bg-yellow-500', label: 'Pending Review' },
      approved: { color: 'bg-green-500', label: 'Approved' },
      rejected: { color: 'bg-red-500', label: 'Rejected' },
    };

    const variant = variants[status] || variants.draft;

    return (
      <Badge className={`${variant.color} text-white`}>
        {variant.label}
      </Badge>
    );
  };

  const getVisibilityBadge = (visibility: string) => {
    return visibility === 'published' ? (
      <Badge variant="default" className="bg-blue-500">
        <Eye className="h-3 w-3 mr-1" />
        Published
      </Badge>
    ) : (
      <Badge variant="secondary">
        <EyeOff className="h-3 w-3 mr-1" />
        Admin Only
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-kolmo-accent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-kolmo-accent" />
            AI Progress Report Review
          </CardTitle>
          <CardDescription>
            Review and approve AI-generated construction progress reports before client visibility
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="pending_review">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-6">
              {(!updates || updates.length === 0) ? (
                <Alert>
                  <AlertDescription>
                    No AI-generated reports found with status: {activeTab}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4">
                  {updates.map((update: AIProgressUpdate) => (
                    <Card key={update.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">{update.title}</h3>
                              {getStatusBadge(update.status)}
                              {getVisibilityBadge(update.visibility)}
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {update.description}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(update.createdAt).toLocaleDateString()}
                              </div>

                              {update.aiAnalysisMetadata?.imageIds && (
                                <div className="flex items-center gap-1">
                                  <ImageIcon className="h-3 w-3" />
                                  {update.aiAnalysisMetadata.imageIds.length} images
                                </div>
                              )}

                              {update.aiAnalysisMetadata?.confidence && (
                                <div>
                                  Confidence: {(update.aiAnalysisMetadata.confidence * 100).toFixed(0)}%
                                </div>
                              )}

                              {update.aiAnalysisMetadata?.cost && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${update.aiAnalysisMetadata.cost.total.toFixed(3)}
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReport(update)}
                          >
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => {
        setSelectedReport(null);
        setIsEditingDescription(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedReport.title}</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedReport.status)}
                    {getVisibilityBadge(selectedReport.visibility)}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Report Content</h4>
                    {!isEditingDescription && selectedReport.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditDescription(selectedReport)}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {isEditingDescription ? (
                    <Textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                      {selectedReport.description}
                    </div>
                  )}
                </div>

                {/* AI Analysis Details */}
                {selectedReport.rawLLMResponse && (
                  <div className="space-y-4">
                    {selectedReport.rawLLMResponse.progressEstimate &&
                      Object.keys(selectedReport.rawLLMResponse.progressEstimate).length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Progress Breakdown</h4>
                          <div className="space-y-2">
                            {Object.entries(selectedReport.rawLLMResponse.progressEstimate).map(
                              ([phase, percentage]) => (
                                <div key={phase}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="capitalize">{phase}</span>
                                    <span className="font-medium">{percentage}%</span>
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

                    {selectedReport.rawLLMResponse.concernsOrIssues &&
                      selectedReport.rawLLMResponse.concernsOrIssues.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            Concerns or Issues
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {selectedReport.rawLLMResponse.concernsOrIssues.map((concern, idx) => (
                              <li key={idx} className="text-orange-600">
                                {concern}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}

                {/* Metadata */}
                {selectedReport.aiAnalysisMetadata && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm">Analysis Metadata</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Confidence</p>
                        <p className="font-medium">
                          {(selectedReport.aiAnalysisMetadata.confidence! * 100).toFixed(0)}%
                        </p>
                      </div>
                      {selectedReport.aiAnalysisMetadata.tokensUsed && (
                        <div>
                          <p className="text-muted-foreground">Tokens Used</p>
                          <p className="font-medium">
                            {selectedReport.aiAnalysisMetadata.tokensUsed.input.toLocaleString()} in /{' '}
                            {selectedReport.aiAnalysisMetadata.tokensUsed.output.toLocaleString()} out
                          </p>
                        </div>
                      )}
                      {selectedReport.aiAnalysisMetadata.cost && (
                        <div>
                          <p className="text-muted-foreground">Cost</p>
                          <p className="font-medium text-green-600">
                            ${selectedReport.aiAnalysisMetadata.cost.total.toFixed(3)}
                          </p>
                        </div>
                      )}
                      {selectedReport.aiAnalysisMetadata.imageIds && (
                        <div>
                          <p className="text-muted-foreground">Images Analyzed</p>
                          <p className="font-medium">
                            {selectedReport.aiAnalysisMetadata.imageIds.length} images
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2">
                {/* Show different actions based on status */}
                {selectedReport.status === 'draft' && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApprove(selectedReport.id, false)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedReport.id, true)}
                      disabled={approveMutation.isPending}
                      className="bg-kolmo-accent"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Approve & Publish
                    </Button>
                  </>
                )}

                {selectedReport.status === 'approved' && (
                  <>
                    {selectedReport.visibility === 'admin_only' ? (
                      <Button
                        onClick={() =>
                          togglePublishMutation.mutate({ updateId: selectedReport.id, action: 'publish' })
                        }
                        disabled={togglePublishMutation.isPending}
                        className="bg-kolmo-accent"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Publish to Client Portal
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() =>
                          togglePublishMutation.mutate({ updateId: selectedReport.id, action: 'unpublish' })
                        }
                        disabled={togglePublishMutation.isPending}
                      >
                        <EyeOff className="h-4 w-4 mr-2" />
                        Remove from Client Portal
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject AI Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this report (optional):
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Analysis is too generic, missing key observations..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
