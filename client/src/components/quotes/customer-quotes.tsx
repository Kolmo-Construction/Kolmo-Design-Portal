import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Eye, Edit2, Trash2, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerQuote } from "@shared/schema";
import { CreateQuoteDialog } from "./create-quote-dialog";
import { EditQuoteDialog } from "./edit-quote-dialog";
import { QuoteDetailsDialog } from "./quote-details-dialog";

interface QuoteWithDetails extends CustomerQuote {
  lineItems?: any[];
  images?: any[];
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800", 
  viewed: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-800"
};

const statusIcons = {
  draft: Clock,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle,
  declined: XCircle,
  expired: Clock
};

export default function CustomerQuotes() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<CustomerQuote | null>(null);
  const [viewingQuote, setViewingQuote] = useState<QuoteWithDetails | null>(null);
  const [deleteConfirmQuote, setDeleteConfirmQuote] = useState<CustomerQuote | null>(null);
  const { toast } = useToast();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: () => apiRequest("/api/quotes")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/quotes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote deleted successfully" });
      setDeleteConfirmQuote(null);
    },
    onError: () => {
      toast({ title: "Failed to delete quote", variant: "destructive" });
    }
  });

  const handleViewQuote = useCallback(async (quote: CustomerQuote) => {
    try {
      const quoteWithDetails = await apiRequest(`/api/quotes/${quote.id}`);
      setViewingQuote(quoteWithDetails);
    } catch (error) {
      toast({ title: "Failed to load quote details", variant: "destructive" });
    }
  }, [toast]);

  const handleEditQuote = useCallback(async (quote: CustomerQuote) => {
    try {
      const quoteWithDetails = await apiRequest(`/api/quotes/${quote.id}`);
      setEditingQuote(quoteWithDetails);
    } catch (error) {
      toast({ title: "Failed to load quote details", variant: "destructive" });
    }
  }, [toast]);

  const handleDeleteQuote = useCallback((quote: CustomerQuote) => {
    setDeleteConfirmQuote(quote);
  }, []);

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const copyQuoteLink = useCallback((quote: CustomerQuote) => {
    const url = `${window.location.origin}/quote/${quote.magicToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Quote link copied to clipboard" });
  }, [toast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Quotes</h1>
          <p className="text-gray-600">Manage and track customer project quotes</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Quote
        </Button>
      </div>

      <div className="grid gap-4">
        {quotes?.map((quote: CustomerQuote) => {
          const StatusIcon = statusIcons[quote.status as keyof typeof statusIcons];
          
          return (
            <Card key={quote.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {quote.quoteNumber}
                      </h3>
                      <Badge className={statusColors[quote.status as keyof typeof statusColors]}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-gray-700 font-medium">{quote.customerName}</p>
                    <p className="text-gray-600">{quote.customerEmail}</p>
                    <p className="text-gray-600 text-sm mt-1">{quote.projectTitle}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {formatCurrency(quote.totalAmount)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Valid until {formatDate(quote.validUntil)}
                    </div>
                    {quote.viewedAt && (
                      <div className="text-xs text-green-600 mt-1">
                        Viewed {formatDate(quote.viewedAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Created {formatDate(quote.createdAt)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyQuoteLink(quote)}
                    >
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewQuote(quote)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditQuote(quote)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteQuote(quote)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!quotes || quotes.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Plus className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first customer quote to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Create Quote
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Quote Dialog */}
      <CreateQuoteDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Edit Quote Dialog */}
      {editingQuote && (
        <EditQuoteDialog
          quote={editingQuote}
          open={!!editingQuote}
          onOpenChange={(open) => !open && setEditingQuote(null)}
        />
      )}

      {/* Quote Details Dialog */}
      {viewingQuote && (
        <QuoteDetailsDialog
          quote={viewingQuote}
          open={!!viewingQuote}
          onOpenChange={(open) => !open && setViewingQuote(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmQuote && (
        <Dialog open={!!deleteConfirmQuote} onOpenChange={() => setDeleteConfirmQuote(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Quote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Are you sure you want to delete quote "{deleteConfirmQuote.quoteNumber}"?</p>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirmQuote(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(deleteConfirmQuote.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete Quote
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}