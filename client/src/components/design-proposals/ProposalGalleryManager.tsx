import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, X, Image as ImageIcon, MessageSquare, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProposalGalleryImageWithDetails } from "@shared/schema";

interface ProposalGalleryManagerProps {
  proposalId: number;
}

export function ProposalGalleryManager({ proposalId }: ProposalGalleryManagerProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");

  const { data: galleryImages, isLoading } = useQuery<ProposalGalleryImageWithDetails[]>({
    queryKey: [`/api/design-proposals/${proposalId}/gallery`],
  });

  const uploadImageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("proposalId", proposalId.toString());
      formData.append("caption", caption);
      formData.append("description", description);

      // Upload using fetch since we need to send FormData
      const response = await fetch("/api/design-proposals/gallery", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/design-proposals/${proposalId}/gallery`] });
      setSelectedFile(null);
      setCaption("");
      setDescription("");
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: number) => {
      return await apiRequest("DELETE", `/api/design-proposals/gallery/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/design-proposals/${proposalId}/gallery`] });
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select an image",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      await uploadImageMutation.mutateAsync();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (confirm("Are you sure you want to delete this image?")) {
      await deleteImageMutation.mutateAsync(imageId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Upload Images</h3>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-sm">{selectedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 10MB
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {selectedFile && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Caption (optional)
                  </label>
                  <Input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption for this image"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Description (optional)
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a detailed description"
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gallery Grid */}
      <div>
        <h3 className="font-semibold mb-4">Gallery Images ({galleryImages?.length || 0})</h3>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : galleryImages && galleryImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleryImages.map((image) => (
              <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={image.imageUrl}
                    alt={image.caption || "Gallery image"}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleDelete(image.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardContent className="p-3">
                  {image.caption && (
                    <p className="font-medium text-sm mb-1">{image.caption}</p>
                  )}
                  {image.description && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {image.description}
                    </p>
                  )}
                  <div className="flex gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{image.commentCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      <span>{image.favoriteCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">No images uploaded yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Upload images from site visits to share with your customer
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
