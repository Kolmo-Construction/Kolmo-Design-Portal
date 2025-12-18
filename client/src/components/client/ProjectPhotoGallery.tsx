import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Camera,
  Calendar,
  Building,
  Tag,
  Loader2,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectImage {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  image_url: string;
  tags: string[];
  category: string;
  created_at: string;
  project_name: string;
  uploaded_by_name: string;
}

export function ProjectPhotoGallery() {
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Fetch project images
  const { data, isLoading, isError } = useQuery<{ images: ProjectImage[] }>({
    queryKey: ['/api/client/project-images'],
    queryFn: async () => {
      const res = await fetch('/api/client/project-images', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch images');
      return res.json();
    },
  });

  const images = data?.images || [];

  const handleImageClick = (image: ProjectImage, index: number) => {
    setSelectedImage(image);
    setSelectedIndex(index);
  };

  const handlePrevious = () => {
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : images.length - 1;
    setSelectedIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const handleNext = () => {
    const newIndex = selectedIndex < images.length - 1 ? selectedIndex + 1 : 0;
    setSelectedIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      progress: 'bg-blue-100 text-blue-700 border-blue-200',
      before: 'bg-purple-100 text-purple-700 border-purple-200',
      after: 'bg-green-100 text-green-700 border-green-200',
      issue: 'bg-red-100 text-red-700 border-red-200',
      general: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[category] || colors.general;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Project Photos
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Loading photos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Project Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <ImageIcon className="h-12 w-12 text-destructive mx-auto mb-3 opacity-50" />
            <p className="text-sm text-destructive">
              Unable to load photos. Please refresh the page.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Project Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No project photos yet. Photos will appear here as work progresses.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Project Photos
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {images.length} {images.length === 1 ? 'photo' : 'photos'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Photo Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                onClick={() => handleImageClick(image, index)}
                className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer border border-border hover:border-primary transition-all hover:shadow-lg"
              >
                {/* Image */}
                <img
                  src={image.image_url}
                  alt={image.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-medium truncate">
                      {image.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        className={`text-xs ${getCategoryColor(image.category)}`}
                      >
                        {image.category}
                      </Badge>
                      {image.tags && image.tags.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {image.tags[0]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Category Badge (Always Visible) */}
                <div className="absolute top-2 right-2">
                  <Badge
                    className={`text-xs shadow-md ${getCategoryColor(image.category)}`}
                  >
                    {image.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          {selectedImage && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Navigation Buttons */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              {/* Image */}
              <div className="bg-black">
                <img
                  src={selectedImage.image_url}
                  alt={selectedImage.title}
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>

              {/* Image Info */}
              <div className="bg-background p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {selectedImage.title}
                    </h3>
                    {selectedImage.description && (
                      <p className="text-muted-foreground text-sm mb-3">
                        {selectedImage.description}
                      </p>
                    )}
                  </div>
                  <Badge className={getCategoryColor(selectedImage.category)}>
                    {selectedImage.category}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span>{selectedImage.project_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(selectedImage.created_at)}</span>
                  </div>
                  {selectedImage.uploaded_by_name && (
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      <span>By {selectedImage.uploaded_by_name}</span>
                    </div>
                  )}
                </div>

                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {selectedImage.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Image Counter */}
                {images.length > 1 && (
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    Photo {selectedIndex + 1} of {images.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
