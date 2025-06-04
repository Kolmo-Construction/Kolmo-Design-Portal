import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, Move, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { BeforeAfterPair } from "@shared/schema";

interface BeforeAfterPairsManagerProps {
  quoteId: number;
  pairs: BeforeAfterPair[];
  onPairsChange: (pairs: BeforeAfterPair[]) => void;
}

interface PairFormData {
  title: string;
  description: string;
  beforeImageFile?: File;
  afterImageFile?: File;
  beforeImageUrl: string;
  afterImageUrl: string;
}

export function BeforeAfterPairsManager({ quoteId, pairs, onPairsChange }: BeforeAfterPairsManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<BeforeAfterPair | null>(null);
  const [formData, setFormData] = useState<PairFormData>({
    title: "",
    description: "",
    beforeImageUrl: "",
    afterImageUrl: ""
  });
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      beforeImageUrl: "",
      afterImageUrl: ""
    });
    setEditingPair(null);
  };

  const handleAddPair = () => {
    setIsAddDialogOpen(true);
    resetForm();
  };

  const handleEditPair = (pair: BeforeAfterPair) => {
    setEditingPair(pair);
    setFormData({
      title: pair.title,
      description: pair.description || "",
      beforeImageUrl: pair.beforeImageUrl,
      afterImageUrl: pair.afterImageUrl
    });
    setIsAddDialogOpen(true);
  };

  const handleDeletePair = (pairId: number) => {
    if (confirm("Are you sure you want to delete this before/after pair?")) {
      const updatedPairs = pairs.filter(p => p.id !== pairId);
      onPairsChange(updatedPairs);
      toast({
        title: "Pair deleted",
        description: "The before/after pair has been removed."
      });
    }
  };

  const handleImageUpload = async (file: File, type: 'before' | 'after') => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageType', type);

      const response = await fetch(`/api/storage/upload/quote/${quoteId}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      setFormData(prev => ({
        ...prev,
        [type === 'before' ? 'beforeImageUrl' : 'afterImageUrl']: result.url
      }));

      toast({
        title: "Image uploaded",
        description: `${type} image uploaded successfully.`
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePair = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for this before/after pair.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.beforeImageUrl || !formData.afterImageUrl) {
      toast({
        title: "Images required",
        description: "Please upload both before and after images.",
        variant: "destructive"
      });
      return;
    }

    try {
      const newPair: BeforeAfterPair = {
        id: editingPair?.id || Date.now(), // Temporary ID for new pairs
        quoteId,
        title: formData.title,
        description: formData.description,
        beforeImageUrl: formData.beforeImageUrl,
        afterImageUrl: formData.afterImageUrl,
        sortOrder: editingPair?.sortOrder || pairs.length,
        createdAt: typeof editingPair?.createdAt === 'string' ? new Date(editingPair.createdAt) : editingPair?.createdAt || new Date()
      };

      let updatedPairs;
      if (editingPair) {
        updatedPairs = pairs.map(p => p.id === editingPair.id ? newPair : p);
      } else {
        updatedPairs = [...pairs, newPair];
      }

      onPairsChange(updatedPairs);
      setIsAddDialogOpen(false);
      resetForm();

      toast({
        title: editingPair ? "Pair updated" : "Pair added",
        description: `Before/after pair has been ${editingPair ? 'updated' : 'added'} successfully.`
      });

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: "Failed to save the before/after pair. Please try again.",
        variant: "destructive"
      });
    }
  };

  const movePair = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pairs.length) return;

    const updatedPairs = [...pairs];
    [updatedPairs[index], updatedPairs[newIndex]] = [updatedPairs[newIndex], updatedPairs[index]];
    
    // Update sort orders
    updatedPairs.forEach((pair, idx) => {
      pair.sortOrder = idx;
    });

    onPairsChange(updatedPairs);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Before & After Image Pairs</h3>
          <p className="text-sm text-muted-foreground">
            Add multiple before/after comparisons for different areas of the project
          </p>
        </div>
        <Button onClick={handleAddPair} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Pair
        </Button>
      </div>

      {pairs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No before/after pairs added yet</p>
              <Button onClick={handleAddPair} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Pair
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair, index) => (
            <Card key={pair.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{pair.title}</CardTitle>
                    {pair.description && (
                      <p className="text-sm text-muted-foreground mt-1">{pair.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => movePair(index, 'up')}
                      disabled={index === 0}
                    >
                      <Move className="w-3 h-3 rotate-180" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => movePair(index, 'down')}
                      disabled={index === pairs.length - 1}
                    >
                      <Move className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditPair(pair)}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePair(pair.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Before</p>
                    {pair.beforeImageUrl ? (
                      <img
                        src={pair.beforeImageUrl}
                        alt="Before"
                        className="w-full h-24 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">After</p>
                    {pair.afterImageUrl ? (
                      <img
                        src={pair.afterImageUrl}
                        alt="After"
                        className="w-full h-24 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPair ? 'Edit Before/After Pair' : 'Add Before/After Pair'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g., Kitchen Cabinets, Bathroom Tile, etc."
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                placeholder="Describe what this comparison shows..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Before Image</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'before');
                    }}
                    className="hidden"
                    id="before-upload"
                  />
                  <label htmlFor="before-upload">
                    <Button variant="outline" className="w-full" disabled={isUploading} asChild>
                      <div>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload Before'}
                      </div>
                    </Button>
                  </label>
                  {formData.beforeImageUrl && (
                    <img
                      src={formData.beforeImageUrl}
                      alt="Before preview"
                      className="w-full h-32 object-cover rounded border"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">After Image</label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'after');
                    }}
                    className="hidden"
                    id="after-upload"
                  />
                  <label htmlFor="after-upload">
                    <Button variant="outline" className="w-full" disabled={isUploading} asChild>
                      <div>
                        <Upload className="w-4 h-4 mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload After'}
                      </div>
                    </Button>
                  </label>
                  {formData.afterImageUrl && (
                    <img
                      src={formData.afterImageUrl}
                      alt="After preview"
                      className="w-full h-32 object-cover rounded border"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePair} disabled={isUploading}>
                {editingPair ? 'Update Pair' : 'Add Pair'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}