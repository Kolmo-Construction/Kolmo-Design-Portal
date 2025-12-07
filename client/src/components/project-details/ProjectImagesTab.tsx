import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Images as ImagesIcon,
  Loader2,
  MapPin,
  Camera,
  Calendar,
  FileImage,
  Download,
  Maximize2,
} from 'lucide-react';

interface ProjectImage {
  id: number;
  title: string;
  description?: string;
  imageUrl: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  metadata?: any;
  tags: string[];
  category: string;
  createdAt: string;
}

interface ProjectImagesTabProps {
  projectId: number;
}

export function ProjectImagesTab({ projectId }: ProjectImagesTabProps) {
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [page, setPage] = useState(1);
  const limit = 12;

  // Fetch images for this project
  const { data: imagesResponse, isLoading, error } = useQuery({
    queryKey: ['/api/admin/images', projectId, page],
    queryFn: () =>
      fetch(`/api/admin/images?projectId=${projectId}&page=${page}&limit=${limit}`, {
        credentials: 'include',
      }).then((res) => res.json()),
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasGPS = (metadata: any) => {
    return metadata?.gps?.latitude && metadata?.gps?.longitude;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-kolmo-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Images</h3>
          <p className="text-sm text-muted-foreground">
            Failed to load images. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const images = imagesResponse?.images || [];

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <ImagesIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">No Images Found</h3>
          <p className="text-sm text-muted-foreground">
            No images have been uploaded or matched to this project yet.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Images from Google Drive with GPS coordinates near this project location will
            automatically appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Images</h3>
          <p className="text-sm text-muted-foreground">
            {images.length} image{images.length !== 1 ? 's' : ''} for this project
          </p>
        </div>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image: ProjectImage) => (
          <Card
            key={image.id}
            className="group overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedImage(image)}
          >
            <div className="relative aspect-square">
              <img
                src={image.imageUrl}
                alt={image.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

              {/* GPS Badge */}
              {hasGPS(image.metadata) && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    GPS
                  </Badge>
                </div>
              )}

              {/* Category Badge */}
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="text-xs">
                  {image.category}
                </Badge>
              </div>

              {/* View icon */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="h-8 w-8 text-white drop-shadow-lg" />
              </div>
            </div>

            <CardContent className="p-3">
              <h4 className="font-medium text-sm truncate mb-1">{image.title}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Camera className="h-3 w-3" />
                <span>{formatFileSize(image.fileSize)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {imagesResponse?.pagination && imagesResponse.pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} of {imagesResponse.pagination.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={page === imagesResponse.pagination.pages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedImage.title}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <img
                    src={selectedImage.imageUrl}
                    alt={selectedImage.title}
                    className="w-full rounded-lg"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(selectedImage.imageUrl, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Original
                  </Button>
                </div>
                <div className="space-y-4">
                  {selectedImage.description && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedImage.description}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium mb-2">Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        {formatFileSize(selectedImage.fileSize)}
                      </div>
                      {selectedImage.width && selectedImage.height && (
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          {selectedImage.width}×{selectedImage.height}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(selectedImage.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* GPS Information */}
                  {hasGPS(selectedImage.metadata) && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Location</h4>
                      <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                        <MapPin className="h-4 w-4 mt-0.5 text-blue-500" />
                        <div className="flex-1 text-sm">
                          <p className="font-mono text-xs">
                            {selectedImage.metadata.gps.latitude.toFixed(6)},{' '}
                            {selectedImage.metadata.gps.longitude.toFixed(6)}
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${selectedImage.metadata.gps.latitude},${selectedImage.metadata.gps.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline text-xs"
                          >
                            View on Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Device Information */}
                  {selectedImage.metadata?.device && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Device</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedImage.metadata.device}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium mb-1">Category</h4>
                    <Badge variant="secondary">{selectedImage.category}</Badge>
                  </div>

                  {selectedImage.tags && selectedImage.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedImage.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Information */}
                  {selectedImage.metadata?.source === 'google-drive' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800">
                        <strong>Auto-imported from Google Drive</strong>
                        <br />
                        This image was automatically matched to this project based on GPS
                        location.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
