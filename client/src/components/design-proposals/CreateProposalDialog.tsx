import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { uploadToR2 } from "@/lib/upload";

const proposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  projectId: z.number().optional().nullable(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface Comparison {
  title: string;
  description: string;
  beforeImage: File | null;
  afterImage: File | null;
  beforeImageUrl?: string;
  afterImageUrl?: string;
}

interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProposalDialog({
  open,
  onOpenChange,
}: CreateProposalDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: "",
      description: "",
      customerName: "",
      customerEmail: "",
      projectId: null,
    },
  });

  const addComparison = () => {
    setComparisons([
      ...comparisons,
      {
        title: "",
        description: "",
        beforeImage: null,
        afterImage: null,
      },
    ]);
  };

  const removeComparison = (index: number) => {
    setComparisons(comparisons.filter((_, i) => i !== index));
  };

  const updateComparison = (
    index: number,
    field: keyof Comparison,
    value: any
  ) => {
    const updated = [...comparisons];
    updated[index] = { ...updated[index], [field]: value };
    setComparisons(updated);
  };

  const handleImageUpload = async (file: File) => {
    try {
      const url = await uploadToR2(file);
      return url;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    if (comparisons.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one before/after comparison",
        variant: "destructive",
      });
      return;
    }

    const incompleteComparisons = comparisons.filter(
      (c) => !c.title || !c.beforeImage || !c.afterImage
    );

    if (incompleteComparisons.length > 0) {
      toast({
        title: "Error",
        description:
          "Please complete all comparisons with title and both images",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const proposal = await apiRequest("/api/design-proposals", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      for (let i = 0; i < comparisons.length; i++) {
        const comp = comparisons[i];

        const beforeImageUrl = await handleImageUpload(comp.beforeImage!);
        const afterImageUrl = await handleImageUpload(comp.afterImage!);

        await apiRequest("/api/design-proposals/comparisons", {
          method: "POST",
          body: JSON.stringify({
            proposalId: proposal.id,
            title: comp.title,
            description: comp.description || "",
            beforeImageUrl,
            afterImageUrl,
            orderIndex: i,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/design-proposals"] });
      toast({
        title: "Success",
        description: "Design proposal created successfully",
      });
      onOpenChange(false);
      form.reset();
      setComparisons([]);
    } catch (error) {
      console.error("Error creating proposal:", error);
      toast({
        title: "Error",
        description: "Failed to create design proposal",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Design Proposal</DialogTitle>
          <DialogDescription>
            Create a new design proposal with before/after comparisons to share
            with your customer
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposal Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Kitchen Renovation Design"
                      {...field}
                      data-testid="input-proposal-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional details about this proposal"
                      {...field}
                      data-testid="input-proposal-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        {...field}
                        data-testid="input-customer-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        data-testid="input-customer-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Before/After Comparisons
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addComparison}
                  className="gap-2"
                  data-testid="button-add-comparison"
                >
                  <Plus className="h-4 w-4" />
                  Add Comparison
                </Button>
              </div>

              {comparisons.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No comparisons yet. Click "Add Comparison" to get started.
                </p>
              )}

              <div className="space-y-6">
                {comparisons.map((comparison, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 space-y-4 relative"
                    data-testid={`comparison-${index}`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeComparison(index)}
                      className="absolute top-2 right-2"
                      data-testid={`button-remove-comparison-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    <div>
                      <label className="text-sm font-medium">
                        Comparison Title
                      </label>
                      <Input
                        value={comparison.title}
                        onChange={(e) =>
                          updateComparison(index, "title", e.target.value)
                        }
                        placeholder="e.g., Main Kitchen View"
                        className="mt-1.5"
                        data-testid={`input-comparison-title-${index}`}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Description (Optional)
                      </label>
                      <Textarea
                        value={comparison.description}
                        onChange={(e) =>
                          updateComparison(index, "description", e.target.value)
                        }
                        placeholder="Add details about this comparison"
                        className="mt-1.5"
                        data-testid={`input-comparison-description-${index}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">
                          Before Image
                        </label>
                        <div className="mt-1.5">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateComparison(
                                index,
                                "beforeImage",
                                e.target.files?.[0] || null
                              )
                            }
                            data-testid={`input-before-image-${index}`}
                          />
                          {comparison.beforeImage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {comparison.beforeImage.name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          After Image
                        </label>
                        <div className="mt-1.5">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              updateComparison(
                                index,
                                "afterImage",
                                e.target.files?.[0] || null
                              )
                            }
                            data-testid={`input-after-image-${index}`}
                          />
                          {comparison.afterImage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {comparison.afterImage.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-proposal">
                {isSubmitting ? "Creating..." : "Create Proposal"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
