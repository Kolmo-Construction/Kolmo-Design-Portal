import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { QuoteBeforeAfterPair } from "@shared/schema";

interface BeforeAfterPairsManagerProps {
  quoteId: number;
  onPairsChange?: () => void;
}

interface PairFormData {
  title: string;
  description: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
}

export default function BeforeAfterPairsManager({ quoteId, onPairsChange }: BeforeAfterPairsManagerProps) {
  const [newPairData, setNewPairData] = useState<PairFormData>({
    title: "",
    description: "",
  });
  const [editingPair, setEditingPair] = useState<QuoteBeforeAfterPair | null>(null);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch before/after pairs for this quote
  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ["/api/quotes", quoteId, "before-after-pairs"],
    queryFn: async (): Promise<QuoteBeforeAfterPair[]> => {
      const response = await fetch(`/api/quotes/${quoteId}/before-after-pairs`);
      if (!response.ok) {
        throw new Error('Failed to fetch before/after pairs');
      }
      return response.json();
    },
  });

  // Create new pair mutation
  const createPairMutation = useMutation({
    mutationFn: async (data: PairFormData) => {
      const response = await fetch(`/api/quotes/${quoteId}/before-after-pairs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          sortOrder: pairs.length,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create before/after pair');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setNewPairData({ title: "", description: "" });
      onPairsChange?.();
      toast({
        title: "Success",
        description: "Before/after pair created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create before/after pair.",
        variant: "destructive",
      });
    },
  });

  // Update pair mutation
  const updatePairMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PairFormData> }) => {
      const response = await fetch(`/api/quotes/before-after-pairs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update before/after pair');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setEditingPair(null);
      onPairsChange?.();
      toast({
        title: "Success",
        description: "Before/after pair updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update before/after pair.",
        variant: "destructive",
      });
    },
  });

  // Delete pair mutation
  const deletePairMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quotes/before-after-pairs/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error('Failed to delete before/after pair');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      onPairsChange?.();
      toast({
        title: "Success",
        description: "Before/after pair deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete before/after pair.",
        variant: "destructive",
      });
    },
  });

  // Reorder pairs mutation
  const reorderPairsMutation = useMutation({
    mutationFn: async (pairIds: number[]) => {
      const response = await fetch(`/api/quotes/${quoteId}/before-after-pairs/reorder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pairIds }),
      });
      if (!response.ok) {
        throw new Error('Failed to reorder before/after pairs');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      onPairsChange?.();
    },
  });

  const handleCreatePair = useCallback(() => {
    if (!newPairData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a title for the before/after pair.",
        variant: "destructive",
      });
      return;
    }
    createPairMutation.mutate(newPairData);
  }, [newPairData, createPairMutation, toast]);

  const handleUpdatePair = useCallback((id: number, data: Partial<PairFormData>) => {
    updatePairMutation.mutate({ id, data });
  }, [updatePairMutation]);

  const handleDeletePair = useCallback((id: number) => {
    if (confirm("Are you sure you want to delete this before/after pair?")) {
      deletePairMutation.mutate(id);
    }
  }, [deletePairMutation]);

  const handleDragStart = useCallback((e: React.DragEvent, pairId: number) => {
    setDraggedItem(pairId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetPairId: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === targetPairId) return;

    const draggedIndex = pairs.findIndex(p => p.id === draggedItem);
    const targetIndex = pairs.findIndex(p => p.id === targetPairId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newPairs = [...pairs];
    const [removed] = newPairs.splice(draggedIndex, 1);
    newPairs.splice(targetIndex, 0, removed);

    const pairIds = newPairs.map(p => p.id);
    reorderPairsMutation.mutate(pairIds);
    setDraggedItem(null);
  }, [draggedItem, pairs, reorderPairsMutation]);

  const handleImageUpload = useCallback(async (file: File, pairId: number, imageType: 'before' | 'after') => {
    // This would integrate with your existing image upload functionality
    // For now, we'll show a placeholder
    toast({
      title: "Image Upload",
      description: "Image upload functionality will be integrated with existing upload system.",
    });
  }, [toast]);

  if (isLoading) {
    return <div className="text-center py-4">Loading before/after pairs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Before/After Image Pairs</h3>
        <Badge variant="secondary">{pairs.length} pairs</Badge>
      </div>

      {/* Existing Pairs */}
      <div className="space-y-4">
        {pairs.map((pair) => (
          <Card 
            key={pair.id}
            className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors"
            draggable
            onDragStart={(e) => handleDragStart(e, pair.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, pair.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                  <CardTitle className="text-base">
                    {editingPair?.id === pair.id ? (
                      <Input
                        value={editingPair.title || ""}
                        onChange={(e) => setEditingPair({ ...editingPair, title: e.target.value })}
                        placeholder="Pair title"
                        className="h-8"
                      />
                    ) : (
                      pair.title || "Untitled Pair"
                    )}
                  </CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  {editingPair?.id === pair.id ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdatePair(pair.id, {
                          title: editingPair.title,
                          description: editingPair.description,
                        })}
                        disabled={updatePairMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPair(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPair(pair)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePair(pair.id)}
                        disabled={deletePairMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingPair?.id === pair.id ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`description-${pair.id}`}>Description</Label>
                    <Textarea
                      id={`description-${pair.id}`}
                      value={editingPair.description || ""}
                      onChange={(e) => setEditingPair({ ...editingPair, description: e.target.value })}
                      placeholder="Describe this transformation"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pair.description && (
                    <p className="text-sm text-gray-600">{pair.description}</p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before Image */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Before Image</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        {pair.beforeImageUrl ? (
                          <div className="relative">
                            <img
                              src={pair.beforeImageUrl}
                              alt="Before"
                              className="w-full h-32 object-cover rounded"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-1 right-1"
                              onClick={() => handleUpdatePair(pair.id, { beforeImageUrl: undefined })}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="py-8">
                            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Upload before image</p>
                            <Button size="sm" variant="outline" className="mt-2">
                              Choose File
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* After Image */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">After Image</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        {pair.afterImageUrl ? (
                          <div className="relative">
                            <img
                              src={pair.afterImageUrl}
                              alt="After"
                              className="w-full h-32 object-cover rounded"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-1 right-1"
                              onClick={() => handleUpdatePair(pair.id, { afterImageUrl: undefined })}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="py-8">
                            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">Upload after image</p>
                            <Button size="sm" variant="outline" className="mt-2">
                              Choose File
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Pair */}
      <Card className="border-2 border-dashed border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add New Before/After Pair
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="new-pair-title">Title</Label>
            <Input
              id="new-pair-title"
              value={newPairData.title}
              onChange={(e) => setNewPairData({ ...newPairData, title: e.target.value })}
              placeholder="e.g., Kitchen Transformation, Bathroom Renovation"
            />
          </div>
          
          <div>
            <Label htmlFor="new-pair-description">Description</Label>
            <Textarea
              id="new-pair-description"
              value={newPairData.description}
              onChange={(e) => setNewPairData({ ...newPairData, description: e.target.value })}
              placeholder="Describe this transformation (optional)"
              rows={2}
            />
          </div>

          <Button
            onClick={handleCreatePair}
            disabled={createPairMutation.isPending || !newPairData.title.trim()}
            className="w-full"
          >
            {createPairMutation.isPending ? "Creating..." : "Create Pair"}
          </Button>
        </CardContent>
      </Card>

      {pairs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No before/after pairs yet.</p>
          <p className="text-sm">Add your first transformation showcase above.</p>
        </div>
      )}
    </div>
  );
}