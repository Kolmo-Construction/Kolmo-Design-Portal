import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Edit3, Camera, Image as ImageIcon, Trash2 } from "lucide-react";
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
  beforeImageUrl,
  afterImageUrl,
  beforeImageCaption,
  afterImageCaption,
  onImagesUpdated
}: QuoteImageManagerProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadType, setUploadType] = useState<'before' | 'after'>('before');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  const beforeFileRef = useRef<HTMLInputElement>(null);
  const afterFileRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, type, caption }: { file: File; type: 'before' | 'after'; caption: string }) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', type);
      formData.append('caption', caption);
      
      const response = await fetch(`/api/quotes/${quoteId}/images/${type}`, {
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
    mutationFn: async ({ type, caption }: { type: 'before' | 'after'; caption: string }) => {
      const response = await fetch(`/api/quotes/${quoteId}/images/${type}/caption`, {
        method: 'PATCH',
        body: JSON.stringify({ caption }),
        headers: { 'Content-Type': 'application/json' },
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
    mutationFn: async (type: 'before' | 'after') => {
      const response = await fetch(`/api/quotes/${quoteId}/images/${type}`, {
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadType(type);
      setImageCaption(type === 'before' ? (beforeImageCaption || "") : (afterImageCaption || ""));
      
      // Create preview URL
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

  const handleCaptionUpdate = (type: 'before' | 'after', caption: string) => {
    updateCaptionMutation.mutate({ type, caption });
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" style={{ color: '#db973c' }} />
            Before & After Images
          </CardTitle>
          <CardDescription>
            Upload images to showcase the project transformation with the interactive slider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Before Image Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Before Image</h4>
              {beforeImageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteImageMutation.mutate('before')}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {beforeImageUrl ? (
              <div className="space-y-3">
                <div className="relative group">
                  <img
                    src={beforeImageUrl}
                    alt="Before"
                    className="w-full h-48 object-contain rounded-lg border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => beforeFileRef.current?.click()}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Replace
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="before-caption">Caption</Label>
                  <div className="flex gap-2">
                    <Input
                      id="before-caption"
                      defaultValue={beforeImageCaption || ""}
                      placeholder="Add a caption for the before image..."
                      onBlur={(e) => {
                        if (e.target.value !== beforeImageCaption) {
                          handleCaptionUpdate('before', e.target.value);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => beforeFileRef.current?.click()}
              >
                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Click to upload before image</p>
                <p className="text-sm text-gray-500">PNG, JPG, or WEBP up to 10MB</p>
              </div>
            )}
            
            <input
              ref={beforeFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'before')}
            />
          </div>

          {/* After Image Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">After Image</h4>
              {afterImageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteImageMutation.mutate('after')}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {afterImageUrl ? (
              <div className="space-y-3">
                <div className="relative group">
                  <img
                    src={afterImageUrl}
                    alt="After"
                    className="w-full h-48 object-contain rounded-lg border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => afterFileRef.current?.click()}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Replace
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="after-caption">Caption</Label>
                  <div className="flex gap-2">
                    <Input
                      id="after-caption"
                      defaultValue={afterImageCaption || ""}
                      placeholder="Add a caption for the after image..."
                      onBlur={(e) => {
                        if (e.target.value !== afterImageCaption) {
                          handleCaptionUpdate('after', e.target.value);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => afterFileRef.current?.click()}
              >
                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Click to upload after image</p>
                <p className="text-sm text-gray-500">PNG, JPG, or WEBP up to 10MB</p>
              </div>
            )}
            
            <input
              ref={afterFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e, 'after')}
            />
          </div>

          {/* Interactive Preview Info */}
          {beforeImageUrl && afterImageUrl && (
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f5f5f5' }}>
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-4 w-4" style={{ color: '#db973c' }} />
                <span className="font-medium" style={{ color: '#1a1a1a' }}>Interactive Slider Ready</span>
              </div>
              <p className="text-sm" style={{ color: '#4a6670' }}>
                Both before and after images are uploaded. Customers will see an interactive slider to compare the transformation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {uploadType === 'before' ? 'Before' : 'After'} Image</DialogTitle>
            <DialogDescription>
              Add a caption to describe this image
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