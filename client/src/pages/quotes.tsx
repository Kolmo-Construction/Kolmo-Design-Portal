import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Send, Edit, Trash2, Eye, ArrowLeft, Home } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CreateQuoteDialog } from "@/components/quotes/CreateQuoteDialog";
import { QuoteDetailsDialog } from "@/components/quotes/QuoteDetailsDialog";
import { QuickQuoteForm } from "@/components/quotes/QuickQuoteForm";
import { apiRequest } from "@/lib/queryClient";
import { QuoteWithDetails } from "@shared/schema";
import { theme } from "@/config/theme";

export default function QuotesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithDetails | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery<QuoteWithDetails[]>({
    queryKey: ["/api/quotes"],
    retry: false,
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      return await apiRequest("POST", `/api/quotes/${quoteId}/send`);
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
      console.log("Attempting to delete quote:", quoteId);
      const response = await apiRequest("DELETE", `/api/quotes/${quoteId}`);
      console.log("Delete response:", response);
      return response;
    },
    onSuccess: () => {
      console.log("Quote deleted successfully");
      toast({
        title: "Quote Deleted",
        description: "Quote has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error) => {
      console.error("Delete quote error:", error);
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return `bg-gray-100 text-gray-700`;
      case "sent":
        return `text-white`;
      case "pending":
        return `bg-amber-100 text-amber-700`;
      case "accepted":
        return `bg-green-100 text-green-700`;
      case "declined":
        return `bg-red-100 text-red-700`;
      case "expired":
        return `bg-gray-100 text-gray-600`;
      default:
        return `bg-slate-100 text-slate-700`;
    }
  };

  const getStatusBgColor = (status: string) => {
    if (status === "sent") return theme.colors.secondary;
    return undefined;
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
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-700">
            <Home className="h-4 w-4 inline mr-1" />
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-900">Quotes</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: theme.colors.primary }}>
            Quotes
          </h1>
          <p style={{ color: theme.colors.textMuted }}>Manage project quotes and proposals</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowQuickForm(!showQuickForm)}
            className="flex items-center gap-2"
            style={{ backgroundColor: theme.colors.accent }}
          >
            <Plus className="h-4 w-4" />
            Quick Quote
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            className="flex items-center gap-2"
            style={{ borderColor: theme.colors.secondary, color: theme.colors.secondary }}
          >
            <Plus className="h-4 w-4" />
            Full Quote
          </Button>
        </div>
      </div>

      {/* Quick Quote Form */}
      {showQuickForm && (
        <QuickQuoteForm onSuccess={() => setShowQuickForm(false)} />
      )}

      <div className="grid gap-6">
        {quotes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes yet</h3>
                <p className="text-gray-500 mb-4">Get started by creating your first quote</p>
                <Button
                  onClick={() => setShowQuickForm(true)}
                  style={{ backgroundColor: theme.colors.accent }}
                  className="text-white"
                >
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
                    <CardTitle
                    className="flex items-center gap-2"
                    style={{ color: theme.colors.primary }}
                  >
                    {quote.quoteNumber}
                    <Badge
                      className={getStatusColor(quote.status)}
                      style={{ backgroundColor: getStatusBgColor(quote.status) }}
                    >
                      {quote.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription style={{ color: theme.colors.textMuted }}>
                    {quote.title}
                  </CardDescription>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-2xl font-bold"
                      style={{ color: theme.colors.accent }}
                    >
                      {formatCurrency(quote.total)}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Valid until {formatDate(quote.validUntil.toString())}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Customer
                    </div>
                    <div className="text-sm">{quote.customerName}</div>
                    <div
                      className="text-sm"
                      style={{ color: theme.colors.textMuted }}
                    >
                      {quote.customerEmail}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Project Type
                    </div>
                    <div className="text-sm">{quote.projectType}</div>
                  </div>
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Line Items
                    </div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: theme.colors.accent }}
                    >
                      {quote.lineItems?.length || 0} items
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Created
                    </div>
                    <div className="text-sm">{formatDate(quote.createdAt.toString())}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQuote(quote)}
                      className="flex items-center gap-1"
                      style={{ borderColor: theme.colors.secondary, color: theme.colors.secondary }}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    {quote.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => sendQuoteMutation.mutate(quote.id)}
                        disabled={sendQuoteMutation.isPending}
                        className="flex items-center gap-1 text-white"
                        style={{ backgroundColor: theme.colors.accent }}
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
                      onClick={() => setSelectedQuote(quote)}
                      className="flex items-center gap-1"
                      style={{ borderColor: theme.colors.secondary, color: theme.colors.secondary }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteQuoteMutation.mutate(quote.id)}
                      disabled={deleteQuoteMutation.isPending}
                      className="flex items-center gap-1"
                      style={{ borderColor: "#ef4444", color: "#ef4444" }}
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
        />
      )}
    </div>
  );
}