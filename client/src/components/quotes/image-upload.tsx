import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImageUploadProps {
  quoteId: number;
  imageType: 'project' | 'before' | 'after' | 'reference';
  onImageUploaded: (imageUrl: string, imageKey?: string) => void;
  existingImage?: string;
  label?: string;
  className?: string;
  pairId?: number;
}

export function ImageUpload({ 
  quoteId, 
  imageType, 
  onImageUploaded, 
  existingImage, 
  label,
  className = "",
  pairId
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG, PNG, GIF, WebP).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageType', imageType);
      formData.append('caption', file.name);

      const response = await fetch(`/api/storage/upload/quote/${quoteId}`, {
        method: "POST",
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        onImageUploaded(data.url, data.key);
        toast({
          title: "Success",
          description: "Image uploaded successfully.",
        });
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const getImageTypeLabel = () => {
    switch (imageType) {
      case 'before': return 'Before Image';
      case 'after': return 'After Image';
      case 'project': return 'Project Image';
      case 'reference': return 'Reference Image';
      default: return 'Image';
    }
  };

  const getImageTypeBadgeColor = () => {
    switch (imageType) {
      case 'before': return 'bg-red-50 text-red-700 border-red-200';
      case 'after': return 'bg-green-50 text-green-700 border-green-200';
      case 'project': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'reference': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={className}>
      {label && (
        <Label className="text-sm font-medium mb-2 block">
          {label}
        </Label>
      )}
      
      <Card className={`border-2 border-dashed transition-colors ${
        dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
      }`}>
        <CardContent className="p-4">
          {existingImage ? (
            <div className="space-y-3">
              <div className="relative">
                <img
                  src={existingImage}
                  alt={getImageTypeLabel()}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Badge 
                  variant="outline" 
                  className={`absolute top-2 left-2 ${getImageTypeBadgeColor()}`}
                >
                  {getImageTypeLabel()}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Replace Image
              </Button>
            </div>
          ) : (
            <div
              className={`text-center py-8 cursor-pointer ${
                dragActive ? 'bg-blue-50' : ''
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                {uploading ? 'Uploading...' : 'Drop image here or click to upload'}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                PNG, JPEG, GIF, WebP up to 10MB
              </p>
              <Badge 
                variant="outline" 
                className={getImageTypeBadgeColor()}
              >
                {getImageTypeLabel()}
              </Badge>
            </div>
          )}
          
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            disabled={uploading}
          />
        </CardContent>
      </Card>
    </div>
  );
}