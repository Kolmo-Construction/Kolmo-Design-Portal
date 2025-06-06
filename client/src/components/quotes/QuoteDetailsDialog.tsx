import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Upload, Download, Eye } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QuoteWithDetails, QuoteLineItem } from "@shared/schema";
import { CreateLineItemDialog } from "./CreateLineItemDialog";
import { EditLineItemDialog } from "./EditLineItemDialog";

interface QuoteDetailsDialogProps {
  quote: QuoteWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailsDialog({ quote, open, onOpenChange }: QuoteDetailsDialogProps) {
  const [showCreateLineItem, setShowCreateLineItem] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<QuoteLineItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery({
    queryKey: [`/api/quotes/${quote.id}/line-items`],
    enabled: !!quote.id,
    retry: false,
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: number) => {
      return await apiRequest(`/api/quotes/line-items/${lineItemId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Line Item Deleted",
        description: "Line item has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}/line-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete line item",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
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
    return `${baseUrl}/quotes/${quote.accessToken}`;
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
                  {quote.quoteNumber}
                  <Badge className={getStatusColor(quote.status)}>
                    {quote.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{quote.title}</DialogDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(quote.total)}
                </div>
                <div className="text-sm text-gray-500">
                  Valid until {formatDate(quote.validUntil)}
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
                    <div>{quote.customerName}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Email</div>
                    <div>{quote.customerEmail}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Phone</div>
                    <div>{quote.customerPhone || "Not provided"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Address</div>
                    <div>{quote.customerAddress || "Not provided"}</div>
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
                    <div>{quote.projectType}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Location</div>
                    <div>{quote.location || "Not specified"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Estimated Start</div>
                    <div>{quote.estimatedStartDate ? formatDate(quote.estimatedStartDate) : "TBD"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Estimated Completion</div>
                    <div>{quote.estimatedCompletionDate ? formatDate(quote.estimatedCompletionDate) : "TBD"}</div>
                  </div>
                </div>
                {quote.scopeDescription && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">Project Scope</div>
                    <div className="text-sm">{quote.scopeDescription}</div>
                  </div>
                )}
                {quote.projectNotes && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">Project Notes</div>
                    <div className="text-sm">{quote.projectNotes}</div>
                  </div>
                )}
              </CardContent>
            </Card>

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
                        <TableHead>Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item: QuoteLineItem) => (
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
                <CardTitle>Quote Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({(parseFloat(quote.taxRate.toString()) * 100).toFixed(2)}%)</span>
                    <span>{formatCurrency(quote.taxAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(quote.total)}</span>
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
                    <span>Down Payment ({quote.downPaymentPercentage}%)</span>
                    <span>{formatCurrency((parseFloat(quote.total.toString()) * (quote.downPaymentPercentage || 0)) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Milestone Payment ({quote.milestonePaymentPercentage}%)</span>
                    <span>{formatCurrency((parseFloat(quote.total.toString()) * (quote.milestonePaymentPercentage || 0)) / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Final Payment ({quote.finalPaymentPercentage}%)</span>
                    <span>{formatCurrency((parseFloat(quote.total.toString()) * (quote.finalPaymentPercentage || 0)) / 100)}</span>
                  </div>
                  {quote.milestoneDescription && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-500 mb-1">Milestone Description</div>
                      <div className="text-sm">{quote.milestoneDescription}</div>
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
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-gray-50 rounded text-sm font-mono break-all">
                    {generateQuoteLink()}
                  </div>
                  <Button onClick={copyQuoteLink} variant="outline">
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
              </CardContent>
            </Card>
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
    </>
  );
}