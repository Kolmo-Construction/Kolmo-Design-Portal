import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Upload, X, ThumbsUp, ThumbsDown, Image as ImageIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
  showProsCons: z.boolean().default(false),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
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

interface GalleryImage {
  file: File;
  caption: string;
  description: string;
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
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [pros, setPros] = useState<string[]>([""]);
  const [cons, setCons] = useState<string[]>([""]);

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: "",
      description: "",
      customerName: "",
      customerEmail: "",
      projectId: null,
      showProsCons: false,
      pros: [],
      cons: [],
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

  const addGalleryImage = (file: File) => {
    setGalleryImages([...galleryImages, { file, caption: "", description: "" }]);
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== index));
  };

  const updateGalleryImage = (
    index: number,
    field: keyof GalleryImage,
    value: any
  ) => {
    const updated = [...galleryImages];
    updated[index] = { ...updated[index], [field]: value };
    setGalleryImages(updated);
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
    // Must have at least one comparison OR gallery image
    if (comparisons.length === 0 && galleryImages.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one before/after comparison or gallery image",
        variant: "destructive",
      });
      return;
    }

    // Validate comparisons if any exist
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
      // Filter out empty strings from pros/cons
      const filteredPros = pros.filter(p => p.trim() !== "");
      const filteredCons = cons.filter(c => c.trim() !== "");
      
      const proposalData = {
        ...data,
        pros: filteredPros.length > 0 ? filteredPros : undefined,
        cons: filteredCons.length > 0 ? filteredCons : undefined,
      };
      
      const proposal = await apiRequest("POST", "/api/design-proposals", proposalData);

      // Upload comparisons
      for (let i = 0; i < comparisons.length; i++) {
        const comp = comparisons[i];

        const beforeImageUrl = await handleImageUpload(comp.beforeImage!);
        const afterImageUrl = await handleImageUpload(comp.afterImage!);

        await apiRequest("POST", "/api/design-proposals/comparisons", {
          proposalId: proposal.id,
          title: comp.title,
          description: comp.description || "",
          beforeImageUrl,
          afterImageUrl,
          orderIndex: i,
        });
      }

      // Upload gallery images
      for (let i = 0; i < galleryImages.length; i++) {
        const galleryImage = galleryImages[i];

        const formData = new FormData();
        formData.append("image", galleryImage.file);
        formData.append("proposalId", proposal.id.toString());
        formData.append("caption", galleryImage.caption);
        formData.append("description", galleryImage.description);

        await fetch("/api/design-proposals/gallery", {
          method: "POST",
          body: formData,
          credentials: "include",
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
      setGalleryImages([]);
      setPros([""]);
      setCons([""]);
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

  const addPro = () => setPros([...pros, ""]);
  const removePro = (index: number) => setPros(pros.filter((_, i) => i !== index));
  const updatePro = (index: number, value: string) => {
    const updated = [...pros];
    updated[index] = value;
    setPros(updated);
  };

  const addCon = () => setCons([...cons, ""]);
  const removeCon = (index: number) => setCons(cons.filter((_, i) => i !== index));
  const updateCon = (index: number, value: string) => {
    const updated = [...cons];
    updated[index] = value;
    setCons(updated);
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

            {/* Pros and Cons Section */}
            <div className="border-t pt-6">
              <FormField
                control={form.control}
                name="showProsCons"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Show Pros & Cons Section
                      </FormLabel>
                      <FormDescription>
                        Display a pros and cons analysis in the customer-facing proposal
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-show-pros-cons"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("showProsCons") && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {/* Pros Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-green-600" />
                        <h4 className="text-sm font-semibold">Pros</h4>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addPro}
                        className="h-8 gap-1"
                        data-testid="button-add-pro"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {pros.map((pro, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={pro}
                            onChange={(e) => updatePro(index, e.target.value)}
                            placeholder="Enter a pro"
                            className="flex-1"
                            data-testid={`input-pro-${index}`}
                          />
                          {pros.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePro(index)}
                              data-testid={`button-remove-pro-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cons Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="h-4 w-4 text-red-600" />
                        <h4 className="text-sm font-semibold">Cons</h4>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addCon}
                        className="h-8 gap-1"
                        data-testid="button-add-con"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {cons.map((con, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={con}
                            onChange={(e) => updateCon(index, e.target.value)}
                            placeholder="Enter a con"
                            className="flex-1"
                            data-testid={`input-con-${index}`}
                          />
                          {cons.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCon(index)}
                              data-testid={`button-remove-con-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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

            {/* Gallery Images Section */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Gallery Images</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload initial site photos or reference images (optional)
                  </p>
                </div>
              </div>

              {galleryImages.length === 0 ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg p-8 cursor-pointer hover:border-primary transition-colors">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Click to upload gallery images
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, GIF up to 10MB
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach(file => addGalleryImage(file));
                      e.target.value = ''; // Reset input
                    }}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-4">
                  {galleryImages.map((image, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-3 relative"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGalleryImage(index)}
                        className="absolute top-2 right-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-3">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{image.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(image.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          Caption (Optional)
                        </label>
                        <Input
                          value={image.caption}
                          onChange={(e) =>
                            updateGalleryImage(index, "caption", e.target.value)
                          }
                          placeholder="Add a caption for this image"
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">
                          Description (Optional)
                        </label>
                        <Textarea
                          value={image.description}
                          onChange={(e) =>
                            updateGalleryImage(index, "description", e.target.value)
                          }
                          placeholder="Add details about this image"
                          className="mt-1.5"
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}

                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-muted rounded-lg p-4 cursor-pointer hover:border-primary transition-colors">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Add More Images</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        files.forEach(file => addGalleryImage(file));
                        e.target.value = ''; // Reset input
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
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
