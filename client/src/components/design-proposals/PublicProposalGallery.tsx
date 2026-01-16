import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload,
  MessageSquare,
  Star,
  Send,
  Heart,
  User,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProposalGalleryImageWithDetails, ProposalImageComment } from "@shared/schema";

interface PublicProposalGalleryProps {
  proposalId: number;
}

export function PublicProposalGallery({ proposalId }: PublicProposalGalleryProps) {
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<ProposalGalleryImageWithDetails | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");

  // Comment form state
  const [commentText, setCommentText] = useState("");
  const [commenterName, setCommenterName] = useState("");
  const [commenterEmail, setCommenterEmail] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const { data: galleryImages, isLoading } = useQuery<ProposalGalleryImageWithDetails[]>({
    queryKey: [`/api/design-proposals/${proposalId}/gallery`],
  });

  const uploadImageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      // Mock image URL for now
      const mockImageUrl = URL.createObjectURL(selectedFile);
      const mockImageKey = `gallery/${Date.now()}-${selectedFile.name}`;

      return await apiRequest("POST", "/api/design-proposals/gallery", {
        proposalId,
        imageUrl: mockImageUrl,
        imageKey: mockImageKey,
        caption: uploadCaption,
        description: uploadDescription,
        uploaderName: uploaderName || undefined,
        uploaderEmail: uploaderEmail || undefined,
        originalFilename: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        orderIndex: (galleryImages?.length || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/design-proposals/${proposalId}/gallery`] });
      setSelectedFile(null);
      setUploadCaption("");
      setUploadDescription("");
      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (data: {
      imageId: number;
      comment: string;
      parentCommentId?: number;
      commenterName?: string;
      commenterEmail?: string;
    }) => {
      return await apiRequest("POST", "/api/design-proposals/gallery/comments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/design-proposals/${proposalId}/gallery`] });
      setCommentText("");
      setReplyingTo(null);
      toast({
        title: "Success",
        description: "Comment posted successfully!",
      });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (imageId: number) => {
      return await apiRequest("POST", "/api/design-proposals/gallery/favorites", {
        imageId,
        markerName: commenterName || undefined,
        markerEmail: commenterEmail || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/design-proposals/${proposalId}/gallery`] });
    },
  });

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

  const handleComment = async () => {
    if (!selectedImage || !commentText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    await commentMutation.mutateAsync({
      imageId: selectedImage.id,
      comment: commentText,
      parentCommentId: replyingTo || undefined,
      commenterName: commenterName || undefined,
      commenterEmail: commenterEmail || undefined,
    });
  };

  const handleFavorite = async (imageId: number) => {
    await favoriteMutation.mutateAsync(imageId);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderComments = (comments: ProposalImageComment[], parentId: number | null = null, depth: number = 0) => {
    const filtered = comments.filter((c) => c.parentCommentId === parentId);

    return filtered.map((comment) => (
      <div key={comment.id} className={`${depth > 0 ? "ml-8 mt-2" : "mt-4"}`}>
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {comment.commenterName || "Anonymous"}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700">{comment.comment}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-xs"
              onClick={() => setReplyingTo(comment.id)}
            >
              Reply
            </Button>
            {renderComments(comments, comment.id, depth + 1)}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-4" style={{ color: "#3d4552" }}>
            <Upload className="inline h-5 w-5 mr-2" style={{ color: "#db973c" }} />
            Share Your Photos
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Have reference images or photos you'd like to share? Upload them here!
          </p>

          <div className="space-y-4">
            {!selectedFile ? (
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, GIF up to 10MB
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder="Your name (optional)"
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                  />
                  <Input
                    type="email"
                    placeholder="Your email (optional)"
                    value={uploaderEmail}
                    onChange={(e) => setUploaderEmail(e.target.value)}
                  />
                </div>

                <Input
                  placeholder="Caption (optional)"
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                />

                <Textarea
                  placeholder="Description (optional)"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                />

                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full"
                  style={{ backgroundColor: "#db973c" }}
                >
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : galleryImages && galleryImages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleryImages.map((image) => (
            <Card
              key={image.id}
              className="overflow-hidden hover:shadow-xl transition-all cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <div className="relative aspect-square bg-gray-100">
                <img
                  src={image.imageUrl}
                  alt={image.caption || "Gallery image"}
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite(image.id);
                  }}
                >
                  <Star className={`h-4 w-4 ${image.favoriteCount && image.favoriteCount > 0 ? "fill-yellow-400 text-yellow-400" : ""}`} />
                </Button>
              </div>
              <CardContent className="p-4">
                {image.caption && (
                  <h4 className="font-semibold mb-1">{image.caption}</h4>
                )}
                {image.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {image.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>{image.commentCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>{image.favoriteCount || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-lg">
          <CardContent className="py-16 text-center">
            <ImageIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg text-gray-600">No images in the gallery yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Be the first to share photos!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Image Detail Dialog */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedImage.caption || "Image"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.caption || "Gallery image"}
                className="w-full rounded-lg"
              />

              {selectedImage.description && (
                <p className="text-gray-700">{selectedImage.description}</p>
              )}

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFavorite(selectedImage.id)}
                  className="gap-2"
                >
                  <Star className={`h-4 w-4 ${selectedImage.favoriteCount && selectedImage.favoriteCount > 0 ? "fill-yellow-400 text-yellow-400" : ""}`} />
                  {selectedImage.favoriteCount || 0} Favorites
                </Button>
              </div>

              {/* Comments Section */}
              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">
                  Comments ({selectedImage.commentCount || 0})
                </h4>

                {selectedImage.comments && selectedImage.comments.length > 0 && (
                  <div className="space-y-4 mb-6">
                    {renderComments(selectedImage.comments)}
                  </div>
                )}

                {/* Comment Form */}
                <div className="space-y-3 border-t pt-4">
                  {replyingTo && (
                    <div className="flex items-center justify-between bg-blue-50 p-2 rounded">
                      <span className="text-sm text-blue-700">Replying to comment</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingTo(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Your name (optional)"
                      value={commenterName}
                      onChange={(e) => setCommenterName(e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="Your email (optional)"
                      value={commenterEmail}
                      onChange={(e) => setCommenterEmail(e.target.value)}
                    />
                  </div>

                  <Textarea
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />

                  <Button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="gap-2"
                    style={{ backgroundColor: "#db973c" }}
                  >
                    <Send className="h-4 w-4" />
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
