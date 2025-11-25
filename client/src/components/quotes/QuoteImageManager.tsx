import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Edit3, Camera, Image as ImageIcon, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface QuoteImageManagerProps {
  quoteId: number;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeImageCaption?: string;
  afterImageCaption?: string;
  onImagesUpdated?: () => void;
}

export function QuoteImageManager({
  quoteId,
  onImagesUpdated
}: QuoteImageManagerProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadType, setUploadType] = useState<'before' | 'after'>('before');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [pairIndex, setPairIndex] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quote media (before/after images)
  const { data: allMedia = [] } = useQuery<QuoteMedia[]>({
    queryKey: [`/api/quotes/${quoteId}/media`],
    enabled: !!quoteId,
  });

  // Group images by before/after pairs
  const imagePairs = (() => {
    const beforeImages = allMedia.filter(m => m.category === 'before').sort((a, b) => a.sortOrder - b.sortOrder);
    const afterImages = allMedia.filter(m => m.category === 'after').sort((a, b) => a.sortOrder - b.sortOrder);
    
    const pairs: Array<{ before?: QuoteMedia; after?: QuoteMedia }> = [];
    const maxLength = Math.max(beforeImages.length, afterImages.length);
    
    for (let i = 0; i < maxLength; i++) {
      pairs.push({
        before: beforeImages[i],
        after: afterImages[i],
      });
    }
    
    return pairs;
  })();

  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, type, caption }: { file: File; type: 'before' | 'after'; caption: string }) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', caption);
      console.log(`[QuoteImageManager] Uploading ${type} image`);
      
      // Pass category as query parameter to ensure it's received correctly
      const response = await fetch(`/api/quotes/${quoteId}/photos?category=${encodeURIComponent(type)}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${uploadType === 'before' ? 'Before' : 'After'} image uploaded successfully`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/media`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setImageCaption("");
      setPreviewUrl("");
      onImagesUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    },
  });

  const updateCaptionMutation = useMutation({
    mutationFn: async ({ mediaId, caption }: { mediaId: number; caption: string }) => {
      const response = await fetch(`/api/quotes/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update caption');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Caption updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/media`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
      onImagesUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update caption",
        variant: "destructive",
      });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (mediaId: number) => {
      const response = await fetch(`/api/quotes/media/${mediaId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
      
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/media`] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
      onImagesUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete image",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after', index: number) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadType(type);
      setPairIndex(index);
      setImageCaption("");
      
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setShowUploadDialog(true);
    }
  };

  const handleUpload = () => {
    if (uploadFile) {
      uploadImageMutation.mutate({
        file: uploadFile,
        type: uploadType,
        caption: imageCaption,
      });
    }
  };

  const handleCaptionUpdate = (mediaId: number, caption: string) => {
    updateCaptionMutation.mutate({ mediaId, caption });
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" style={{ color: '#db973c' }} />
                Before & After Images
              </CardTitle>
              <CardDescription>
                Upload multiple before and after images to showcase project transformations
              </CardDescription>
            </div>
            {imagePairs.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPairIndex(imagePairs.length);
                  setUploadType('before');
                  setImageCaption("");
                  setPreviewUrl("");
                  fileInputRef.current?.click();
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Pair
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {imagePairs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No before and after images yet. Add your first pair to get started.</p>
            </div>
          ) : (
            imagePairs.map((pair, index) => (
              <div key={index} className="border-t pt-6 first:border-t-0 first:pt-0">
                <h4 className="font-semibold text-lg mb-4">Pair {index + 1}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Before Image */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Before</h5>
                    {pair.before ? (
                      <div className="space-y-3">
                        <div className="relative group">
                          <img
                            src={pair.before.mediaUrl}
                            alt="Before"
                            className="w-full h-48 object-cover rounded-lg border"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setUploadType('before');
                                setPairIndex(index);
                                fileInputRef.current?.click();
                              }}
                            >
                              <Edit3 className="h-4 w-4" />
                              Replace
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteImageMutation.mutate(pair.before!.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`before-caption-${index}`} className="text-xs">Caption</Label>
                          <Textarea
                            id={`before-caption-${index}`}
                            defaultValue={pair.before.caption || ""}
                            placeholder="Add a caption for the before image..."
                            className="text-sm resize-none"
                            rows={2}
                            onBlur={(e) => {
                              if (e.target.value !== pair.before?.caption) {
                                handleCaptionUpdate(pair.before!.id, e.target.value);
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
                        onClick={() => {
                          setUploadType('before');
                          setPairIndex(index);
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Upload before image</p>
                      </div>
                    )}
                  </div>

                  {/* After Image */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">After</h5>
                    {pair.after ? (
                      <div className="space-y-3">
                        <div className="relative group">
                          <img
                            src={pair.after.mediaUrl}
                            alt="After"
                            className="w-full h-48 object-cover rounded-lg border"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setUploadType('after');
                                setPairIndex(index);
                                fileInputRef.current?.click();
                              }}
                            >
                              <Edit3 className="h-4 w-4" />
                              Replace
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteImageMutation.mutate(pair.after!.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`after-caption-${index}`} className="text-xs">Caption</Label>
                          <Textarea
                            id={`after-caption-${index}`}
                            defaultValue={pair.after.caption || ""}
                            placeholder="Add a caption for the after image..."
                            className="text-sm resize-none"
                            rows={2}
                            onBlur={(e) => {
                              if (e.target.value !== pair.after?.caption) {
                                handleCaptionUpdate(pair.after!.id, e.target.value);
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
                        onClick={() => {
                          setUploadType('after');
                          setPairIndex(index);
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Upload after image</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Complete indicator */}
                {pair.before && pair.after && (
                  <div className="mt-4 p-2 rounded bg-green-50 text-green-700 text-sm flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    Pair complete - customers will see an interactive slider
                  </div>
                )}
              </div>
            ))
          )}

          {imagePairs.length > 0 && imagePairs.length < 10 && (
            <div className="pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPairIndex(imagePairs.length);
                  setUploadType('before');
                  setImageCaption("");
                  setPreviewUrl("");
                  fileInputRef.current?.click();
                }}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Another Pair
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, uploadType, pairIndex)}
      />

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {uploadType === 'before' ? 'Before' : 'After'} Image</DialogTitle>
            <DialogDescription>
              Add a caption to describe this image (optional)
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
              <Label htmlFor="image-caption">Caption</Label>
              <Textarea
                id="image-caption"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder={`Describe the ${uploadType} state...`}
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
                setImageCaption("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadImageMutation.isPending}
              style={{ backgroundColor: '#db973c' }}
              className="text-white hover:opacity-90"
            >
              {uploadImageMutation.isPending ? "Uploading..." : "Upload Image"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
