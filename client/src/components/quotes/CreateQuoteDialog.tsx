import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarIcon, Plus, Trash2, Calculator } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn, formatCurrency } from "@/lib/utils";

// Line item schema for the form
const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  category: z.string().optional(),
});

const createQuoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  estimatedStartDate: z.date().optional(),
  estimatedCompletionDate: z.date().optional(),
  validUntil: z.date({
    required_error: "Valid until date is required",
  }),
  downPaymentPercentage: z.number().min(0).max(100).default(40),
  milestonePaymentPercentage: z.number().min(0).max(100).default(40),
  finalPaymentPercentage: z.number().min(0).max(100).default(20),
  milestoneDescription: z.string().optional(),
  // Core financial fields that match the database schema
  subtotal: z.number().default(0),
  discountPercentage: z.number().min(0).max(100).default(0),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(8.5),
  taxAmount: z.number().min(0).default(0),
  total: z.number().default(0),
  isManualTax: z.boolean().default(false),
  // Line items for the UI only (will be created separately)
  lineItems: z.array(lineItemSchema).default([]),
});

type CreateQuoteForm = z.infer<typeof createQuoteSchema>;

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateQuoteDialog({ open, onOpenChange }: CreateQuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<CreateQuoteForm>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      downPaymentPercentage: 40,
      milestonePaymentPercentage: 40,
      finalPaymentPercentage: 20,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      subtotal: 0,
      discountPercentage: 0,
      discountAmount: 0,
      taxRate: 8.5,
      taxAmount: 0,
      total: 0,
      isManualTax: false,
      lineItems: [],
    },
  });

  // Watch form values for calculations
  const watchedValues = form.watch();
  const lineItems = form.watch("lineItems");
  const isManualTax = form.watch("isManualTax");
  
  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  
  const discountAmount = (subtotal * (watchedValues.discountPercentage || 0)) / 100;
    
  const afterDiscount = subtotal - discountAmount;
  
  const taxAmount = isManualTax 
    ? watchedValues.taxAmount || 0
    : (afterDiscount * (watchedValues.taxRate || 0)) / 100;
    
  const total = afterDiscount + taxAmount;

  // Line item management functions
  const addLineItem = () => {
    const currentItems = form.getValues("lineItems");
    form.setValue("lineItems", [...currentItems, {
      description: "",
      quantity: 1,
      unitPrice: 0,
      category: "",
      unit: "",
      discountPercentage: 0,
      discountAmount: 0,
      totalPrice: 0,
      sortOrder: currentItems.length,
    }]);
  };

  const removeLineItem = (index: number) => {
    const currentItems = form.getValues("lineItems");
    form.setValue("lineItems", currentItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof typeof lineItemSchema._type, value: any) => {
    const currentItems = form.getValues("lineItems");
    const updatedItems = [...currentItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    form.setValue("lineItems", updatedItems);
  };

  const createQuoteMutation = useMutation({
    mutationFn: async (data: CreateQuoteForm) => {
      // Create the quote first
      const quoteData = {
        ...data,
        validUntil: data.validUntil.toISOString(),
        estimatedStartDate: data.estimatedStartDate?.toISOString(),
        estimatedCompletionDate: data.estimatedCompletionDate?.toISOString(),
        subtotal: subtotal.toString(),
        discountedSubtotal: afterDiscount.toString(),
        discountAmount: discountAmount.toString(),
        taxAmount: taxAmount.toString(),
        total: total.toString(),
        // Ensure string values for decimal fields
        discountPercentage: (data.discountPercentage || 0).toString(),
        taxRate: (data.taxRate || 8.5).toString(),
        // Remove undefined fields that might cause validation issues
        lineItems: undefined,
      };
      
      const response = await apiRequest("POST", "/api/quotes", quoteData);
      const quote = await response.json();
      
      // Create line items if any exist
      if (data.lineItems.length > 0) {
        for (const lineItem of data.lineItems) {
          if (lineItem.description && lineItem.quantity > 0) {
            await apiRequest("POST", `/api/quotes/${quote.id}/line-items`, {
              ...lineItem,
              total: lineItem.quantity * lineItem.unitPrice,
            });
          }
        }
      }
      
      return quote;
    },
    onSuccess: () => {
      toast({
        title: "Quote Created",
        description: "Quote with line items has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      onOpenChange(false);
      form.reset({
        downPaymentPercentage: 40,
        milestonePaymentPercentage: 40,
        finalPaymentPercentage: 20,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        taxRate: 8.5,
        taxAmount: 0,
        total: 0,
        isManualTax: false,
        lineItems: [],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateQuoteForm) => {
    createQuoteMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Quote</DialogTitle>
          <DialogDescription>
            Create a comprehensive quote with line items, tax settings, and payment terms
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="lineitems">Line Items</TabsTrigger>
                <TabsTrigger value="financials">Tax & Discounts</TabsTrigger>
                <TabsTrigger value="timeline">Timeline & Terms</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-y-auto mt-4">
                <TabsContent value="basic" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Quote Information</h3>
                      
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quote Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Kitchen Renovation Project" {...field} />
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
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Brief description of the project..."
                                {...field} 
                              />
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
                            <FormControl>
                              <Input placeholder="Landscape Design, Kitchen Remodel, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Customer Information */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Customer Information</h3>
                      
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
                            <FormLabel>Email Address</FormLabel>
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
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="lineitems" className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Line Items</h3>
                    <Button type="button" onClick={addLineItem} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Calculator className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">
                          No line items added yet. Click "Add Item" to start building your quote.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="w-24">Qty</TableHead>
                              <TableHead className="w-32">Unit Price</TableHead>
                              <TableHead className="w-32">Total</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Input
                                    placeholder="Item description"
                                    value={item.description || ''}
                                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    placeholder="Category"
                                    value={item.category || ''}
                                    onChange={(e) => updateLineItem(index, 'category', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.quantity || 0}
                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice || 0}
                                    onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  />
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(item.quantity * item.unitPrice)}
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => removeLineItem(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Subtotal Display */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center text-lg font-medium">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="financials" className="space-y-6">
                  <h3 className="text-lg font-medium">Tax & Discount Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Discount Settings */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Discount</CardTitle>
                        <CardDescription>Apply discounts to the quote</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="discountPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Percentage (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  step="0.01"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    {/* Tax Settings */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Tax</CardTitle>
                        <CardDescription>Configure tax calculations</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={isManualTax}
                            onCheckedChange={(checked) => form.setValue("isManualTax", checked)}
                          />
                          <Label>Manual tax amount</Label>
                        </div>

                        {isManualTax ? (
                          <FormField
                            control={form.control}
                            name="taxAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax Amount ($)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    step="0.01"
                                    placeholder="0.00"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : (
                          <FormField
                            control={form.control}
                            name="taxRate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax Rate (%)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    step="0.01"
                                    placeholder="8.5"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Financial Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Quote Totals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>After Discount:</span>
                        <span>{formatCurrency(afterDiscount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Timeline */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Project Timeline</h3>
                      
                      <FormField
                        control={form.control}
                        name="estimatedStartDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Estimated Start Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="validUntil"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Quote Valid Until</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Payment Schedule */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Payment Schedule</h3>
                      
                      <FormField
                        control={form.control}
                        name="downPaymentPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Down Payment (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
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
                              <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
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
                              <Input 
                                type="number" 
                                min="0" 
                                max="100" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Detailed project description and scope of work..."
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createQuoteMutation.isPending}>
                {createQuoteMutation.isPending ? "Creating..." : "Create Quote"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}