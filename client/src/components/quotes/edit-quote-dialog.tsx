import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { CustomerQuote } from "@shared/schema";
import { ImageUpload } from "./image-upload";

const quoteFormSchema = z.object({
  projectType: z.string().min(1, "Project type is required"),
  quoteNumber: z.string().min(1, "Quote number is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().min(1, "Project description is required"),
  projectLocation: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal is required"),
  taxAmount: z.string().min(1, "Tax amount is required"),
  totalAmount: z.string().min(1, "Total amount is required"),
  estimatedStartDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  showBeforeAfter: z.boolean().default(false),
  beforeAfterTitle: z.string().optional(),
  beforeAfterDescription: z.string().optional(),
  showColorVerification: z.boolean().default(false),
  colorVerificationTitle: z.string().optional(),
  colorVerificationDescription: z.string().optional(),
  permitRequired: z.boolean().default(false),
  permitDetails: z.string().optional(),
  downPaymentPercentage: z.string().optional(),
  milestonePaymentPercentage: z.string().optional(),
  finalPaymentPercentage: z.string().optional(),
  milestoneDescription: z.string().optional(),
  acceptsCreditCards: z.boolean().default(false),
  creditCardProcessingFee: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface EditQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: CustomerQuote | null;
  onSuccess?: () => void;
}

export default function EditQuoteDialog({ 
  open, 
  onOpenChange, 
  quote, 
  onSuccess 
}: EditQuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      projectType: quote?.projectType || "",
      quoteNumber: quote?.quoteNumber || "",
      customerName: quote?.customerName || "",
      customerEmail: quote?.customerEmail || "",
      customerPhone: quote?.customerPhone || "",
      customerAddress: quote?.customerAddress || "",
      projectTitle: quote?.projectTitle || "",
      projectDescription: quote?.projectDescription || "",
      projectLocation: quote?.projectLocation || "",
      subtotal: quote?.subtotal || "",
      taxAmount: quote?.taxAmount || "",
      totalAmount: quote?.totalAmount || "",
      estimatedStartDate: quote?.estimatedStartDate || "",
      estimatedCompletionDate: quote?.estimatedCompletionDate || "",
      validUntil: quote?.validUntil || "",
      showBeforeAfter: quote?.showBeforeAfter || false,
      beforeAfterTitle: quote?.beforeAfterTitle || "",
      beforeAfterDescription: quote?.beforeAfterDescription || "",
      showColorVerification: quote?.showColorVerification || false,
      colorVerificationTitle: quote?.colorVerificationTitle || "",
      colorVerificationDescription: quote?.colorVerificationDescription || "",
      permitRequired: quote?.permitRequired || false,
      permitDetails: quote?.permitDetails || "",
      downPaymentPercentage: quote?.downPaymentPercentage || "",
      milestonePaymentPercentage: quote?.milestonePaymentPercentage || "",
      finalPaymentPercentage: quote?.finalPaymentPercentage || "",
      milestoneDescription: quote?.milestoneDescription || "",
      acceptsCreditCards: quote?.acceptsCreditCards || false,
      creditCardProcessingFee: quote?.creditCardProcessingFee || "",
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      const response = await fetch(`/api/quotes/${quote?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update quote');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Success",
        description: "Quote updated successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update quote",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    updateQuoteMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quote</DialogTitle>
          <DialogDescription>
            Update the quote details and project information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Project Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="residential-painting">Residential Painting</SelectItem>
                        <SelectItem value="commercial-painting">Commercial Painting</SelectItem>
                        <SelectItem value="interior-painting">Interior Painting</SelectItem>
                        <SelectItem value="exterior-painting">Exterior Painting</SelectItem>
                        <SelectItem value="cabinet-refinishing">Cabinet Refinishing</SelectItem>
                        <SelectItem value="deck-staining">Deck Staining</SelectItem>
                        <SelectItem value="pressure-washing">Pressure Washing</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quoteNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Q-2024-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Kitchen Cabinet Refinishing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Location</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St, City, State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="projectDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed description of the project scope and requirements..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
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
                      <FormLabel>Customer Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="123 Main St, City, State, ZIP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="subtotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal</FormLabel>
                      <FormControl>
                        <Input placeholder="5000.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Amount</FormLabel>
                      <FormControl>
                        <Input placeholder="400.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount</FormLabel>
                      <FormControl>
                        <Input placeholder="5400.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="estimatedStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedCompletionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Completion Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Payment Terms */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment Terms</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="acceptsCreditCards"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Accepts Credit Cards</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Allow credit card payments
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="creditCardProcessingFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Card Processing Fee (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="3.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="downPaymentPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Down Payment (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="25.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="milestonePaymentPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Milestone Payment (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="50.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="finalPaymentPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final Payment (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="25.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="milestoneDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Milestone Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Description of milestone requirements..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Options</h3>
              
              <FormField
                control={form.control}
                name="permitRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Permit Required</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Project requires permits
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permitDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permit Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Details about required permits..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Before/After Images Section */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="showBeforeAfter"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Before/After Images</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Show before and after comparison
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("showBeforeAfter") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Before/After Configuration</CardTitle>
                    <CardDescription>Configure the before/after image section</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="beforeAfterTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Project Transformation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="beforeAfterDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={2} placeholder="Brief description of the transformation..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {quote && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ImageUpload
                          quoteId={quote.id}
                          imageType="before"
                          onImageUploaded={(url, key) => {
                            toast({
                              title: "Before image uploaded",
                              description: "The before image has been uploaded successfully.",
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
                          }}
                          existingImage={quote.beforeImageUrl || undefined}
                          label="Before Image"
                        />
                        
                        <ImageUpload
                          quoteId={quote.id}
                          imageType="after"
                          onImageUploaded={(url, key) => {
                            toast({
                              title: "After image uploaded",
                              description: "The after image has been uploaded successfully.",
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
                          }}
                          existingImage={quote.afterImageUrl || undefined}
                          label="After Image"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateQuoteMutation.isPending}
              >
                {updateQuoteMutation.isPending ? "Updating..." : "Update Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}