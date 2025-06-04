import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Eye, Edit, Trash2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import CreateQuoteDialog from "./create-quote-dialog";
import EditQuoteDialog from "./edit-quote-dialog";
import QuoteDetailsDialog from "./quote-details-dialog";

interface Quote {
  id: number;
  projectType: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  projectTitle: string;
  projectDescription: string;
  projectLocation?: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  validUntil: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerQuotes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading, error } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: async () => {
      const response = await fetch("/api/quotes");
      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/quotes/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete quote",
        variant: "destructive",
      });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/quotes/${id}/send`, {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Success",
        description: "Quote sent to customer successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setDetailsDialogOpen(true);
  };

  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditDialogOpen(true);
  };

  const handleDeleteQuote = (quote: Quote) => {
    if (confirm(`Are you sure you want to delete quote ${quote.quoteNumber}?`)) {
      deleteQuoteMutation.mutate(quote.id);
    }
  };

  const handleSendQuote = (quote: Quote) => {
    if (confirm(`Send quote ${quote.quoteNumber} to ${quote.customerEmail}?`)) {
      sendQuoteMutation.mutate(quote.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "sent": return "bg-blue-100 text-blue-800";
      case "viewed": return "bg-yellow-100 text-yellow-800";
      case "accepted": return "bg-green-100 text-green-800";
      case "declined": return "bg-red-100 text-red-800";
      case "expired": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredQuotes = quotes.filter((quote: Quote) =>
    quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading quotes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">
            Manage and track customer quotes
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Quote
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="text-lg font-medium">No quotes found</div>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "Try adjusting your search" : "Get started by creating your first quote"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Quote
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredQuotes.map((quote: Quote) => (
            <Card key={quote.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    Quote #{quote.quoteNumber}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status.toUpperCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewQuote(quote)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditQuote(quote)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {quote.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendQuote(quote)}
                      disabled={sendQuoteMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteQuote(quote)}
                    disabled={deleteQuoteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-muted-foreground">Customer</div>
                    <div>{quote.customerName}</div>
                    <div className="text-muted-foreground">{quote.customerEmail}</div>
                  </div>
                  <div>
                    <div className="font-medium text-muted-foreground">Project</div>
                    <div>{quote.projectTitle}</div>
                    <div className="text-muted-foreground">{quote.projectType}</div>
                  </div>
                  <div>
                    <div className="font-medium text-muted-foreground">Total Amount</div>
                    <div className="text-lg font-semibold">
                      ${parseFloat(quote.totalAmount).toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">
                      Valid until {new Date(quote.validUntil).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateQuoteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
        }}
      />

      <EditQuoteDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        quote={selectedQuote}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
        }}
      />

      <QuoteDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        quote={selectedQuote}
      />
    </div>
  );
}