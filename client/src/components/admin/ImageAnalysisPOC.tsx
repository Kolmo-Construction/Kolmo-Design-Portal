import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AnalysisResult {
  executiveSummary: string;
  keyObservations: string[];
  progressEstimate: Record<string, number>;
  concernsOrIssues: string[];
  recommendedActions: string[];
  confidence: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

interface AnalysisResponse {
  success: boolean;
  analysis: AnalysisResult;
  estimatedCost: {
    inputCost: number;
    outputCost: number;
    total: number;
  };
  metadata: {
    projectId: number;
    imagesAnalyzed: number;
    timestamp: string;
  };
}

export function ImageAnalysisPOC() {
  const [projectId, setProjectId] = useState('7');
  const [previousReport, setPreviousReport] = useState('');
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);

  // Fetch images for the project
  const { data: imagesResponse, isLoading: loadingImages } = useQuery({
    queryKey: ['/api/admin/images', projectId],
    queryFn: () =>
      fetch(`/api/admin/images?projectId=${projectId}&limit=50`, {
        credentials: 'include',
      }).then((res) => res.json()),
    enabled: !!projectId,
  });

  // Analyze images mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/updates/analyze-images-poc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageIds: selectedImageIds,
          previousReportSummary: previousReport || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze images');
      }

      return response.json() as Promise<AnalysisResponse>;
    },
  });

  const images = imagesResponse?.images || [];

  const toggleImageSelection = (imageId: number) => {
    setSelectedImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImageIds(images.map((img: any) => img.id));
  };

  const clearSelection = () => {
    setSelectedImageIds([]);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-kolmo-accent" />
            LLM Image Analysis POC (Phase 0)
          </CardTitle>
          <CardDescription>
            Test the AI-powered construction progress analysis with real project images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Project ID</label>
            <input
              type="number"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Enter project ID"
            />
          </div>

          {/* Previous Report Context */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Previous Report Summary (Optional)
            </label>
            <Textarea
              value={previousReport}
              onChange={(e) => setPreviousReport(e.target.value)}
              placeholder="Paste previous report summary here for comparative analysis..."
              rows={4}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty for first-time analysis. Include previous summary for progress comparison.
            </p>
          </div>

          {/* Image Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">
                Select Images ({selectedImageIds.length} selected)
              </label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllImages}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>

            {loadingImages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No images found for project {projectId}. Try a different project ID.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map((image: any) => (
                  <div
                    key={image.id}
                    onClick={() => toggleImageSelection(image.id)}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                      selectedImageIds.includes(image.id)
                        ? 'border-kolmo-accent ring-2 ring-kolmo-accent ring-offset-2'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.title}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    {selectedImageIds.includes(image.id) && (
                      <div className="absolute top-2 right-2 bg-kolmo-accent text-white rounded-full p-1">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg">
                      {image.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={selectedImageIds.length === 0 || analyzeMutation.isPending}
            className="w-full"
            size="lg"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analyzing Images...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 mr-2" />
                Analyze {selectedImageIds.length} Image{selectedImageIds.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>

          {/* Error Display */}
          {analyzeMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {analyzeMutation.error instanceof Error
                  ? analyzeMutation.error.message
                  : 'Failed to analyze images'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {analyzeMutation.isSuccess && analyzeMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Analysis Results</span>
              <Badge variant="secondary" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${analyzeMutation.data.estimatedCost.total.toFixed(3)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Analyzed {analyzeMutation.data.metadata.imagesAnalyzed} images •{' '}
              {new Date(analyzeMutation.data.metadata.timestamp).toLocaleString()} •{' '}
              Confidence: {(analyzeMutation.data.analysis.confidence * 100).toFixed(0)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Executive Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Executive Summary</h3>
              <p className="text-muted-foreground">
                {analyzeMutation.data.analysis.executiveSummary}
              </p>
            </div>

            {/* Key Observations */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Key Observations</h3>
              <ul className="list-disc list-inside space-y-1">
                {analyzeMutation.data.analysis.keyObservations.map((obs, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {obs}
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress Estimate */}
            {Object.keys(analyzeMutation.data.analysis.progressEstimate).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Progress Estimate</h3>
                <div className="space-y-2">
                  {Object.entries(analyzeMutation.data.analysis.progressEstimate).map(
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

            {/* Concerns */}
            {analyzeMutation.data.analysis.concernsOrIssues.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Concerns or Issues</h3>
                <ul className="list-disc list-inside space-y-1">
                  {analyzeMutation.data.analysis.concernsOrIssues.map((concern, idx) => (
                    <li key={idx} className="text-orange-600">
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Actions */}
            {analyzeMutation.data.analysis.recommendedActions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Recommended Actions</h3>
                <ul className="list-disc list-inside space-y-1">
                  {analyzeMutation.data.analysis.recommendedActions.map((action, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Token Usage */}
            {analyzeMutation.data.analysis.tokensUsed && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Token Usage</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Input</p>
                    <p className="font-mono">
                      {analyzeMutation.data.analysis.tokensUsed.input.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Output</p>
                    <p className="font-mono">
                      {analyzeMutation.data.analysis.tokensUsed.output.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Cost</p>
                    <p className="font-mono text-green-600">
                      ${analyzeMutation.data.estimatedCost.total.toFixed(3)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
