import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Eye, Search, Filter, ExternalLink } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerQuote, QuoteStatus } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import QuoteForm from "@/components/admin/quote-form";

interface QuoteWithDetails extends CustomerQuote {
  lineItems?: any[];
  images?: any[];
}

const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500", 
  viewed: "bg-yellow-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-gray-400"
};

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed", 
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired"
};

export default function CustomerQuotes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithDetails | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all quotes
  const { data: quotes = [], isLoading, error } = useQuery<QuoteWithDetails[]>({
    queryKey: ["/api/admin/quotes"],
  });

  // Delete quote mutation
  const deleteQuoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest({
      url: `/api/admin/quotes/${id}`,
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
      toast({
        title: "Quote deleted",
        description: "The quote has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter quotes based on search and status
  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = 
        quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.projectTitle.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const handleViewQuote = useCallback(async (quote: CustomerQuote) => {
    try {
      const response = await apiRequest(`/api/admin/quotes/${quote.id}`);
      setSelectedQuote(response);
      setIsViewDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load quote details.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleEditQuote = useCallback(async (quote: CustomerQuote) => {
    try {
      const response = await apiRequest(`/api/admin/quotes/${quote.id}`);
      setSelectedQuote(response);
      setIsEditDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to load quote details.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDeleteQuote = useCallback((quote: CustomerQuote) => {
    if (confirm(`Are you sure you want to delete quote ${quote.quoteNumber}?`)) {
      deleteQuoteMutation.mutate(quote.id);
    }
  }, [deleteQuoteMutation]);

  const openCustomerView = useCallback((magicToken: string) => {
    const url = `/quotes/${magicToken}`;
    window.open(url, '_blank');
  }, []);

  const copyMagicLink = useCallback((magicToken: string) => {
    const url = `${window.location.origin}/quotes/${magicToken}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "The quote link has been copied to your clipboard.",
    });
  }, [toast]);

  if (error) {
    return (
      <AdminLayout title="Customer Quotes">
        <div className="text-center py-8">
          <p className="text-red-600">Failed to load quotes. Please try again.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Customer Quotes" 
      description="Manage customer quotes and project estimates"
    >
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Quote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Quote</DialogTitle>
                <DialogDescription>
                  Create a new customer quote with line items and project details.
                </DialogDescription>
              </DialogHeader>
              <QuoteForm 
                onSuccess={() => {
                  setIsCreateDialogOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
                }}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Quotes grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== "all" 
                ? "No quotes match your current filters." 
                : "Get started by creating your first customer quote."
              }
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Quote
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuotes.map((quote) => (
              <Card key={quote.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{quote.quoteNumber}</CardTitle>
                      <CardDescription>{quote.customerName}</CardDescription>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${statusColors[quote.status]} text-white`}
                    >
                      {statusLabels[quote.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm">{quote.projectTitle}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {quote.projectDescription}
                    </p>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(quote.totalAmount))}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{format(new Date(quote.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between gap-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewQuote(quote)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditQuote(quote)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteQuote(quote)}
                        disabled={deleteQuoteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openCustomerView(quote.magicToken)}
                      title="Open customer view"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Quote Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quote Details</DialogTitle>
              <DialogDescription>
                View complete quote information and customer details.
              </DialogDescription>
            </DialogHeader>
            {selectedQuote && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Quote Information</h3>
                    <p className="text-sm text-muted-foreground">Number: {selectedQuote.quoteNumber}</p>
                    <p className="text-sm text-muted-foreground">Status: {statusLabels[selectedQuote.status]}</p>
                    <p className="text-sm text-muted-foreground">
                      Created: {format(new Date(selectedQuote.createdAt), 'PPP')}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Customer Information</h3>
                    <p className="text-sm text-muted-foreground">Name: {selectedQuote.customerName}</p>
                    <p className="text-sm text-muted-foreground">Email: {selectedQuote.customerEmail}</p>
                    {selectedQuote.customerPhone && (
                      <p className="text-sm text-muted-foreground">Phone: {selectedQuote.customerPhone}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium">Project Details</h3>
                  <p className="text-lg">{selectedQuote.projectTitle}</p>
                  <p className="text-sm text-muted-foreground">{selectedQuote.projectDescription}</p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Magic Link</h3>
                  <div className="flex gap-2">
                    <Input 
                      value={`${window.location.origin}/quotes/${selectedQuote.magicToken}`} 
                      readOnly 
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => copyMagicLink(selectedQuote.magicToken)}
                    >
                      Copy
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => openCustomerView(selectedQuote.magicToken)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium">Financial Summary</h3>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Subtotal</p>
                      <p className="font-medium">{formatCurrency(parseFloat(selectedQuote.subtotal))}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tax</p>
                      <p className="font-medium">{formatCurrency(parseFloat(selectedQuote.taxAmount || "0"))}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="font-medium text-lg">{formatCurrency(parseFloat(selectedQuote.totalAmount))}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Quote Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quote</DialogTitle>
              <DialogDescription>
                Update quote information, line items, and project details.
              </DialogDescription>
            </DialogHeader>
            {selectedQuote && (
              <QuoteForm 
                quote={selectedQuote}
                onSuccess={() => {
                  setIsEditDialogOpen(false);
                  setSelectedQuote(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
                }}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setSelectedQuote(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}