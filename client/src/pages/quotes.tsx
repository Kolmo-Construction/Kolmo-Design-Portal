import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Send, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreateQuoteDialog } from "@/components/quotes/CreateQuoteDialog";
import { QuoteDetailsDialog } from "@/components/quotes/QuoteDetailsDialog";
import { ComprehensiveEditQuoteDialog } from "@/components/quotes/ComprehensiveEditQuoteDialog";
import { apiRequest } from "@/lib/queryClient";
import { QuoteWithDetails } from "@shared/schema";

export default function QuotesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithDetails | null>(null);
  const [editingQuote, setEditingQuote] = useState<QuoteWithDetails | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery<QuoteWithDetails[]>({
    queryKey: ["/api/quotes"],
    retry: false,
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      return await apiRequest(`/api/quotes/${quoteId}/send`, "POST");
    },
    onSuccess: (data) => {
      toast({
        title: "Quote Sent",
        description: "Quote has been sent to customer successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      return await apiRequest(`/api/quotes/${quoteId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Quote Deleted",
        description: "Quote has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive",
      });
    },
  });

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

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quotes</h1>
          <p className="text-gray-600">Manage project quotes and proposals</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Quote
        </Button>
      </div>

      <div className="grid gap-6">
        {quotes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes yet</h3>
                <p className="text-gray-500 mb-4">Get started by creating your first quote</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          quotes.map((quote: QuoteWithDetails) => (
            <Card key={quote.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {quote.quoteNumber}
                      <Badge className={getStatusColor(quote.status)}>
                        {quote.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{quote.title}</CardDescription>
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
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Customer</div>
                    <div className="text-sm">{quote.customerName}</div>
                    <div className="text-sm text-gray-500">{quote.customerEmail}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Project Type</div>
                    <div className="text-sm">{quote.projectType}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Line Items</div>
                    <div className="text-sm">{quote.lineItems?.length || 0} items</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Created</div>
                    <div className="text-sm">{formatDate(quote.createdAt)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQuote(quote)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    {quote.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendQuoteMutation.mutate(quote.id)}
                        disabled={sendQuoteMutation.isPending}
                        className="flex items-center gap-1"
                      >
                        <Send className="h-4 w-4" />
                        Send to Customer
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingQuote(quote)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteQuoteMutation.mutate(quote.id)}
                      disabled={deleteQuoteMutation.isPending}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateQuoteDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {selectedQuote && (
        <QuoteDetailsDialog
          quote={selectedQuote}
          open={!!selectedQuote}
          onOpenChange={(open) => !open && setSelectedQuote(null)}
          onEditQuote={(quote) => {
            setSelectedQuote(null);
            setEditingQuote(quote);
          }}
        />
      )}

      {editingQuote && (
        <ComprehensiveEditQuoteDialog
          quote={editingQuote}
          open={!!editingQuote}
          onOpenChange={(open) => !open && setEditingQuote(null)}
        />
      )}
    </div>
  );
}