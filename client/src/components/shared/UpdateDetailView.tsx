import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  Building,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'wouter';

interface UpdateDetailViewProps {
  update: {
    id: number;
    title: string;
    description: string;
    createdAt: string;
    generatedByAI: boolean;
    status?: string;
    visibility?: string;
    projectName?: string;
    projectId?: number;
    rawLLMResponse?: {
      progressEstimate?: Record<string, number>;
    };
  };
  images?: Array<{
    id: number;
    image_url: string;
    title: string;
    category: string;
  }>;
  showProjectLink?: boolean;
  showStatusWarning?: boolean;
  formatDate?: (date: string) => string;
}

const defaultFormatDate = (dateString: string) => {
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

export function UpdateDetailView({
  update,
  images = [],
  showProjectLink = true,
  showStatusWarning = false,
  formatDate = defaultFormatDate,
}: UpdateDetailViewProps) {
  return (
    <div className="space-y-4">
      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {update.generatedByAI && (
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            <Brain className="h-4 w-4 mr-1" />
            AI-Generated Report
          </Badge>
        )}
        {update.projectName && (
          <Badge variant="outline">
            <Building className="h-4 w-4 mr-1" />
            {update.projectName}
          </Badge>
        )}
      </div>

      {/* Title and Date */}
      <div>
        <h3 className="text-xl font-semibold mb-2">{update.title}</h3>
        <p className="text-sm text-muted-foreground">
          {formatDate(update.createdAt)}
        </p>
      </div>

      {/* Status Warning for Admin Preview */}
      {showStatusWarning && update.visibility !== 'published' && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-900">
            <strong>Not visible to client.</strong> This content is currently in{' '}
            <Badge variant="outline" className="mx-1">
              {update.status}
            </Badge>{' '}
            status. Client will only see this after you approve and publish it.
          </AlertDescription>
        </Alert>
      )}

      {/* Description */}
      <div>
        <h4 className="font-semibold mb-2">Update Details</h4>
        <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
          {update.description}
        </div>
      </div>

      {/* Progress Breakdown */}
      {update.generatedByAI &&
        update.rawLLMResponse?.progressEstimate &&
        Object.keys(update.rawLLMResponse.progressEstimate).length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Progress Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(update.rawLLMResponse.progressEstimate).map(
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

      {/* Related Images */}
      {images.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Related Photos ({images.length})
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {images.slice(0, 6).map((image) => (
              <div
                key={image.id}
                className="aspect-square rounded-lg overflow-hidden border border-border"
              >
                <img
                  src={image.image_url}
                  alt={image.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {images.length > 6 && (
            <p className="text-xs text-muted-foreground mt-2">
              + {images.length - 6} more photos
            </p>
          )}
        </div>
      )}

      {/* Project Link */}
      {showProjectLink && update.projectId && (
        <Link to={`/project-details/${update.projectId}`}>
          <Button className="w-full">
            <Building className="h-4 w-4 mr-2" />
            View Full Project Details
          </Button>
        </Link>
      )}
    </div>
  );
}
