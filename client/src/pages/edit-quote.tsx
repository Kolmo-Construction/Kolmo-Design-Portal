import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  FileText,
  DollarSign,
  Image,
  Plus,
  Edit,
  Trash2,
  Calculator,
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { QuoteWithDetails, QuoteLineItem } from "@shared/schema";
import { theme } from "@/config/theme";
import { formatCurrency } from "@/lib/utils";
import { CreateLineItemDialog } from "@/components/quotes/CreateLineItemDialog";
import { EditLineItemDialog } from "@/components/quotes/EditLineItemDialog";
import { QuoteFinancialsDialog } from "@/components/quotes/QuoteFinancialsDialog";
import { QuoteImageManager } from "@/components/quotes/QuoteImageManager";
import { QuotePhotoGallery } from "@/components/quotes/QuotePhotoGallery";

const editQuoteSchema = z.object({
  title: z.string().min(1, "Quote title is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  scopeDescription: z.string().optional(),
  projectNotes: z.string().optional(),
});

type EditQuoteFormData = z.infer<typeof editQuoteSchema>;

export default function EditQuotePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteId = parseInt(id || "0");

  const [showCreateLineItem, setShowCreateLineItem] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<QuoteLineItem | null>(null);
  const [showFinancials, setShowFinancials] = useState(false);

  const { data: quote, isLoading: quoteLoading } = useQuery<QuoteWithDetails>({
    queryKey: [`/api/quotes/${quoteId}`],
    enabled: !!quoteId,
    retry: false,
  });

  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery<QuoteLineItem[]>({
    queryKey: [`/api/quotes/${quoteId}/line-items`],
    enabled: !!quoteId,
    retry: false,
  });

  const form = useForm<EditQuoteFormData>({
    resolver: zodResolver(editQuoteSchema),
    values: quote
      ? {
          title: quote.title,
          customerName: quote.customerName,
          customerEmail: quote.customerEmail,
          customerPhone: quote.customerPhone || "",
          customerAddress: quote.customerAddress || "",
          projectType: quote.projectType,
          location: quote.location || "",
          scopeDescription: quote.scopeDescription || "",
          projectNotes: quote.projectNotes || "",
        }
      : undefined,
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: EditQuoteFormData) => {
      return await apiRequest("PATCH", `/api/quotes/${quoteId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Quote Updated",
        description: "Quote details have been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update quote",
        variant: "destructive",
      });
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: number) => {
      return await apiRequest("DELETE", `/api/quotes/line-items/${lineItemId}`);
    },
    onSuccess: () => {
      toast({
        title: "Line Item Deleted",
        description: "Line item has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/line-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete line item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditQuoteFormData) => {
    updateQuoteMutation.mutate(data);
  };

  if (quoteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.surfaceLight }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.colors.accent }} />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.surfaceLight }}>
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
            <p className="text-gray-500 mb-4">The quote you're looking for doesn't exist.</p>
            <Link href="/quotes">
              <Button>Back to Quotes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.surfaceLight }}>
      {/* Header */}
      <div style={{ backgroundColor: theme.colors.primary }} className="py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/quotes")}
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Edit Quote</h1>
              <p className="text-gray-200">{quote.quoteNumber} - {quote.title}</p>
            </div>
            <div className="text-right text-white">
              <div className="text-2xl font-bold">{formatCurrency(quote.total)}</div>
              <div className="text-sm opacity-75">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content with Tabs */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Details</span>
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Line Items</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financials</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Images</span>
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Customer Information */}
                <Card>
                  <CardHeader>
                    <CardTitle style={{ color: theme.colors.primary }}>
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-customer-name" />
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
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-customer-email" />
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
                            <Input {...field} data-testid="input-customer-phone" />
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
                            <Input {...field} data-testid="input-customer-address" />
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
                    <CardTitle style={{ color: theme.colors.primary }}>
                      Project Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quote Title *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-quote-title" />
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
                            <FormLabel>Project Type *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-project-type" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scopeDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scope Description</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              className="min-h-24"
                              data-testid="input-scope"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="projectNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              className="min-h-24"
                              data-testid="input-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateQuoteMutation.isPending}
                    className="text-white"
                    style={{ backgroundColor: theme.colors.accent }}
                    data-testid="button-save-details"
                  >
                    {updateQuoteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Details
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Line Items Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle style={{ color: theme.colors.primary }}>Line Items</CardTitle>
                  <Button
                    onClick={() => setShowCreateLineItem(true)}
                    className="text-white"
                    style={{ backgroundColor: theme.colors.accent }}
                    data-testid="button-add-line-item"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lineItemsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </div>
                ) : lineItems.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: theme.colors.border }} />
                    <p className="text-gray-500 mb-4">No line items yet</p>
                    <Button
                      onClick={() => setShowCreateLineItem(true)}
                      className="text-white"
                      style={{ backgroundColor: theme.colors.accent }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Line Item
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>
                            {parseFloat(item.quantity.toString())} {item.unit}
                          </TableCell>
                          <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingLineItem(item)}
                                data-testid={`button-edit-item-${item.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Delete this line item?")) {
                                    deleteLineItemMutation.mutate(item.id);
                                  }
                                }}
                                style={{ borderColor: "#ef4444", color: "#ef4444" }}
                                data-testid={`button-delete-item-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle style={{ color: theme.colors.primary }}>Quote Financials</CardTitle>
                  <Button
                    onClick={() => setShowFinancials(true)}
                    variant="outline"
                    style={{ borderColor: theme.colors.secondary, color: theme.colors.secondary }}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Edit Financials
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surfaceLight }}>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>Subtotal</div>
                      <div className="text-xl font-semibold">{formatCurrency(quote.subtotal || "0")}</div>
                    </div>
                    <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surfaceLight }}>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        Tax ({quote.taxRate ? parseFloat(quote.taxRate.toString()).toFixed(2) : 0}%)
                      </div>
                      <div className="text-xl font-semibold">{formatCurrency(quote.taxAmount || "0")}</div>
                    </div>
                  </div>

                  {quote.discountAmount && parseFloat(quote.discountAmount.toString()) > 0 && (
                    <div className="p-4 rounded-lg border border-green-200 bg-green-50">
                      <div className="text-sm text-green-700">
                        Discount
                        {quote.discountPercentage && parseFloat(quote.discountPercentage.toString()) > 0 &&
                          ` (${parseFloat(quote.discountPercentage.toString())}%)`
                        }
                      </div>
                      <div className="text-xl font-semibold text-green-700">
                        -{formatCurrency(quote.discountAmount)}
                      </div>
                    </div>
                  )}

                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: theme.getColorWithOpacity(theme.colors.accent, 0.1) }}
                  >
                    <div className="text-sm" style={{ color: theme.colors.accent }}>Total</div>
                    <div className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
                      {formatCurrency(quote.total)}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-semibold mb-3" style={{ color: theme.colors.primary }}>
                      Payment Schedule
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.surfaceLight }}>
                        <div className="text-xs" style={{ color: theme.colors.textMuted }}>Down Payment</div>
                        <div className="font-semibold">{quote.downPaymentPercentage || 0}%</div>
                        <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                          {formatCurrency((parseFloat(quote.total?.toString() || "0") * parseFloat((quote.downPaymentPercentage ?? 0).toString())) / 100)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.surfaceLight }}>
                        <div className="text-xs" style={{ color: theme.colors.textMuted }}>Milestone</div>
                        <div className="font-semibold">{quote.milestonePaymentPercentage || 0}%</div>
                        <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                          {formatCurrency((parseFloat(quote.total?.toString() || "0") * parseFloat((quote.milestonePaymentPercentage ?? 0).toString())) / 100)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.surfaceLight }}>
                        <div className="text-xs" style={{ color: theme.colors.textMuted }}>Final</div>
                        <div className="font-semibold">{quote.finalPaymentPercentage || 0}%</div>
                        <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                          {formatCurrency((parseFloat(quote.total?.toString() || "0") * parseFloat((quote.finalPaymentPercentage ?? 0).toString())) / 100)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-6">
            <QuoteImageManager
              quoteId={quote.id}
              beforeImageUrl={quote.beforeImageUrl || undefined}
              afterImageUrl={quote.afterImageUrl || undefined}
              beforeImageCaption={quote.beforeImageCaption || undefined}
              afterImageCaption={quote.afterImageCaption || undefined}
              onImagesUpdated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
              }}
            />
            <QuotePhotoGallery
              quoteId={quote.id}
              onPhotosUpdated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}`] });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateLineItemDialog
        quoteId={quoteId}
        open={showCreateLineItem}
        onOpenChange={setShowCreateLineItem}
      />

      {editingLineItem && (
        <EditLineItemDialog
          lineItem={editingLineItem}
          open={!!editingLineItem}
          onOpenChange={(open) => !open && setEditingLineItem(null)}
        />
      )}

      <QuoteFinancialsDialog
        quote={quote}
        open={showFinancials}
        onOpenChange={setShowFinancials}
      />
    </div>
  );
}
