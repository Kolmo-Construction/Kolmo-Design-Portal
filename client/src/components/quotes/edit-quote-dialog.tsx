import React, { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Plus, Trash2, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CustomerQuote } from "@shared/schema";
import { ImageUpload } from "./image-upload";
import SimpleBeforeAfterManager from "./simple-before-after-manager";

// Line item schema
const lineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.string().min(1, "Unit price is required"),
  discountPercentage: z.string().default("0"),
});

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
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
  totalAmount: z.string().optional(),
  taxPercentage: z.string().default("0"),
  discountPercentage: z.string().default("0"),
  estimatedStartDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
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

  // Calculate totals state
  const [calculatedTotals, setCalculatedTotals] = useState({
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  // Helper function to convert Date to string for form inputs
  const formatDateForInput = (date: string | Date | null | undefined): string => {
    if (!date || date === null) return "";
    if (typeof date === "string") {
      // If it's already an ISO string, extract just the date part
      if (date.includes('T')) {
        return date.split('T')[0];
      }
      return date;
    }
    return date.toISOString().split('T')[0];
  };

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      projectType: "",
      quoteNumber: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      projectTitle: "",
      projectDescription: "",
      projectLocation: "",
      subtotal: "",
      taxAmount: "",
      totalAmount: "",
      taxPercentage: "0",
      discountPercentage: "0",
      estimatedStartDate: "",
      estimatedCompletionDate: "",
      validUntil: "",
      lineItems: [{
        category: "",
        description: "",
        quantity: "1",
        unit: "",
        unitPrice: "0",
        discountPercentage: "0",
      }],
      showColorVerification: false,
      colorVerificationTitle: "",
      colorVerificationDescription: "",
      permitRequired: false,
      permitDetails: "",
      downPaymentPercentage: "",
      milestonePaymentPercentage: "",
      finalPaymentPercentage: "",
      milestoneDescription: "",
      acceptsCreditCards: false,
      creditCardProcessingFee: "",
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

  // Reset form with quote data when the quote prop changes
  React.useEffect(() => {
    if (quote) {
      form.reset({
        projectType: quote.projectType || "",
        quoteNumber: quote.quoteNumber || "",
        customerName: quote.customerName || "",
        customerEmail: quote.customerEmail || "",
        customerPhone: quote.customerPhone || "",
        customerAddress: quote.customerAddress || "",
        projectTitle: quote.projectTitle || "",
        projectDescription: quote.projectDescription || "",
        projectLocation: quote.projectLocation || "",
        subtotal: quote.subtotal || "",
        taxAmount: quote.taxAmount || "",
        totalAmount: quote.totalAmount || "",
        taxPercentage: quote.taxPercentage || "0",
        discountPercentage: quote.discountPercentage || "0",
        estimatedStartDate: formatDateForInput(quote.estimatedStartDate),
        estimatedCompletionDate: formatDateForInput(quote.estimatedCompletionDate),
        validUntil: formatDateForInput(quote.validUntil),
        lineItems: (quote as any).lineItems?.length > 0 ? (quote as any).lineItems.map((item: any) => ({
          category: item.category || "",
          description: item.description || "",
          quantity: String(item.quantity) || "1",
          unit: item.unit || "",
          unitPrice: String(item.unitPrice) || "0",
          discountPercentage: String(item.discountPercentage) || "0",
        })) : [{
          category: "",
          description: "",
          quantity: "1",
          unit: "",
          unitPrice: "0",
          discountPercentage: "0",
        }],
        showColorVerification: quote.showColorVerification || false,
        colorVerificationTitle: quote.colorVerificationTitle || "",
        colorVerificationDescription: quote.colorVerificationDescription || "",
        permitRequired: quote.permitRequired || false,
        permitDetails: quote.permitDetails || "",
        downPaymentPercentage: String(quote.downPaymentPercentage) || "",
        milestonePaymentPercentage: String(quote.milestonePaymentPercentage) || "",
        finalPaymentPercentage: String(quote.finalPaymentPercentage) || "",
        milestoneDescription: quote.milestoneDescription || "",
        acceptsCreditCards: quote.acceptsCreditCards || false,
        creditCardProcessingFee: String(quote.creditCardProcessingFee) || "",
      });
    }
  }, [quote, form.reset]);

  const updateQuoteMutation = useMutation({
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
        estimatedStartDate: data.estimatedStartDate ? new Date(data.estimatedStartDate) : undefined,
        estimatedCompletionDate: data.estimatedCompletionDate ? new Date(data.estimatedCompletionDate) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      };
      
      return await apiRequest("PUT", `/api/quotes/${quote?.id}`, payload);
    },
    onSuccess: (updatedQuote: any) => {
      // Invalidate all quote-related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      
      // Also invalidate specific quote query if it exists
      if (quote?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/quotes', quote.id] });
      }

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
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Item description" />
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
                              <Input {...field} placeholder="e.g., sq ft, hours" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="0" step="0.01" />
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
                            <FormLabel>Unit Price ($)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="0" step="0.01" />
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
                            <FormLabel>Discount (%)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min="0" max="100" step="0.01" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end">
                        <div className="text-sm">
                          <div className="font-medium text-muted-foreground">Total</div>
                          <div className="font-semibold text-lg">
                            ${calculateLineItemTotal(
                              form.watch(`lineItems.${index}.quantity`) || "0",
                              form.watch(`lineItems.${index}.unitPrice`) || "0",
                              form.watch(`lineItems.${index}.discountPercentage`) || "0"
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Totals Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Quote Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="taxPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Rate (%)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" max="100" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discountPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Global Discount (%)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" max="100" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${calculatedTotals.subtotal.toFixed(2)}</span>
                  </div>
                  {calculatedTotals.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Global Discount:</span>
                      <span>-${calculatedTotals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span>${calculatedTotals.taxAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>${calculatedTotals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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

            {/* Before/After Images Management */}
            {quote && (
              <Card>
                <CardHeader>
                  <CardTitle>Before/After Image Pairs</CardTitle>
                  <CardDescription>Manage multiple before/after image pairs for this quote</CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleBeforeAfterManager 
                    quoteId={quote.id}
                    onPairsChange={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
                      if (onSuccess) onSuccess();
                    }}
                  />
                </CardContent>
              </Card>
            )}

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