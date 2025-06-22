import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Edit3,
  Trash2,
  Download,
  Eye,
  Calendar,
  User,
  Tag,
  Image as ImageIcon,
  Camera,
  MapPin,
  Clock,
  FileImage,
  X,
  Loader2,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminImage {
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
  projectId?: number;
  uploadedById: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminImageGalleryViewProps {
  searchQuery: string;
  categoryFilter: string;
  refreshTrigger: number;
}

export function AdminImageGalleryView({ 
  searchQuery, 
  categoryFilter, 
  refreshTrigger 
}: AdminImageGalleryViewProps) {
  const [selectedImage, setSelectedImage] = useState<AdminImage | null>(null);
  const [editingImage, setEditingImage] = useState<AdminImage | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '12',
    ...(searchQuery && { search: searchQuery }),
    ...(categoryFilter !== 'all' && { category: categoryFilter }),
  });

  // Fetch images
  const { data: imagesResponse, isLoading, error } = useQuery({
    queryKey: ['/api/admin/images', queryParams.toString(), refreshTrigger],
    queryFn: () => fetch(`/api/admin/images?${queryParams}`, {
      credentials: 'include'
    }).then(res => res.json()),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (imageId: number) => 
      fetch(`/api/admin/images/${imageId}`, { 
        method: 'DELETE',
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: 'Image Deleted',
        description: 'Image has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/images'] });
      setSelectedImage(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AdminImage> }) =>
      apiRequest(`/api/admin/images/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      toast({
        title: 'Image Updated',
        description: 'Image has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/images'] });
      setEditingImage(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const updatedData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      tags: (formData.get('tags') as string).split(',').map(tag => tag.trim()).filter(Boolean),
    };

    updateMutation.mutate({ id: editingImage.id, data: updatedData });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
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
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">No Images Found</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || categoryFilter !== 'all' 
              ? 'No images match your current filters.' 
              : 'Upload your first images to get started.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image: AdminImage) => (
          <Card key={image.id} className="group overflow-hidden">
            <div className="relative aspect-square">
              <img
                src={image.imageUrl}
                alt={image.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
              
              {/* Action Buttons */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedImage(image)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditingImage(image)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(image.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Category Badge */}
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="text-xs">
                  {image.category}
                </Badge>
              </div>
            </div>

            <CardContent className="p-3">
              <h3 className="font-medium text-sm truncate mb-1">{image.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Camera className="h-3 w-3" />
                {image.width && image.height && (
                  <span>{image.width}×{image.height}</span>
                )}
                <span>{formatFileSize(image.fileSize)}</span>
              </div>
              
              {/* Tags */}
              {image.tags && image.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {image.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs px-1">
                      {tag}
                    </Badge>
                  ))}
                  {image.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-1">
                      +{image.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
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
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedImage.description || 'No description provided'}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Details</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        {formatFileSize(selectedImage.fileSize)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        {selectedImage.width}×{selectedImage.height}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(selectedImage.createdAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        User {selectedImage.uploadedById}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Category</Label>
                    <Badge variant="secondary" className="mt-1">
                      {selectedImage.category}
                    </Badge>
                  </div>

                  {selectedImage.tags && selectedImage.tags.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedImage.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedImage.metadata && (
                    <div>
                      <Label className="text-sm font-medium">Metadata</Label>
                      <div className="mt-2 p-3 bg-muted rounded text-xs">
                        <pre>{JSON.stringify(selectedImage.metadata, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
        <DialogContent>
          {editingImage && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Image</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    name="title"
                    defaultValue={editingImage.title}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={editingImage.description || ''}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Select name="category" defaultValue={editingImage.category}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="progress">Progress Photos</SelectItem>
                      <SelectItem value="materials">Materials</SelectItem>
                      <SelectItem value="before_after">Before/After</SelectItem>
                      <SelectItem value="issues">Issues/Problems</SelectItem>
                      <SelectItem value="completed">Completed Work</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                  <Input
                    id="edit-tags"
                    name="tags"
                    defaultValue={editingImage.tags?.join(', ') || ''}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingImage(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}