import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Receipt,
  Flag,
  ListChecks,
  NotebookText,
  Target,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UnifiedContentItem {
  id: number;
  type: 'progress_update' | 'task' | 'invoice' | 'document' | 'milestone' | 'daily_log' | 'punch_list' | 'image';
  title: string;
  description?: string;
  status?: string;
  visibility?: 'admin_only' | 'published';
  createdAt: string;
  projectId: number;
  metadata?: Record<string, any>;
}

interface UnifiedContentReviewTabProps {
  projectId: number;
}

// Content type metadata
const CONTENT_TYPE_CONFIG = {
  progress_update: {
    label: 'Progress Update',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/projects/${projectId}/updates/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/projects/${projectId}/updates/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/projects/${projectId}/updates/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/projects/${projectId}/updates/${id}/unpublish`,
    },
  },
  invoice: {
    label: 'Invoice',
    icon: Receipt,
    color: 'bg-green-100 text-green-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/invoices/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/invoices/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/invoices/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/invoices/${id}/unpublish`,
    },
  },
  document: {
    label: 'Document',
    icon: FileText,
    color: 'bg-purple-100 text-purple-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/documents/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/documents/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/documents/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/documents/${id}/unpublish`,
    },
  },
  milestone: {
    label: 'Milestone',
    icon: Flag,
    color: 'bg-yellow-100 text-yellow-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/projects/${projectId}/milestones/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/projects/${projectId}/milestones/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/projects/${projectId}/milestones/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/projects/${projectId}/milestones/${id}/unpublish`,
    },
  },
  daily_log: {
    label: 'Daily Log',
    icon: NotebookText,
    color: 'bg-indigo-100 text-indigo-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/daily-logs/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/daily-logs/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/daily-logs/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/daily-logs/${id}/unpublish`,
    },
  },
  punch_list: {
    label: 'Punch List',
    icon: Target,
    color: 'bg-red-100 text-red-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/punch-list/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/punch-list/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/punch-list/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/punch-list/${id}/unpublish`,
    },
  },
  image: {
    label: 'Image',
    icon: ImageIcon,
    color: 'bg-pink-100 text-pink-800',
    endpoints: {
      approve: (projectId: number, id: number) => `/api/admin-images/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/admin-images/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/admin-images/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/admin-images/${id}/unpublish`,
    },
  },
  task: {
    label: 'Task',
    icon: ListChecks,
    color: 'bg-teal-100 text-teal-800',
    endpoints: {
      // Tasks might not have approval endpoints yet - handle gracefully
      approve: (projectId: number, id: number) => `/api/tasks/${id}/approve`,
      reject: (projectId: number, id: number) => `/api/tasks/${id}/reject`,
      publish: (projectId: number, id: number) => `/api/tasks/${id}/publish`,
      unpublish: (projectId: number, id: number) => `/api/tasks/${id}/unpublish`,
    },
  },
};

export function UnifiedContentReviewTab({ projectId }: UnifiedContentReviewTabProps) {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Fetch unified content
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/projects/${projectId}/unified-content`, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.append('contentType', activeFilter);
      }

      const response = await fetch(
        `/api/projects/${projectId}/unified-content?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      return response.json();
    },
  });

  // Generic approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ item, publish }: { item: UnifiedContentItem; publish: boolean }) => {
      const config = CONTENT_TYPE_CONFIG[item.type];
      const url = config.endpoints.approve(projectId, item.id);

      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ publish }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve content');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/unified-content`] });
    },
  });

  // Generic publish/unpublish mutation
  const togglePublishMutation = useMutation({
    mutationFn: async ({ item, action }: { item: UnifiedContentItem; action: 'publish' | 'unpublish' }) => {
      const config = CONTENT_TYPE_CONFIG[item.type];
      const url = action === 'publish'
        ? config.endpoints.publish(projectId, item.id)
        : config.endpoints.unpublish(projectId, item.id);

      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} content`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/unified-content`] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-kolmo-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load content. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const contentItems = data?.content || [];
  const counts = data?.contentTypeCounts || {};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-kolmo-primary">Review & Publish Content</h2>
          <p className="text-kolmo-secondary">Manage content visibility for clients</p>
        </div>
        <div className="text-sm text-kolmo-secondary">
          Total: {data?.totalCount || 0} items
        </div>
      </div>

      {/* Content Type Filters */}
      <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full">
        <TabsList className="grid grid-cols-4 lg:grid-cols-9 w-full">
          <TabsTrigger value="all">All ({data?.totalCount || 0})</TabsTrigger>
          <TabsTrigger value="progress_update">Updates ({counts.progress_update || 0})</TabsTrigger>
          <TabsTrigger value="image">Images ({counts.image || 0})</TabsTrigger>
          <TabsTrigger value="invoice">Invoices ({counts.invoice || 0})</TabsTrigger>
          <TabsTrigger value="document">Docs ({counts.document || 0})</TabsTrigger>
          <TabsTrigger value="milestone">Milestones ({counts.milestone || 0})</TabsTrigger>
          <TabsTrigger value="daily_log">Logs ({counts.daily_log || 0})</TabsTrigger>
          <TabsTrigger value="punch_list">Punch List ({counts.punch_list || 0})</TabsTrigger>
          <TabsTrigger value="task">Tasks ({counts.task || 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content List */}
      <div className="space-y-4">
        {contentItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-kolmo-secondary">
              No content found
            </CardContent>
          </Card>
        ) : (
          contentItems.map((item: UnifiedContentItem) => {
            const config = CONTENT_TYPE_CONFIG[item.type];
            const Icon = config.icon;
            const isPublished = item.visibility === 'published';

            return (
              <Card key={`${item.type}-${item.id}`} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="h-5 w-5 text-kolmo-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{item.title}</CardTitle>
                        {item.description && (
                          <p className="text-sm text-kolmo-secondary line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <Badge className={config.color}>{config.label}</Badge>
                      {item.status && (
                        <Badge variant="outline">{item.status}</Badge>
                      )}
                      {isPublished ? (
                        <Badge className="bg-green-100 text-green-800 gap-1">
                          <Eye className="h-3 w-3" />
                          Published
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 gap-1">
                          <EyeOff className="h-3 w-3" />
                          Admin Only
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-kolmo-secondary">
                      Created: {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      {item.status !== 'approved' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => approveMutation.mutate({ item, publish: false })}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            className="gap-2 bg-kolmo-accent hover:bg-kolmo-accent/90"
                            onClick={() => approveMutation.mutate({ item, publish: true })}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve & Publish
                          </Button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <Button
                          size="sm"
                          variant={isPublished ? 'outline' : 'default'}
                          className={isPublished ? 'gap-2' : 'gap-2 bg-kolmo-accent hover:bg-kolmo-accent/90'}
                          onClick={() => togglePublishMutation.mutate({
                            item,
                            action: isPublished ? 'unpublish' : 'publish'
                          })}
                          disabled={togglePublishMutation.isPending}
                        >
                          {isPublished ? (
                            <>
                              <EyeOff className="h-4 w-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" />
                              Publish
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
