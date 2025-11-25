import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { 
  ArrowLeft, ArrowRight, Check, User, FileText, DollarSign, Loader2,
  Plus, Trash2, Package, Image, Calculator, Percent, Pencil, Save, X, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { theme } from "@/config/theme";
import { formatCurrency, formatPhoneNumber } from "@/lib/utils";

interface LineItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  total: number;
}

const createQuoteSchema = z.object({
  title: z.string().min(1, "Quote title is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerCity: z.string().optional(),
  customerState: z.string().optional(),
  customerZip: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).default(8.5),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountValue: z.coerce.number().min(0).max(100).default(0),
  downPaymentPercentage: z.coerce.number().min(0).max(100).default(40),
  milestonePaymentPercentage: z.coerce.number().min(0).max(100).default(40),
  finalPaymentPercentage: z.coerce.number().min(0).max(100).default(20),
  validDays: z.coerce.number().min(1).max(365).default(30),
});

type CreateQuoteFormData = z.infer<typeof createQuoteSchema>;

const steps = [
  { id: 1, title: "Customer", icon: User },
  { id: 2, title: "Project", icon: FileText },
  { id: 3, title: "Line Items", icon: Package },
  { id: 4, title: "Financials", icon: Calculator },
  { id: 5, title: "Notes", icon: Image },
  { id: 6, title: "Review", icon: Check },
];

const CATEGORIES = [
  "Labor",
  "Materials",
  "Equipment",
  "Permits",
  "Design",
  "Demolition",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Finishing",
  "Other",
];

const UNITS = [
  "hours",
  "days",
  "sq ft",
  "linear ft",
  "units",
  "lump sum",
  "each",
];

export default function CreateQuotePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<LineItem>>({});
  const [newItem, setNewItem] = useState<Partial<LineItem>>({
    category: "",
    description: "",
    quantity: 1,
    unit: "units",
    unitPrice: 0,
    discountPercentage: 0,
    discountAmount: 0,
  });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Tax rate lookup state
  const [suggestedTaxRate, setSuggestedTaxRate] = useState<number | null>(null);
  const [taxLookupLoading, setTaxLookupLoading] = useState(false);
  const [suggestedTaxAccepted, setSuggestedTaxAccepted] = useState(false);

  const form = useForm<CreateQuoteFormData>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      title: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      customerCity: "",
      customerState: "WA",
      customerZip: "",
      projectType: "",
      location: "",
      description: "",
      notes: "",
      taxRate: 8.5,
      discountType: "percentage",
      discountValue: 0,
      downPaymentPercentage: 40,
      milestonePaymentPercentage: 40,
      finalPaymentPercentage: 20,
      validDays: 30,
    },
  });

  const formValues = form.watch();

  const calculateTotals = useCallback(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    
    let discountAmount = 0;
    if (formValues.discountType === "percentage") {
      discountAmount = subtotal * (formValues.discountValue / 100);
    } else {
      discountAmount = formValues.discountValue;
    }
    
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (formValues.taxRate / 100);
    const total = afterDiscount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total };
  }, [lineItems, formValues.discountType, formValues.discountValue, formValues.taxRate]);

  const totals = calculateTotals();

  const calculateLineItemTotal = (quantity: number, unitPrice: number, discountPercentage: number, discountAmount: number): number => {
    const subtotal = quantity * unitPrice;
    let discount = 0;
    if (discountPercentage > 0) {
      discount = subtotal * (discountPercentage / 100);
    } else {
      discount = discountAmount;
    }
    return subtotal - discount;
  };

  const lookupTaxRate = useCallback(async (street: string, city: string, zip: string) => {
    if (!street || street.trim().length < 3) {
      console.log("[Tax Lookup] Address too short, clearing suggestion");
      setSuggestedTaxRate(null);
      return;
    }

    console.log("[Tax Lookup] Starting lookup for:", { street, city, zip });
    setTaxLookupLoading(true);
    try {
      // Call backend endpoint with separated address components
      const response = await apiRequest("POST", "/api/quotes/lookup/tax-rate", { 
        address: street.trim(),
        city: city.trim(),
        zip: zip.trim()
      });
      
      console.log("[Tax Lookup] Response received:", response);
      
      if (response && response.taxRate) {
        console.log("[Tax Lookup] Setting suggested rate:", response.taxRate);
        setSuggestedTaxRate(response.taxRate);
      } else {
        console.log("[Tax Lookup] No rate in response");
        setSuggestedTaxRate(null);
      }
    } catch (error) {
      console.error("Tax rate lookup error:", error);
      // Don't set to null on error - keep trying to show something
      setSuggestedTaxRate(8.5); // Default WA rate
    } finally {
      setTaxLookupLoading(false);
    }
  }, []);

  // Auto-lookup tax rate when address changes and we're on the financials step
  useEffect(() => {
    console.log("[Tax Lookup] useEffect triggered - currentStep:", currentStep);
    if (currentStep === 4 && formValues.customerAddress && formValues.customerCity && formValues.customerZip) {
      console.log("[Tax Lookup] Conditions met, triggering lookup");
      setSuggestedTaxAccepted(false); // Reset acceptance flag when address changes
      lookupTaxRate(formValues.customerAddress, formValues.customerCity, formValues.customerZip);
    }
  }, [currentStep, formValues.customerAddress, formValues.customerCity, formValues.customerZip, lookupTaxRate]);

  const addLineItem = () => {
    if (!newItem.category || !newItem.description || !newItem.unitPrice) {
      toast({
        title: "Missing Information",
        description: "Please fill in category, description, and unit price",
        variant: "destructive",
      });
      return;
    }

    const subtotal = (newItem.quantity || 1) * newItem.unitPrice!;
    const discountAmount = (newItem.discountPercentage || 0) > 0 
      ? subtotal * ((newItem.discountPercentage || 0) / 100)
      : (newItem.discountAmount || 0);

    const item: LineItem = {
      id: `temp-${Date.now()}`,
      category: newItem.category!,
      description: newItem.description!,
      quantity: newItem.quantity || 1,
      unit: newItem.unit || "units",
      unitPrice: newItem.unitPrice!,
      discountPercentage: newItem.discountPercentage || 0,
      discountAmount: discountAmount,
      total: subtotal - discountAmount,
    };

    setLineItems([...lineItems, item]);
    setNewItem({
      category: "",
      description: "",
      quantity: 1,
      unit: "units",
      unitPrice: 0,
      discountPercentage: 0,
      discountAmount: 0,
    });
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const startEditing = (item: LineItem) => {
    setEditingId(item.id);
    setEditingItem({ ...item });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingItem({});
  };

  const saveEditing = () => {
    if (!editingItem.category || !editingItem.description || !editingItem.unitPrice) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLineItems(lineItems.map(item => {
      if (item.id === editingId) {
        const subtotal = (editingItem.quantity || 1) * (editingItem.unitPrice || 0);
        const discountAmount = (editingItem.discountPercentage || 0) > 0 
          ? subtotal * ((editingItem.discountPercentage || 0) / 100)
          : (editingItem.discountAmount || 0);
        
        return {
          ...item,
          category: editingItem.category!,
          description: editingItem.description!,
          quantity: editingItem.quantity || 1,
          unit: editingItem.unit || "units",
          unitPrice: editingItem.unitPrice!,
          discountPercentage: editingItem.discountPercentage || 0,
          discountAmount: discountAmount,
          total: subtotal - discountAmount,
        };
      }
      return item;
    }));
    setEditingId(null);
    setEditingItem({});
  };

  const paymentTotal = formValues.downPaymentPercentage + formValues.milestonePaymentPercentage + formValues.finalPaymentPercentage;
  const isPaymentValid = paymentTotal === 100;

  const createQuoteMutation = useMutation({
    mutationFn: async (data: CreateQuoteFormData) => {
      const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
      
      const response = await apiRequest("POST", "/api/quotes", {
        title: data.title,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        customerAddress: data.customerAddress || null,
        projectType: data.projectType,
        location: data.location || null,
        description: data.description || null,
        notes: data.notes || null,
        subtotal,
        discountPercentage: data.discountType === "percentage" ? data.discountValue : 0,
        discountAmount,
        taxRate: data.taxRate,
        taxAmount,
        total,
        downPaymentPercentage: data.downPaymentPercentage,
        milestonePaymentPercentage: data.milestonePaymentPercentage,
        finalPaymentPercentage: data.finalPaymentPercentage,
        validUntil: new Date(Date.now() + data.validDays * 24 * 60 * 60 * 1000),
        lineItems: lineItems.map(item => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountPercentage: item.discountPercentage,
          discountAmount: item.discountAmount,
          total: item.total,
        })),
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Quote Created Successfully!",
        description: `Quote ${data.quoteNumber} has been created with ${lineItems.length} line items.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate(`/quotes/${data.id}/edit`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const validateStep = async (step: number) => {
    let fieldsToValidate: (keyof CreateQuoteFormData)[] = [];
    
    if (step === 1) {
      fieldsToValidate = ["customerName", "customerEmail"];
    } else if (step === 2) {
      fieldsToValidate = ["title", "projectType"];
    } else if (step === 4) {
      fieldsToValidate = ["taxRate", "discountValue", "downPaymentPercentage", "milestonePaymentPercentage", "finalPaymentPercentage"];
    }
    // Step 3, 5, and 6 don't require form validation (no required fields beyond what's already filled)

    if (fieldsToValidate.length === 0) {
      return true; // No validation needed for this step
    }

    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const nextStep = async (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: CreateQuoteFormData) => {
    if (!isPaymentValid) {
      toast({
        title: "Invalid Payment Schedule",
        description: "Payment percentages must total 100%",
        variant: "destructive",
      });
      return;
    }
    createQuoteMutation.mutate(data);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.surfaceLight }}>
      {/* Header */}
      <div style={{ backgroundColor: theme.colors.primary }} className="py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/quotes")}
            className="text-white hover:bg-white/10 mb-4"
            data-testid="button-back-to-quotes"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>
          <h1 className="text-2xl font-bold text-white">Create New Quote</h1>
          <p className="text-gray-200">Complete all steps to create a professional quote</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 -mt-4">
        <Card className="shadow-lg">
          <CardContent className="py-4">
            <div className="flex items-center justify-between overflow-x-auto">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        currentStep >= step.id
                          ? "text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                      style={{
                        backgroundColor: currentStep >= step.id ? theme.colors.accent : undefined,
                      }}
                      onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                    >
                      {currentStep > step.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <step.icon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className="text-xs mt-1 font-medium hidden sm:block"
                      style={{ color: currentStep >= step.id ? theme.colors.primary : theme.colors.textMuted }}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className="w-8 sm:w-16 h-0.5 mx-1"
                      style={{
                        backgroundColor: currentStep > step.id ? theme.colors.accent : theme.colors.border,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Step 1: Customer Info */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle style={{ color: theme.colors.primary }}>
                    Customer Information
                  </CardTitle>
                  <CardDescription>
                    Enter the customer's contact details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Smith"
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
                        <FormLabel>Email Address *</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(555) 123-4567"
                            {...field}
                            onChange={(e) => {
                              const formatted = formatPhoneNumber(e.target.value);
                              field.onChange(formatted);
                            }}
                            data-testid="input-customer-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <h4 className="font-medium mb-3" style={{ color: theme.colors.primary }}>
                      Project Address (for tax rate lookup)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 6500 Linderson Way"
                                {...field}
                                data-testid="input-customer-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customerCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Tumwater"
                                {...field}
                                data-testid="input-customer-city"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customerState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="WA"
                                maxLength={2}
                                {...field}
                                data-testid="input-customer-state"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="customerZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 98501"
                                {...field}
                                data-testid="input-customer-zip"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Project Details */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle style={{ color: theme.colors.primary }}>
                    Project Details
                  </CardTitle>
                  <CardDescription>
                    Describe the project you're quoting
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quote Title *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Kitchen Renovation"
                            {...field}
                            data-testid="input-quote-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="projectType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-project-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Residential">Residential</SelectItem>
                              <SelectItem value="Commercial">Commercial</SelectItem>
                              <SelectItem value="Remodel">Remodel</SelectItem>
                              <SelectItem value="New Construction">New Construction</SelectItem>
                              <SelectItem value="Addition">Addition</SelectItem>
                              <SelectItem value="Repair">Repair</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Location</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Backyard, Kitchen"
                              {...field}
                              data-testid="input-location"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add details about the project scope, special requirements..."
                            className="min-h-24"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step 3: Line Items */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle style={{ color: theme.colors.primary }}>
                      Line Items
                    </CardTitle>
                    <CardDescription>
                      Add all services, materials, and costs for this quote
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add New Item Form */}
                    <div
                      className="p-4 rounded-lg border"
                      style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceLight }}
                    >
                      <h4 className="font-medium mb-3" style={{ color: theme.colors.primary }}>
                        Add New Item
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="text-sm font-medium">Category *</label>
                          <Select
                            value={newItem.category}
                            onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                          >
                            <SelectTrigger data-testid="select-item-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">Description *</label>
                          <Input
                            placeholder="e.g., Cabinet installation labor"
                            value={newItem.description || ""}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            data-testid="input-item-description"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Quantity</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newItem.quantity || ""}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                            data-testid="input-item-quantity"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Unit</label>
                          <Select
                            value={newItem.unit}
                            onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
                          >
                            <SelectTrigger data-testid="select-item-unit">
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((unit) => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Unit Price ($) *</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newItem.unitPrice || ""}
                            onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                            data-testid="input-item-unit-price"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Discount (%)</label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0"
                            value={newItem.discountPercentage || ""}
                            onChange={(e) => setNewItem({ ...newItem, discountPercentage: parseFloat(e.target.value) || 0, discountAmount: 0 })}
                            data-testid="input-item-discount-percent"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <div className="text-sm space-y-1">
                          <div style={{ color: theme.colors.textMuted }}>
                            Subtotal: <span className="font-semibold" style={{ color: theme.colors.primary }}>
                              {formatCurrency((newItem.quantity || 0) * (newItem.unitPrice || 0))}
                            </span>
                          </div>
                          {(newItem.discountPercentage || 0) > 0 && (
                            <div style={{ color: 'rgb(34, 197, 94)' }}>
                              Discount: <span className="font-semibold">-{formatCurrency(((newItem.quantity || 0) * (newItem.unitPrice || 0)) * ((newItem.discountPercentage || 0) / 100))}</span>
                            </div>
                          )}
                          <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                            Line Total: <span className="font-semibold" style={{ color: theme.colors.primary }}>
                              {formatCurrency(calculateLineItemTotal(newItem.quantity || 0, newItem.unitPrice || 0, newItem.discountPercentage || 0, newItem.discountAmount || 0))}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={addLineItem}
                          style={{ backgroundColor: theme.colors.accent }}
                          className="text-white"
                          data-testid="button-add-line-item"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                    </div>

                    {/* Line Items List */}
                    {lineItems.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden" style={{ borderColor: theme.colors.border }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ backgroundColor: theme.colors.surfaceLight }}>
                              <th className="text-left p-3 font-medium">Category</th>
                              <th className="text-left p-3 font-medium">Description</th>
                              <th className="text-right p-3 font-medium">Qty</th>
                              <th className="text-left p-3 font-medium">Unit</th>
                              <th className="text-right p-3 font-medium">Unit Price</th>
                              <th className="text-right p-3 font-medium">Discount</th>
                              <th className="text-right p-3 font-medium">Total</th>
                              <th className="p-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item, index) => (
                              <tr
                                key={item.id}
                                className="border-t"
                                style={{ borderColor: theme.colors.border }}
                              >
                                {editingId === item.id ? (
                                  <>
                                    <td className="p-2">
                                      <Select
                                        value={editingItem.category}
                                        onValueChange={(value) => setEditingItem({ ...editingItem, category: value })}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {CATEGORIES.map((cat) => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="p-2">
                                      <Input
                                        className="h-8 text-xs"
                                        value={editingItem.description || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <Input
                                        type="number"
                                        className="h-8 text-xs w-16 text-right"
                                        value={editingItem.quantity || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 0 })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <Select
                                        value={editingItem.unit}
                                        onValueChange={(value) => setEditingItem({ ...editingItem, unit: value })}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {UNITS.map((u) => (
                                            <SelectItem key={u} value={u}>{u}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="p-2">
                                      <Input
                                        type="number"
                                        className="h-8 text-xs w-20 text-right"
                                        value={editingItem.unitPrice || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, unitPrice: parseFloat(e.target.value) || 0 })}
                                      />
                                    </td>
                                    <td className="p-2">
                                      <Input
                                        type="number"
                                        className="h-8 text-xs w-16 text-right"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        placeholder="0%"
                                        value={editingItem.discountPercentage || ""}
                                        onChange={(e) => setEditingItem({ ...editingItem, discountPercentage: parseFloat(e.target.value) || 0, discountAmount: 0 })}
                                      />
                                    </td>
                                    <td className="p-2 text-right font-medium text-xs">
                                      {formatCurrency(calculateLineItemTotal(editingItem.quantity || 0, editingItem.unitPrice || 0, editingItem.discountPercentage || 0, editingItem.discountAmount || 0))}
                                    </td>
                                    <td className="p-2">
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={saveEditing}
                                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 w-7 p-0"
                                          data-testid={`button-save-item-${index}`}
                                        >
                                          <Save className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={cancelEditing}
                                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 h-7 w-7 p-0"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-3">{item.category}</td>
                                    <td className="p-3">{item.description}</td>
                                    <td className="p-3 text-right">{item.quantity}</td>
                                    <td className="p-3">{item.unit}</td>
                                    <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                                    <td className="p-3 text-right">
                                      {item.discountPercentage > 0 ? (
                                        <span style={{ color: 'rgb(34, 197, 94)' }}>-{item.discountPercentage}%</span>
                                      ) : (
                                        <span style={{ color: theme.colors.textMuted }}>—</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-medium">{formatCurrency(item.total)}</td>
                                    <td className="p-3">
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditing(item)}
                                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-7 w-7 p-0"
                                          data-testid={`button-edit-item-${index}`}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeLineItem(item.id)}
                                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                                          data-testid={`button-remove-item-${index}`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: theme.colors.surfaceLight }}>
                              <td colSpan={5} className="p-3 text-right font-semibold">
                                Subtotal:
                              </td>
                              <td className="p-3"></td>
                              <td className="p-3 text-right font-bold" style={{ color: theme.colors.primary }}>
                                {formatCurrency(totals.subtotal)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div
                        className="text-center py-12 rounded-lg border-2 border-dashed"
                        style={{ borderColor: theme.colors.border }}
                      >
                        <Package className="h-12 w-12 mx-auto mb-4" style={{ color: theme.colors.textMuted }} />
                        <p style={{ color: theme.colors.textMuted }}>
                          No line items added yet
                        </p>
                        <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
                          Add services, materials, and costs above
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 4: Financials */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle style={{ color: theme.colors.primary }}>
                    Financial Settings
                  </CardTitle>
                  <CardDescription>
                    Configure discounts, taxes, and payment schedule
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Discount & Tax Section */}
                  <div>
                    <h4 className="font-medium mb-4" style={{ color: theme.colors.primary }}>
                      Discounts & Taxes
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="discountType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-discount-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="discountValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Discount {formValues.discountType === "percentage" ? "%" : "$"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max={formValues.discountType === "percentage" ? "100" : undefined}
                                step="0.01"
                                {...field}
                                data-testid="input-discount-value"
                              />
                            </FormControl>
                            <FormDescription>
                              {formValues.discountType === "percentage" && "Maximum 100%"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="taxRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Rate (%)</FormLabel>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <FormControl className="flex-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    {...field}
                                    data-testid="input-tax-rate"
                                  />
                                </FormControl>
                                {taxLookupLoading && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="px-3"
                                  >
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </Button>
                                )}
                              </div>
                              {suggestedTaxRate !== null && !suggestedTaxAccepted && (
                                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: theme.getColorWithOpacity(theme.colors.secondary, 0.1) }}>
                                  <span className="text-sm" style={{ color: theme.colors.secondary }}>
                                    <strong>Suggested: {suggestedTaxRate.toFixed(2)}%</strong> based on customer address
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      form.setValue("taxRate", suggestedTaxRate);
                                      setSuggestedTaxAccepted(true);
                                    }}
                                    className="text-xs"
                                    style={{ color: theme.colors.secondary }}
                                    data-testid="button-apply-suggested-tax"
                                  >
                                    Apply
                                  </Button>
                                </div>
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Payment Schedule */}
                  <div>
                    <h4 className="font-medium mb-4" style={{ color: theme.colors.primary }}>
                      Payment Schedule
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                data-testid="input-down-payment"
                              />
                            </FormControl>
                            <FormDescription>
                              {formatCurrency(totals.total * (formValues.downPaymentPercentage / 100))}
                            </FormDescription>
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
                                data-testid="input-milestone-payment"
                              />
                            </FormControl>
                            <FormDescription>
                              {formatCurrency(totals.total * (formValues.milestonePaymentPercentage / 100))}
                            </FormDescription>
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
                                data-testid="input-final-payment"
                              />
                            </FormControl>
                            <FormDescription>
                              {formatCurrency(totals.total * (formValues.finalPaymentPercentage / 100))}
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {paymentTotal !== 100 && (
                      <div
                        className="mt-4 p-3 rounded-lg"
                        style={{
                          backgroundColor: paymentTotal === 100 
                            ? theme.getColorWithOpacity(theme.colors.secondary, 0.1)
                            : theme.getColorWithOpacity('#ef4444', 0.1),
                        }}
                      >
                        <p className="text-sm font-medium" style={{ color: paymentTotal === 100 ? theme.colors.secondary : '#ef4444' }}>
                          Payment percentages total: {paymentTotal}% 
                          {paymentTotal !== 100 && " (should equal 100%)"}
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Quote Validity */}
                  <FormField
                    control={form.control}
                    name="validDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quote Valid For (Days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            {...field}
                            className="max-w-32"
                            data-testid="input-valid-days"
                          />
                        </FormControl>
                        <FormDescription>
                          Quote will expire on {new Date(Date.now() + formValues.validDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Totals Preview */}
                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: theme.colors.surfaceLight }}
                  >
                    <h4 className="font-medium mb-3" style={{ color: theme.colors.primary }}>
                      Quote Totals Preview
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal ({lineItems.length} items):</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                      </div>
                      {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount:</span>
                          <span>-{formatCurrency(totals.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Tax ({formValues.taxRate}%):</span>
                        <span>{formatCurrency(totals.taxAmount)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold" style={{ color: theme.colors.primary }}>
                        <span>Total:</span>
                        <span>{formatCurrency(totals.total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Notes */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle style={{ color: theme.colors.primary }}>
                    Additional Notes
                  </CardTitle>
                  <CardDescription>
                    Add any terms, conditions, or additional information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes & Terms</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any special terms, conditions, payment instructions, or notes for the customer..."
                            className="min-h-48"
                            {...field}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormDescription>
                          These notes will appear on the quote sent to the customer
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div
                    className="p-4 rounded-lg border-l-4"
                    style={{ 
                      backgroundColor: theme.getColorWithOpacity(theme.colors.secondary, 0.1),
                      borderLeftColor: theme.colors.secondary 
                    }}
                  >
                    <h4 className="font-medium mb-2" style={{ color: theme.colors.secondary }}>
                      About Images
                    </h4>
                    <p className="text-sm" style={{ color: theme.colors.textDark }}>
                      You can add before/after images and design proposals after creating the quote.
                      Go to the Edit page to upload photos and create design comparisons for your customer.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle style={{ color: theme.colors.primary }}>
                      Review Your Quote
                    </CardTitle>
                    <CardDescription>
                      Review all details before creating the quote
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Customer Summary */}
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: theme.colors.surfaceLight }}
                    >
                      <h4 className="font-semibold mb-3 flex items-center" style={{ color: theme.colors.primary }}>
                        <User className="h-4 w-4 mr-2" />
                        Customer
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span style={{ color: theme.colors.textMuted }}>Name:</span>
                          <p className="font-medium">{formValues.customerName}</p>
                        </div>
                        <div>
                          <span style={{ color: theme.colors.textMuted }}>Email:</span>
                          <p className="font-medium">{formValues.customerEmail}</p>
                        </div>
                        <div>
                          <span style={{ color: theme.colors.textMuted }}>Phone:</span>
                          <p className="font-medium">{formValues.customerPhone || "-"}</p>
                        </div>
                        <div>
                          <span style={{ color: theme.colors.textMuted }}>Address:</span>
                          <p className="font-medium">{formValues.customerAddress || "-"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Project Summary */}
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: theme.colors.surfaceLight }}
                    >
                      <h4 className="font-semibold mb-3 flex items-center" style={{ color: theme.colors.primary }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Project
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span style={{ color: theme.colors.textMuted }}>Title:</span>
                          <p className="font-medium">{formValues.title}</p>
                        </div>
                        <div>
                          <span style={{ color: theme.colors.textMuted }}>Type:</span>
                          <p className="font-medium">{formValues.projectType}</p>
                        </div>
                        <div className="col-span-2">
                          <span style={{ color: theme.colors.textMuted }}>Location:</span>
                          <p className="font-medium">{formValues.location || "-"}</p>
                        </div>
                      </div>
                      {formValues.description && (
                        <div className="mt-3">
                          <span className="text-sm" style={{ color: theme.colors.textMuted }}>
                            Description:
                          </span>
                          <p className="text-sm mt-1">{formValues.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Line Items Summary */}
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: theme.colors.surfaceLight }}
                    >
                      <h4 className="font-semibold mb-3 flex items-center" style={{ color: theme.colors.primary }}>
                        <Package className="h-4 w-4 mr-2" />
                        Line Items ({lineItems.length})
                      </h4>
                      {lineItems.length > 0 ? (
                        <div className="space-y-2">
                          {lineItems.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: theme.colors.border }}>
                              <span>
                                <span className="font-medium">{item.category}</span> - {item.description}
                                <span style={{ color: theme.colors.textMuted }}> ({item.quantity} {item.unit})</span>
                              </span>
                              <span className="font-medium">{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                          No line items added - you can add them after creating the quote
                        </p>
                      )}
                    </div>

                    {/* Financial Summary */}
                    <div
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: theme.colors.surfaceLight }}
                    >
                      <h4 className="font-semibold mb-3 flex items-center" style={{ color: theme.colors.primary }}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Financial Summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        {totals.discountAmount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount ({formValues.discountType === "percentage" ? `${formValues.discountValue}%` : "Fixed"}):</span>
                            <span>-{formatCurrency(totals.discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Tax ({formValues.taxRate}%):</span>
                          <span>{formatCurrency(totals.taxAmount)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold" style={{ color: theme.colors.accent }}>
                          <span>Total:</span>
                          <span>{formatCurrency(totals.total)}</span>
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 rounded" style={{ backgroundColor: theme.getColorWithOpacity(theme.colors.primary, 0.1) }}>
                          <div className="font-medium">Down Payment</div>
                          <div className="text-lg font-bold" style={{ color: theme.colors.primary }}>
                            {formatCurrency(totals.total * (formValues.downPaymentPercentage / 100))}
                          </div>
                          <div className="text-xs" style={{ color: theme.colors.textMuted }}>{formValues.downPaymentPercentage}%</div>
                        </div>
                        <div className="text-center p-2 rounded" style={{ backgroundColor: theme.getColorWithOpacity(theme.colors.secondary, 0.1) }}>
                          <div className="font-medium">Milestone</div>
                          <div className="text-lg font-bold" style={{ color: theme.colors.secondary }}>
                            {formatCurrency(totals.total * (formValues.milestonePaymentPercentage / 100))}
                          </div>
                          <div className="text-xs" style={{ color: theme.colors.textMuted }}>{formValues.milestonePaymentPercentage}%</div>
                        </div>
                        <div className="text-center p-2 rounded" style={{ backgroundColor: theme.getColorWithOpacity(theme.colors.accent, 0.1) }}>
                          <div className="font-medium">Final</div>
                          <div className="text-lg font-bold" style={{ color: theme.colors.accent }}>
                            {formatCurrency(totals.total * (formValues.finalPaymentPercentage / 100))}
                          </div>
                          <div className="text-xs" style={{ color: theme.colors.textMuted }}>{formValues.finalPaymentPercentage}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                      Quote valid for {formValues.validDays} days (until {new Date(Date.now() + formValues.validDays * 24 * 60 * 60 * 1000).toLocaleDateString()})
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => prevStep(e)}
                disabled={currentStep === 1}
                style={{ borderColor: theme.colors.secondary, color: theme.colors.secondary }}
                data-testid="button-previous-step"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep < 6 ? (
                <Button
                  type="button"
                  onClick={(e) => nextStep(e)}
                  className="text-white"
                  style={{ backgroundColor: theme.colors.accent }}
                  data-testid="button-next-step"
                >
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createQuoteMutation.isPending}
                  className="text-white"
                  style={{ backgroundColor: theme.colors.accent }}
                  data-testid="button-create-quote"
                >
                  {createQuoteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Quote...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create Quote
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
