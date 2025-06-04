import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Line item schema
const lineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.string().min(1, "Unit price is required"),
  discountPercentage: z.string().default("0"),
});

// Main quote form schema
const quoteFormSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().min(1, "Project description is required"),
  projectType: z.string().min(1, "Project type is required"),
  projectLocation: z.string().optional(),
  estimatedStartDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  taxPercentage: z.string().default("0"),
  discountPercentage: z.string().default("0"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
  // Payment terms
  downPaymentPercentage: z.string().optional(),
  milestonePaymentPercentage: z.string().optional(),
  finalPaymentPercentage: z.string().optional(),
  milestoneDescription: z.string().optional(),
  acceptsCreditCards: z.boolean().default(true),
  creditCardProcessingFee: z.string().optional(),
  // Project details
  permitRequired: z.boolean().default(false),
  permitDetails: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CreateQuoteDialog({ open, onOpenChange, onSuccess }: CreateQuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Calculate totals state
  const [calculatedTotals, setCalculatedTotals] = useState({
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      projectTitle: "",
      projectDescription: "",
      projectType: "",
      projectLocation: "",
      estimatedStartDate: "",
      estimatedCompletionDate: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      taxPercentage: "0",
      discountPercentage: "0",
      lineItems: [
        {
          category: "",
          description: "",
          quantity: "1",
          unit: "",
          unitPrice: "0",
          discountPercentage: "0",
        }
      ],
      downPaymentPercentage: "",
      milestonePaymentPercentage: "",
      finalPaymentPercentage: "",
      milestoneDescription: "",
      acceptsCreditCards: true,
      creditCardProcessingFee: "",
      permitRequired: false,
      permitDetails: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Calculate line item total with discount
  const calculateLineItemTotal = useCallback((quantity: string, unitPrice: string, discountPercentage: string) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const discount = parseFloat(discountPercentage) || 0;
    
    const subtotal = qty * price;
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  }, []);

  // Calculate all totals
  const calculateTotals = useCallback(() => {
    const lineItems = form.getValues("lineItems");
    const taxPercentage = parseFloat(form.getValues("taxPercentage")) || 0;
    const discountPercentage = parseFloat(form.getValues("discountPercentage")) || 0;

    // Calculate subtotal from all line items
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + calculateLineItemTotal(item.quantity, item.unitPrice, item.discountPercentage);
    }, 0);

    // Apply global discount
    const globalDiscountAmount = subtotal * (discountPercentage / 100);
    const afterGlobalDiscount = subtotal - globalDiscountAmount;

    // Calculate tax on discounted amount
    const taxAmount = afterGlobalDiscount * (taxPercentage / 100);
    const totalAmount = afterGlobalDiscount + taxAmount;

    setCalculatedTotals({
      subtotal,
      discountAmount: globalDiscountAmount,
      taxableAmount: afterGlobalDiscount,
      taxAmount,
      totalAmount,
    });
  }, [form, calculateLineItemTotal]);

  // Recalculate totals whenever form values change
  useEffect(() => {
    const subscription = form.watch(() => {
      calculateTotals();
    });
    return () => subscription.unsubscribe();
  }, [form, calculateTotals]);

  const createQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      const payload = {
        ...data,
        subtotal: calculatedTotals.subtotal.toFixed(2),
        discountAmount: calculatedTotals.discountAmount.toFixed(2),
        taxableAmount: calculatedTotals.taxableAmount.toFixed(2),
        taxAmount: calculatedTotals.taxAmount.toFixed(2),
        totalAmount: calculatedTotals.totalAmount.toFixed(2),
        lineItems: data.lineItems.map(item => ({
          ...item,
          totalPrice: calculateLineItemTotal(item.quantity, item.unitPrice, item.discountPercentage).toFixed(2),
        })),
      };
      
      return await apiRequest("POST", "/api/quotes", payload);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Quote created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    createQuoteMutation.mutate(data);
  };

  const addLineItem = () => {
    append({
      category: "",
      description: "",
      quantity: "1",
      unit: "",
      unitPrice: "0",
      discountPercentage: "0",
    });
  };

  const removeLineItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Quote</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Project Information */}
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Title</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <SelectItem value="bathroom">Bathroom Renovation</SelectItem>
                            <SelectItem value="kitchen">Kitchen Renovation</SelectItem>
                            <SelectItem value="flooring">Flooring</SelectItem>
                            <SelectItem value="painting">Painting</SelectItem>
                            <SelectItem value="roofing">Roofing</SelectItem>
                            <SelectItem value="plumbing">Plumbing</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="landscaping">Landscaping</SelectItem>
                            <SelectItem value="custom">Custom Project</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Input {...field} />
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
                          <Input {...field} type="date" />
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
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estimatedStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Start Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
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
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Line Items
                  <Button type="button" onClick={addLineItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          variant="outline"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.category`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Materials" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Item description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., sq ft" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.discountPercentage`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount %</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" min="0" max="100" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end">
                        <div className="text-sm">
                          <div className="font-medium">Total:</div>
                          <div className="text-green-600">
                            ${calculateLineItemTotal(
                              form.watch(`lineItems.${index}.quantity`),
                              form.watch(`lineItems.${index}.unitPrice`),
                              form.watch(`lineItems.${index}.discountPercentage`)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Pricing and Totals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="h-5 w-5 mr-2" />
                  Pricing & Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Global Discount %</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" min="0" max="100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="taxPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax %</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" min="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${calculatedTotals.subtotal.toFixed(2)}</span>
                  </div>
                  {calculatedTotals.discountAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Global Discount:</span>
                      <span>-${calculatedTotals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <span>${calculatedTotals.taxableAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${calculatedTotals.taxAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Amount:</span>
                    <span>${calculatedTotals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Terms */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="downPaymentPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Down Payment %</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" />
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
                        <FormLabel>Milestone Payment %</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" />
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
                        <FormLabel>Final Payment %</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="acceptsCreditCards"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Accept Credit Cards
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                {form.watch("acceptsCreditCards") && (
                  <FormField
                    control={form.control}
                    name="creditCardProcessingFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Card Processing Fee %</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Before/After Images */}
            <Card>
              <CardHeader>
                <CardTitle>Before/After Images</CardTitle>
                <CardDescription>Upload before and after images to showcase project transformation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="showBeforeAfter"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Show Before/After Section
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                
                {form.watch("showBeforeAfter") && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
                    
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium mb-3">Before Image</h4>
                        {/* Image upload component will be added here after quote creation */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <p className="text-sm text-gray-500">Upload after creating quote</p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium mb-3">After Image</h4>
                        {/* Image upload component will be added here after quote creation */}
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <p className="text-sm text-gray-500">Upload after creating quote</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Details */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="permitRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Permit Required
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                {form.watch("permitRequired") && (
                  <FormField
                    control={form.control}
                    name="permitDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Permit Details</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

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
                disabled={createQuoteMutation.isPending}
              >
                {createQuoteMutation.isPending ? "Creating..." : "Create Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}