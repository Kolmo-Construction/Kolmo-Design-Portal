import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "./image-upload";
import type { QuoteBeforeAfterPair } from "@shared/schema";

interface SimpleBeforeAfterManagerProps {
  quoteId: number;
  onPairsChange?: () => void;
}

export default function SimpleBeforeAfterManager({ quoteId, onPairsChange }: SimpleBeforeAfterManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch before/after pairs
  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ["/api/quotes", quoteId, "before-after-pairs"],
    queryFn: async (): Promise<QuoteBeforeAfterPair[]> => {
      const response = await fetch(`/api/quotes/${quoteId}/before-after-pairs`);
      if (!response.ok) throw new Error('Failed to fetch pairs');
      return response.json();
    },
  });

  // Create new pair
  const createPairMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const response = await fetch(`/api/quotes/${quoteId}/before-after-pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, sortOrder: pairs.length }),
      });
      if (!response.ok) throw new Error('Failed to create pair');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setIsAdding(false);
      setNewTitle("");
      setNewDescription("");
      onPairsChange?.();
      toast({ title: "Success", description: "Before/after pair created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create pair.", variant: "destructive" });
    },
  });

  // Update pair
  const updatePairMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/quotes/before-after-pairs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update pair');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      onPairsChange?.();
      toast({ title: "Success", description: "Pair updated successfully." });
    },
  });

  // Delete pair
  const deletePairMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quotes/before-after-pairs/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error('Failed to delete pair');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "before-after-pairs"] });
      onPairsChange?.();
      toast({ title: "Success", description: "Pair deleted successfully." });
    },
  });

  const handleCreatePair = useCallback(() => {
    if (!newTitle.trim()) {
      toast({ title: "Error", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    createPairMutation.mutate({ title: newTitle, description: newDescription });
  }, [newTitle, newDescription, createPairMutation, toast]);

  const handleDeletePair = useCallback((id: number) => {
    if (confirm("Are you sure you want to delete this before/after pair?")) {
      deletePairMutation.mutate(id);
    }
  }, [deletePairMutation]);

  const handleImageUploaded = useCallback((pairId: number, imageType: 'before' | 'after', url: string) => {
    const updateData = imageType === 'before' ? { beforeImageUrl: url } : { afterImageUrl: url };
    updatePairMutation.mutate({ id: pairId, data: updateData });
  }, [updatePairMutation]);

  const handleStartEdit = useCallback((pair: QuoteBeforeAfterPair) => {
    setEditingId(pair.id);
    setEditingTitle(pair.title || "");
    setEditingDescription(pair.description || "");
  }, []);

  const handleSaveEdit = useCallback((pairId: number) => {
    if (!editingTitle.trim()) {
      toast({ title: "Error", description: "Please enter a title.", variant: "destructive" });
      return;
    }
    
    updatePairMutation.mutate({ 
      id: pairId, 
      data: { 
        title: editingTitle, 
        description: editingDescription 
      } 
    });
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  }, [editingTitle, editingDescription, updatePairMutation, toast]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  }, []);

  if (isLoading) {
    return <div className="text-center py-4">Loading before/after pairs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Before/After Image Pairs</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{pairs.length} pairs</Badge>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Before/After
            </Button>
          )}
        </div>
      </div>

      {/* Add New Pair Form */}
      {isAdding && (
        <Card className="border-2 border-dashed border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Add New Before/After Pair</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Kitchen Transformation, Bathroom Renovation"
              />
            </div>
            
            <div>
              <Label htmlFor="new-description">Description (Optional)</Label>
              <Textarea
                id="new-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe this transformation..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreatePair}
                disabled={createPairMutation.isPending || !newTitle.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {createPairMutation.isPending ? "Creating..." : "Create Pair"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                  setNewDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Pairs */}
      <div className="space-y-4">
        {pairs.map((pair) => (
          <Card key={pair.id} className="border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {editingId === pair.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="Enter title..."
                        className="text-base font-semibold"
                      />
                      <Textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        placeholder="Enter description (optional)..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <CardTitle className="text-base">{pair.title}</CardTitle>
                      {pair.description && (
                        <p className="text-sm text-muted-foreground mt-1">{pair.description}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingId === pair.id ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(pair.id)}
                        disabled={updatePairMutation.isPending || !editingTitle.trim()}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEdit(pair)}
                      >
                        <Edit2 className="h-4 w-4" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before Image Upload */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Before Image</Label>
                  <ImageUpload
                    quoteId={quoteId}
                    imageType="before"
                    onImageUploaded={(url) => handleImageUploaded(pair.id, 'before', url)}
                    existingImage={pair.beforeImageUrl || undefined}
                    label="Upload Before Image"
                    pairId={pair.id}
                  />
                </div>

                {/* After Image Upload */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">After Image</Label>
                  <ImageUpload
                    quoteId={quoteId}
                    imageType="after"
                    onImageUploaded={(url) => handleImageUploaded(pair.id, 'after', url)}
                    existingImage={pair.afterImageUrl || undefined}
                    label="Upload After Image"
                    pairId={pair.id}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pairs.length === 0 && !isAdding && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No before/after pairs yet.</p>
          <p className="text-sm">Click "Add Before/After" to create your first transformation showcase.</p>
        </div>
      )}
    </div>
  );
}