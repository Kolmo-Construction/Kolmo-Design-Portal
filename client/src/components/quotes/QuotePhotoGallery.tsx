import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Edit3, Camera, Image as ImageIcon, Trash2, Plus, Save, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuoteMedia {
  id: number;
  quoteId: number;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  category: string;
  sortOrder: number;
  uploadedById: number;
  createdAt: string;
}

interface QuotePhotoGalleryProps {
  quoteId: number;
  onPhotosUpdated?: () => void;
}

export function QuotePhotoGallery({ quoteId, onPhotosUpdated }: QuotePhotoGalleryProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [editingPhoto, setEditingPhoto] = useState<QuoteMedia | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoCategory, setPhotoCategory] = useState("gallery");

  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quote media
  const { data: photos = [], isLoading } = useQuery<QuoteMedia[]>({
    queryKey: [`/api/quotes/${quoteId}/media`],
    enabled: !!quoteId,
  });

  // Upload photo mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, caption, category }: { file: File; caption: string; category: string }) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', caption);
      formData.append('category', category);
      
      const response = await fetch(`/api/quotes/${quoteId}/photos`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload photo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/media`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setPhotoCaption("");
      setPhotoCategory("gallery");
      setPreviewUrl("");
      onPhotosUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  // Update photo mutation
  const updatePhotoMutation = useMutation({
    mutationFn: async ({ mediaId, caption, category }: { mediaId: number; caption: string; category: string }) => {
      const response = await fetch(`/api/quotes/media/${mediaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption,
          category,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update photo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Photo updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/media`] });
      setShowEditDialog(false);
      setEditingPhoto(null);
      onPhotosUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update photo",
        variant: "destructive",
      });
    },
  });

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async (mediaId: number) => {
      const response = await fetch(`/api/quotes/media/${mediaId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }
      
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/media`] });
      onPhotosUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setPhotoCaption("");
      setPhotoCategory("gallery");
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setShowUploadDialog(true);
    }
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadPhotoMutation.mutate({
        file: uploadFile,
        caption: photoCaption,
        category: photoCategory,
      });
    }
  };

  const handleEditPhoto = (photo: QuoteMedia) => {
    setEditingPhoto(photo);
    setPhotoCaption(photo.caption || "");
    setPhotoCategory(photo.category || "gallery");
    setShowEditDialog(true);
  };

  const handleUpdatePhoto = () => {
    if (editingPhoto) {
      updatePhotoMutation.mutate({
        mediaId: editingPhoto.id,
        caption: photoCaption,
        category: photoCategory,
      });
    }
  };

  const handleDeletePhoto = (mediaId: number) => {
    if (confirm("Are you sure you want to delete this photo?")) {
      deletePhotoMutation.mutate(mediaId);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'before': return 'Before';
      case 'after': return 'After';
      case 'reference': return 'Reference';
      case 'scope': return 'Scope';
      case 'gallery': return 'Gallery';
      default: return 'Other';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'before': return 'bg-red-100 text-red-800';
      case 'after': return 'bg-green-100 text-green-800';
      case 'reference': return 'bg-blue-100 text-blue-800';
      case 'scope': return 'bg-purple-100 text-purple-800';
      case 'gallery': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" style={{ color: '#db973c' }} />
            Photo Gallery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">Loading photos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" style={{ color: '#db973c' }} />
            Photo Gallery
          </CardTitle>
          <CardDescription>
            Upload and manage photos for this quote with custom captions and categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="flex items-center justify-center">
            <Button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2"
              style={{ backgroundColor: '#db973c' }}
            >
              <Plus className="h-4 w-4" />
              Add Photos
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple={false}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Photos Grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div className="relative overflow-hidden rounded-lg border">
                    <img
                      src={photo.mediaUrl}
                      alt={photo.caption || "Quote photo"}
                      className="w-full h-48 object-cover"
                    />
                    
                    {/* Category Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(photo.category)}`}>
                        {getCategoryLabel(photo.category)}
                      </span>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditPhoto(photo)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePhoto(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Caption */}
                  {photo.caption && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <p className="text-gray-700">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">No photos uploaded yet</p>
              <p className="text-sm text-gray-500">Click "Add Photos" to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
            <DialogDescription>
              Add a caption and category for this photo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {previewUrl && (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="photo-category">Category</Label>
              <Select value={photoCategory} onValueChange={setPhotoCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gallery">Gallery</SelectItem>
                  <SelectItem value="before">Before</SelectItem>
                  <SelectItem value="after">After</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="scope">Scope</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo-caption">Caption/Slogan</Label>
              <Textarea
                id="photo-caption"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Add a descriptive caption or slogan for this photo..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                setUploadFile(null);
                setPreviewUrl("");
                setPhotoCaption("");
                setPhotoCategory("gallery");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadPhotoMutation.isPending}
              style={{ backgroundColor: '#db973c' }}
              className="text-white hover:opacity-90"
            >
              {uploadPhotoMutation.isPending ? "Uploading..." : "Upload Photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Photo</DialogTitle>
            <DialogDescription>
              Update the caption and category for this photo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingPhoto && (
              <div className="relative">
                <img
                  src={editingPhoto.mediaUrl}
                  alt="Edit photo"
                  className="w-full h-48 object-cover rounded-lg border"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="edit-photo-category">Category</Label>
              <Select value={photoCategory} onValueChange={setPhotoCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gallery">Gallery</SelectItem>
                  <SelectItem value="before">Before</SelectItem>
                  <SelectItem value="after">After</SelectItem>
                  <SelectItem value="reference">Reference</SelectItem>
                  <SelectItem value="scope">Scope</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-photo-caption">Caption/Slogan</Label>
              <Textarea
                id="edit-photo-caption"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Add a descriptive caption or slogan for this photo..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setEditingPhoto(null);
                setPhotoCaption("");
                setPhotoCategory("gallery");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePhoto}
              disabled={updatePhotoMutation.isPending}
              style={{ backgroundColor: '#db973c' }}
              className="text-white hover:opacity-90"
            >
              <Save className="h-4 w-4 mr-2" />
              {updatePhotoMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}