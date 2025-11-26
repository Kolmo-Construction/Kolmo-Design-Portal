import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Send, Edit, Trash2, Eye, ArrowLeft, Home, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QuoteViewDialog } from "@/components/quotes/QuoteViewDialog";
import { apiRequest } from "@/lib/queryClient";
import { QuoteWithDetails } from "@shared/schema";
import { theme } from "@/config/theme";

export default function QuotesPage() {
  const [viewingQuote, setViewingQuote] = useState<QuoteWithDetails | null>(null);
  const [, navigate] = useLocation();
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
    onSuccess: () => {
      toast({
        title: "Quote Sent",
        description: "Quote has been sent to customer successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      console.log(`[quotes.tsx] Attempting to delete quote ${quoteId}`);
      try {
        const result = await apiRequest("DELETE", `/api/quotes/${quoteId}`);
        console.log(`[quotes.tsx] Delete response:`, result);
        return result;
      } catch (error) {
        console.error(`[quotes.tsx] Delete error:`, error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log(`[quotes.tsx] Quote deleted successfully`);
      toast({
        title: "Quote Deleted",
        description: "Quote has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error) => {
      console.error(`[quotes.tsx] Delete mutation error:`, error);
      toast({
        title: "Error",
        description: `Failed to delete quote: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    },
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "draft":
        return { backgroundColor: theme.colors.surfaceLight, color: theme.colors.textDark };
      case "sent":
        return { backgroundColor: theme.colors.secondary, color: "white" };
      case "pending":
        return { backgroundColor: "#fef3c7", color: "#92400e" };
      case "accepted":
        return { backgroundColor: "#dcfce7", color: "#166534" };
      case "declined":
        return { backgroundColor: "#fee2e2", color: "#991b1b" };
      case "expired":
        return { backgroundColor: "#f3f4f6", color: "#6b7280" };
      default:
        return { backgroundColor: theme.colors.surfaceLight, color: theme.colors.textDark };
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
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
          <Button
            variant="ghost"
            size="sm"
            style={{ color: theme.colors.textMuted }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="text-sm" style={{ color: theme.colors.textMuted }}>
          <Link href="/" className="hover:underline">
            <Home className="h-4 w-4 inline mr-1" />
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span style={{ color: theme.colors.primary }}>Quotes</span>
        </div>
      </div>

      {/* Header with single Create button */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: theme.colors.primary }}>
            Quotes
          </h1>
          <p style={{ color: theme.colors.textMuted }}>
            Manage project quotes and proposals
          </p>
        </div>
        <Button
          onClick={() => navigate("/quotes/create")}
          className="text-white"
          style={{ backgroundColor: theme.colors.accent }}
          data-testid="button-create-quote"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Quote
        </Button>
      </div>

      {/* Quotes List - Compact Table View */}
      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <FileText className="h-16 w-16 mx-auto mb-4" style={{ color: theme.colors.border }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: theme.colors.primary }}>
                No quotes yet
              </h3>
              <p className="mb-6" style={{ color: theme.colors.textMuted }}>
                Get started by creating your first quote
              </p>
              <Button
                onClick={() => navigate("/quotes/create")}
                className="text-white"
                style={{ backgroundColor: theme.colors.accent }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Quote
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surfaceLight }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: theme.colors.textMuted }}>Quote</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: theme.colors.textMuted }}>Customer</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: theme.colors.textMuted }}>Status</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: theme.colors.textMuted }}>Amount</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: theme.colors.textMuted }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote: QuoteWithDetails) => (
                  <tr key={quote.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div style={{ color: theme.colors.primary }}>{quote.quoteNumber}</div>
                      <div className="text-xs" style={{ color: theme.colors.textMuted }}>{quote.title}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{quote.customerName}</div>
                      <div className="text-xs" style={{ color: theme.colors.textMuted }}>{quote.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge style={getStatusStyle(quote.status)}>
                        {quote.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: theme.colors.accent }}>
                      {formatCurrency(quote.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewingQuote(quote)}
                          title="View"
                          data-testid={`button-view-${quote.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                          title="Edit"
                          data-testid={`button-edit-${quote.id}`}
                          style={{ color: theme.colors.secondary }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {quote.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => sendQuoteMutation.mutate(quote.id)}
                            disabled={sendQuoteMutation.isPending}
                            title="Send"
                            data-testid={`button-send-${quote.id}`}
                            style={{ color: theme.colors.accent }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this quote?")) {
                              deleteQuoteMutation.mutate(quote.id);
                            }
                          }}
                          disabled={deleteQuoteMutation.isPending}
                          title="Delete"
                          data-testid={`button-delete-${quote.id}`}
                          style={{ color: "#ef4444" }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* View-only Quote Dialog */}
      {viewingQuote && (
        <QuoteViewDialog
          quote={viewingQuote}
          open={!!viewingQuote}
          onOpenChange={(open) => !open && setViewingQuote(null)}
          onEdit={() => {
            const quoteId = viewingQuote.id;
            setViewingQuote(null);
            navigate(`/quotes/${quoteId}/edit`);
          }}
        />
      )}
    </div>
  );
}
