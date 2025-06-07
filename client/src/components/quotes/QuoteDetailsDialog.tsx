import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Upload, Download, Eye, Mail, Copy, ExternalLink, Calculator, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate, formatCurrency } from "@/lib/utils";
import { QuoteWithDetails, QuoteLineItem } from "@shared/schema";
import { CreateLineItemDialog } from "./CreateLineItemDialog";
import { EditLineItemDialog } from "./EditLineItemDialog";
import { QuoteFinancialsDialog } from "./QuoteFinancialsDialog";
import { EditQuoteDetailsDialog } from "./EditQuoteDetailsDialog";
import { QuoteImageManager } from "./QuoteImageManager";

interface QuoteDetailsDialogProps {
  quote: QuoteWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailsDialog({ quote, open, onOpenChange }: QuoteDetailsDialogProps) {
  const [showCreateLineItem, setShowCreateLineItem] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<QuoteLineItem | null>(null);
  const [showSendQuote, setShowSendQuote] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [showEditQuote, setShowEditQuote] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the latest quote data to ensure we have up-to-date financials
  const { data: freshQuote, isLoading: quoteLoading } = useQuery<QuoteWithDetails>({
    queryKey: [`/api/quotes/${quote.id}`],
    enabled: !!quote.id && open,
    retry: false,
    initialData: quote, // Use the prop as initial data
  });

  // Use the fresh quote data or fall back to the prop
  const currentQuote = freshQuote || quote;

  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery<QuoteLineItem[]>({
    queryKey: [`/api/quotes/${quote.id}/line-items`],
    enabled: !!quote.id,
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}/line-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete line item",
        variant: "destructive",
      });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (emailData: { customerEmail: string; customerName: string }) => {
      return await apiRequest(`/api/quotes/${quote.id}/send`, "POST", emailData);
    },
    onSuccess: () => {
      toast({
        title: "Quote Sent",
        description: "Quote has been sent to customer successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setShowSendQuote(false);
      setCustomerEmail("");
      setCustomerName("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const handleSendQuote = () => {
    if (!customerEmail || !customerName) {
      toast({
        title: "Missing Information",
        description: "Please provide both customer name and email",
        variant: "destructive",
      });
      return;
    }
    sendQuoteMutation.mutate({ customerEmail, customerName });
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "accepted": return "bg-green-100 text-green-800";
      case "declined": return "bg-red-100 text-red-800";
      case "expired": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const generateQuoteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/quote/${quote.accessToken}`;
  };

  const copyQuoteLink = async () => {
    try {
      await navigator.clipboard.writeText(generateQuoteLink());
      toast({
        title: "Link Copied",
        description: "Quote link has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {currentQuote.quoteNumber}
                  <Badge className={getStatusColor(currentQuote.status)}>
                    {currentQuote.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{currentQuote.title}</DialogDescription>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => setShowEditQuote(true)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Edit Quote Details
                </Button>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(currentQuote.total)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Valid until {formatDate(currentQuote.validUntil)}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Name</div>
                    <div>{currentQuote.customerName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Email</div>
                    <div>{currentQuote.customerEmail}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Phone</div>
                    <div>{currentQuote.customerPhone || "Not provided"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Address</div>
                    <div>{currentQuote.customerAddress || "Not provided"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Information */}
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Project Type</div>
                    <div>{currentQuote.projectType}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Location</div>
                    <div>{currentQuote.location || "Not specified"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Estimated Start</div>
                    <div>{currentQuote.estimatedStartDate ? formatDate(currentQuote.estimatedStartDate) : "TBD"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Estimated Completion</div>
                    <div>{currentQuote.estimatedCompletionDate ? formatDate(currentQuote.estimatedCompletionDate) : "TBD"}</div>
                  </div>
                </div>
                {currentQuote.scopeDescription && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">Project Scope</div>
                    <div className="text-sm">{currentQuote.scopeDescription}</div>
                  </div>
                )}
                {currentQuote.projectNotes && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">Project Notes</div>
                    <div className="text-sm">{currentQuote.projectNotes}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Before/After Images Management */}
            <QuoteImageManager
              quoteId={currentQuote.id}
              beforeImageUrl={currentQuote.beforeImageUrl || undefined}
              afterImageUrl={currentQuote.afterImageUrl || undefined}
              beforeImageCaption={currentQuote.beforeImageCaption || undefined}
              afterImageCaption={currentQuote.afterImageCaption || undefined}
              onImagesUpdated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/quotes/${currentQuote.id}`] });
              }}
            />

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Line Items</CardTitle>
                  <Button
                    onClick={() => setShowCreateLineItem(true)}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Line Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lineItemsLoading ? (
                  <div className="text-center py-4">Loading line items...</div>
                ) : lineItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 mb-4">No line items yet</div>
                    <Button onClick={() => setShowCreateLineItem(true)}>
                      Add First Line Item
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Discount</TableHead>
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
                          <TableCell>
                            {item.discountPercentage && parseFloat(item.discountPercentage.toString()) > 0 ? (
                              <span className="text-green-600">
                                {parseFloat(item.discountPercentage.toString())}%
                              </span>
                            ) : item.discountAmount && parseFloat(item.discountAmount.toString()) > 0 ? (
                              <span className="text-green-600">
                                -{formatCurrency(item.discountAmount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingLineItem(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteLineItemMutation.mutate(item.id)}
                                disabled={deleteLineItemMutation.isPending}
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

            {/* Quote Summary */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Quote Summary</CardTitle>
                  <Button
                    onClick={() => setShowFinancials(true)}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    Manage Financials
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(currentQuote.subtotal || "0")}</span>
                  </div>
                  
                  {/* Show discount if any */}
                  {(currentQuote.discountAmount && parseFloat(currentQuote.discountAmount.toString()) > 0) && (
                    <div className="flex justify-between text-red-600">
                      <span>
                        Discount
                        {currentQuote.discountPercentage && parseFloat(currentQuote.discountPercentage.toString()) > 0 && 
                          ` (${parseFloat(currentQuote.discountPercentage.toString())}%)`
                        }
                      </span>
                      <span>-{formatCurrency(currentQuote.discountAmount)}</span>
                    </div>
                  )}
                  
                  {/* Show discounted subtotal if there's a discount */}
                  {(currentQuote.discountAmount && parseFloat(currentQuote.discountAmount.toString()) > 0) && (
                    <div className="flex justify-between">
                      <span>Discounted Subtotal</span>
                      <span>{formatCurrency(currentQuote.discountedSubtotal || "0")}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span>
                      Tax 
                      {currentQuote.isManualTax ? " (Manual)" : 
                        currentQuote.taxRate ? ` (${parseFloat(currentQuote.taxRate.toString()).toFixed(2)}%)` : ""
                      }
                    </span>
                    <span>{formatCurrency(currentQuote.taxAmount || "0")}</span>
                  </div>
                  
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(currentQuote.total || "0")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Down Payment ({(currentQuote.downPaymentPercentage ?? 0)}%)</span>
                    <span>{formatCurrency((parseFloat(currentQuote.total?.toString() || "0") * (currentQuote.downPaymentPercentage ?? 0)) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Milestone Payment ({(currentQuote.milestonePaymentPercentage ?? 0)}%)</span>
                    <span>{formatCurrency((parseFloat(currentQuote.total?.toString() || "0") * (currentQuote.milestonePaymentPercentage ?? 0)) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Final Payment ({(currentQuote.finalPaymentPercentage ?? 0)}%)</span>
                    <span>{formatCurrency((parseFloat(currentQuote.total?.toString() || "0") * (currentQuote.finalPaymentPercentage ?? 0)) / 100)}</span>
                  </div>
                  {currentQuote.milestoneDescription && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Milestone Description</div>
                      <div className="text-sm">{currentQuote.milestoneDescription}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Link */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Access</CardTitle>
                <CardDescription>
                  Share this link with your customer to view and respond to the quote
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-gray-50 rounded text-sm font-mono break-all">
                    {generateQuoteLink()}
                  </div>
                  <Button onClick={copyQuoteLink} variant="outline">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button 
                    onClick={() => window.open(generateQuoteLink(), '_blank')}
                    variant="outline"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setShowSendQuote(true)}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Send Quote via Email
                  </Button>
                  <Button 
                    onClick={() => window.open(generateQuoteLink(), '_blank')}
                    variant="outline"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Customer View
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Quote Dialog */}
      <Dialog open={showSendQuote} onOpenChange={setShowSendQuote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quote via Email</DialogTitle>
            <DialogDescription>
              Enter customer details to send the quote link via email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div>
              <Label htmlFor="customerEmail">Customer Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter customer email"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSendQuote(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendQuote}
                disabled={sendQuoteMutation.isPending}
              >
                {sendQuoteMutation.isPending ? "Sending..." : "Send Quote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateLineItemDialog
        quoteId={quote.id}
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
        quote={currentQuote}
        open={showFinancials}
        onOpenChange={setShowFinancials}
      />

      <EditQuoteDetailsDialog
        quote={currentQuote}
        open={showEditQuote}
        onOpenChange={setShowEditQuote}
      />
    </>
  );
}