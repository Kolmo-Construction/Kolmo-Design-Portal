import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Building,
  Loader2,
  Eye,
} from 'lucide-react';
import { Link } from 'wouter';

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
  };
  isNew?: boolean;
  project?: {
    id: number;
    name: string;
  };
}

interface Project {
  id: number;
  name: string;
}

export function DashboardRecentUpdates() {
  const queryClient = useQueryClient();
  const [selectedUpdate, setSelectedUpdate] = useState<ProgressUpdate | null>(null);

  // Fetch user's projects
  const { data: projectsData } = useQuery({
    queryKey: ['/api/client-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/client-dashboard', {
        credentials: 'include',
      });
      return res.json();
    },
  });

  const projects: Project[] = projectsData?.projects || [];
  const projectIds = projects.map((p: Project) => p.id);

  // Fetch all updates from all client projects
  const { data: allUpdatesData, isLoading } = useQuery({
    queryKey: ['/api/client-dashboard-updates', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];

      // Fetch updates from all projects
      const responses = await Promise.all(
        projectIds.map((projectId) =>
          fetch(`/api/projects/${projectId}/updates/with-read-status`, {
            credentials: 'include',
          }).then((res) => res.json())
        )
      );

      // Combine all updates and add project info
      const allUpdates: ProgressUpdate[] = [];
      responses.forEach((response, index) => {
        const projectUpdates = response.updates || [];
        projectUpdates.forEach((update: ProgressUpdate) => {
          allUpdates.push({
            ...update,
            project: projects[index],
          });
        });
      });

      // Sort by creation date (newest first)
      allUpdates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return allUpdates.slice(0, 10); // Show latest 10 updates
    },
    enabled: projectIds.length > 0,
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async ({ projectId, updateId }: { projectId: number; updateId: number }) => {
      const res = await fetch(`/api/projects/${projectId}/updates/${updateId}/mark-read`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-dashboard-updates'] });
    },
  });

  const updates = allUpdatesData || [];
  const newUpdatesCount = updates.filter((u: ProgressUpdate) => u.isNew).length;

  const handleViewUpdate = (update: ProgressUpdate) => {
    setSelectedUpdate(update);
    if (update.isNew && update.project) {
      markReadMutation.mutate({ projectId: update.project.id, updateId: update.id });
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
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-kolmo-accent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No updates yet. Progress updates from your projects will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-accent/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-kolmo-accent" />
              Recent Project Updates
            </CardTitle>
            {newUpdatesCount > 0 && (
              <Badge className="bg-kolmo-accent text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                {newUpdatesCount} new
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {updates.map((update: ProgressUpdate) => (
              <div
                key={update.id}
                onClick={() => handleViewUpdate(update)}
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                  update.isNew
                    ? 'border-kolmo-accent bg-kolmo-accent/5 ring-1 ring-kolmo-accent ring-offset-1'
                    : 'border-border hover:border-accent/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {update.isNew && (
                        <Badge className="bg-kolmo-accent text-white text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          New
                        </Badge>
                      )}
                      {update.generatedByAI && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                          <Brain className="h-3 w-3 mr-1" />
                          AI Report
                        </Badge>
                      )}
                      {update.project && (
                        <Badge variant="outline" className="text-xs">
                          <Building className="h-3 w-3 mr-1" />
                          {update.project.name}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-sm mb-1">{update.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {update.description.split('\n')[0]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(update.createdAt)}
                    </span>
                    {update.project && (
                      <Link to={`/project-details/${update.project.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Project
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedUpdate} onOpenChange={() => setSelectedUpdate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedUpdate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {selectedUpdate.generatedByAI && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      <Brain className="h-4 w-4 mr-1" />
                      AI-Generated Report
                    </Badge>
                  )}
                  {selectedUpdate.project && (
                    <Badge variant="outline">
                      <Building className="h-4 w-4 mr-1" />
                      {selectedUpdate.project.name}
                    </Badge>
                  )}
                </div>
                <DialogTitle>{selectedUpdate.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedUpdate.createdAt)}
                </p>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Update Details</h4>
                  <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                    {selectedUpdate.description}
                  </div>
                </div>

                {selectedUpdate.generatedByAI &&
                  selectedUpdate.rawLLMResponse?.progressEstimate &&
                  Object.keys(selectedUpdate.rawLLMResponse.progressEstimate).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Progress Breakdown</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedUpdate.rawLLMResponse.progressEstimate).map(
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

                {selectedUpdate.project && (
                  <Link to={`/project-details/${selectedUpdate.project.id}`}>
                    <Button className="w-full">
                      <Building className="h-4 w-4 mr-2" />
                      View Full Project Details
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
