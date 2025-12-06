import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Cloud,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  MapPin,
  Camera,
  Calendar,
  HardDrive,
  Database
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface DriveIngestionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onIngestComplete?: () => void;
}

interface DriveStatus {
  totalImages: number;
  imagesWithGPS: number;
  imagesWithDevice: number;
  lastProcessedAt: string | null;
  serviceAccount: string;
}

interface IngestionResult {
  count: number;
  duration: number;
  images: Array<{
    fileId: string;
    name: string;
    size: number;
    hasGPS: boolean;
    latitude?: number;
    longitude?: number;
    captureDate?: string;
    device?: string;
    r2Url: string;
  }>;
}

export function DriveIngestionDialog({
  isOpen,
  onOpenChange,
  onIngestComplete
}: DriveIngestionDialogProps) {
  const { toast } = useToast();
  const [results, setResults] = useState<IngestionResult | null>(null);

  // Fetch current status
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<DriveStatus>({
    queryKey: ['/api/drive-ingestion/status'],
    enabled: isOpen,
  });

  // Trigger ingestion mutation
  const ingestionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest<{ data: IngestionResult }>('POST', '/api/drive-ingestion/trigger');
      return response.data;
    },
    onSuccess: (data) => {
      setResults(data);
      refetchStatus();
      onIngestComplete?.();

      toast({
        title: 'Ingestion Complete!',
        description: `Successfully ingested ${data.count} new image(s) in ${(data.duration / 1000).toFixed(1)}s`,
      });
    },
    onError: (error: Error) => {
      console.error('Ingestion error:', error);
      toast({
        title: 'Ingestion Failed',
        description: error.message || 'Failed to ingest images from Google Drive',
        variant: 'destructive',
      });
    },
  });

  const handleIngest = () => {
    setResults(null);
    ingestionMutation.mutate();
  };

  const handleClose = () => {
    setResults(null);
    ingestionMutation.reset();
    onOpenChange(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Google Drive Image Ingestion
          </DialogTitle>
          <DialogDescription>
            Import images from Google Drive with EXIF metadata and GPS coordinates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Section */}
          {statusLoading ? (
            <Card>
              <CardContent className="p-6 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : status ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Current Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-lg font-bold">{status.totalImages}</p>
                      <p className="text-xs text-muted-foreground">Total Images</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-lg font-bold">{status.imagesWithGPS}</p>
                      <p className="text-xs text-muted-foreground">With GPS</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-lg font-bold">{status.imagesWithDevice}</p>
                      <p className="text-xs text-muted-foreground">With Device Info</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-xs font-semibold">Last Processed</p>
                      <p className="text-xs text-muted-foreground">{formatDate(status.lastProcessedAt)}</p>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Service Account: <span className="font-mono text-xs">{status.serviceAccount}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Ingestion Button */}
          {!results && !ingestionMutation.isPending && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Download className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="font-semibold mb-2">Import New Images</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This will fetch new images from Google Drive, extract EXIF metadata including GPS coordinates,
                      upload to R2 storage, and save to the database.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Already processed images will be skipped automatically.
                    </p>
                  </div>
                  <Button
                    onClick={handleIngest}
                    disabled={ingestionMutation.isPending}
                    size="lg"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Start Ingestion
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {ingestionMutation.isPending && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                  <div>
                    <h3 className="font-semibold mb-2">Processing Images...</h3>
                    <p className="text-sm text-muted-foreground">
                      Downloading from Google Drive, parsing EXIF data, and uploading to R2
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  {results.count > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-orange-500" />
                  )}
                  <h3 className="font-semibold">
                    {results.count > 0
                      ? `Successfully Ingested ${results.count} Image${results.count !== 1 ? 's' : ''}`
                      : 'No New Images Found'
                    }
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Duration: {(results.duration / 1000).toFixed(1)}s</span>
                  {results.count > 0 && (
                    <Badge variant="outline">
                      {results.images.filter(img => img.hasGPS).length} with GPS
                    </Badge>
                  )}
                </div>

                {results.images.length > 0 && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    <h4 className="text-sm font-semibold">Imported Images:</h4>
                    {results.images.map((img, idx) => (
                      <div key={img.fileId} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{img.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {(img.size / (1024 * 1024)).toFixed(2)} MB
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {img.hasGPS && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>GPS: {img.latitude?.toFixed(6)}, {img.longitude?.toFixed(6)}</span>
                            </div>
                          )}
                          {img.device && (
                            <div className="flex items-center gap-1">
                              <Camera className="h-3 w-3" />
                              <span>{img.device}</span>
                            </div>
                          )}
                          {img.captureDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(img.captureDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {results.count === 0 && (
                  <p className="text-sm text-muted-foreground">
                    All images from Google Drive have already been processed.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          {results ? (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          ) : (
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={ingestionMutation.isPending}
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
