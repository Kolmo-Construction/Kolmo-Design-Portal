import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QuoteWithDetails, QuoteLineItem } from "@shared/schema";

interface SimpleEditQuoteDialogProps {
  quote: QuoteWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimpleEditQuoteDialog({ quote, open, onOpenChange }: SimpleEditQuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current quote data to ensure we have the latest
  const { data: currentQuote } = useQuery<QuoteWithDetails>({
    queryKey: [`/api/quotes/${quote.id}`],
    enabled: open && !!quote.id,
  });

  const workingQuote = currentQuote || quote;

  const [activeTab, setActiveTab] = useState("basic");
  const [showCreateLineItem, setShowCreateLineItem] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<QuoteLineItem | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    quoteNumber: "",
    status: "draft",
    validUntil: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    projectType: "",
    location: "",
    scopeDescription: "",
    projectNotes: "",
    estimatedStartDate: "",
    estimatedCompletionDate: "",
    downPaymentPercentage: 0,
    milestonePaymentPercentage: 0,
    finalPaymentPercentage: 0,
    milestoneDescription: "",
  });

  const [financialData, setFinancialData] = useState({
    taxRate: 0,
    discountAmount: 0,
    discountPercentage: 0,
  });

  const [newLineItem, setNewLineItem] = useState({
    description: "",
    quantity: 1,
    unitPrice: 0,
    category: "",
  });

  useEffect(() => {
    if (open && workingQuote) {
      // Helper function to format dates for input fields
      const formatDateForInput = (dateValue: any) => {
        if (!dateValue) return "";
        try {
          const date = new Date(dateValue);
          return date.toISOString().split('T')[0];
        } catch {
          return "";
        }
      };

      setFormData({
        title: workingQuote.title || "",
        description: workingQuote.description || "",
        quoteNumber: workingQuote.quoteNumber || "",
        status: workingQuote.status || "draft",
        validUntil: formatDateForInput(workingQuote.validUntil),
        customerName: workingQuote.customerName || "",
        customerEmail: workingQuote.customerEmail || "",
        customerPhone: workingQuote.customerPhone || "",
        customerAddress: workingQuote.customerAddress || "",
        projectType: workingQuote.projectType || "",
        location: workingQuote.location || "",
        scopeDescription: workingQuote.scopeDescription || "",
        projectNotes: workingQuote.projectNotes || "",
        estimatedStartDate: formatDateForInput(workingQuote.estimatedStartDate),
        estimatedCompletionDate: formatDateForInput(workingQuote.estimatedCompletionDate),
        downPaymentPercentage: workingQuote.downPaymentPercentage || 0,
        milestonePaymentPercentage: workingQuote.milestonePaymentPercentage || 0,
        finalPaymentPercentage: workingQuote.finalPaymentPercentage || 0,
        milestoneDescription: workingQuote.milestoneDescription || "",
      });

      setFinancialData({
        taxRate: Number(workingQuote.taxRate) || 0,
        discountAmount: Number(workingQuote.discountAmount) || 0,
        discountPercentage: Number(workingQuote.discountPercentage) || 0,
      });
    }
  }, [open, workingQuote]);

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: typeof formData & typeof financialData) => {
      return await apiRequest("PATCH", `/api/quotes/${quote.id}`, data);
    },
    onSuccess: (updatedQuote) => {
      toast({
        title: "Quote Updated",
        description: "Quote has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      queryClient.setQueryData([`/api/quotes/${quote.id}`], updatedQuote);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quote",
        variant: "destructive",
      });
    },
  });

  const createLineItemMutation = useMutation({
    mutationFn: async (lineItemData: typeof newLineItem) => {
      return await apiRequest("POST", `/api/quotes/${quote.id}/line-items`, lineItemData);
    },
    onSuccess: () => {
      toast({
        title: "Line Item Added",
        description: "Line item has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setNewLineItem({ description: "", quantity: 1, unitPrice: 0, category: "" });
      setShowCreateLineItem(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add line item",
        variant: "destructive",
      });
    },
  });

  const updateLineItemMutation = useMutation({
    mutationFn: async ({ lineItemId, data }: { lineItemId: number; data: Partial<QuoteLineItem> }) => {
      return await apiRequest("PATCH", `/api/quotes/${quote.id}/line-items/${lineItemId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Line Item Updated",
        description: "Line item has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setEditingLineItem(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update line item",
        variant: "destructive",
      });
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: number) => {
      return await apiRequest("DELETE", `/api/quotes/${quote.id}/line-items/${lineItemId}`);
    },
    onSuccess: () => {
      toast({
        title: "Line Item Deleted",
        description: "Line item has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate payment percentages
    const total = formData.downPaymentPercentage + formData.milestonePaymentPercentage + formData.finalPaymentPercentage;
    if (Math.abs(total - 100) > 0.01) {
      toast({
        title: "Invalid Payment Schedule",
        description: "Payment percentages must add up to 100%",
        variant: "destructive",
      });
      return;
    }
    
    updateQuoteMutation.mutate({ ...formData, ...financialData });
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const projectTypes = [
    "Kitchen Renovation",
    "Bathroom Renovation", 
    "Whole House Renovation",
    "Addition",
    "Deck/Patio",
    "Landscaping",
    "Roofing",
    "Siding",
    "Windows/Doors",
    "Flooring",
    "Painting",
    "Plumbing",
    "Electrical",
    "HVAC",
    "Other"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quote</DialogTitle>
          <DialogDescription>
            Update quote information, customer details, project specifications, and payment terms
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Basic Quote Information */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quoteNumber">Quote Number</Label>
                <Input
                  id="quoteNumber"
                  value={formData.quoteNumber}
                  onChange={(e) => handleInputChange("quoteNumber", e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="validUntil">Valid Until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => handleInputChange("validUntil", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange("customerName", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => handleInputChange("customerEmail", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => handleInputChange("customerPhone", e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="customerAddress">Address</Label>
                <Textarea
                  id="customerAddress"
                  value={formData.customerAddress}
                  onChange={(e) => handleInputChange("customerAddress", e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Project Information */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="projectType">Project Type</Label>
                <Select value={formData.projectType} onValueChange={(value) => handleInputChange("projectType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="estimatedStartDate">Estimated Start Date</Label>
                <Input
                  id="estimatedStartDate"
                  type="date"
                  value={formData.estimatedStartDate}
                  onChange={(e) => handleInputChange("estimatedStartDate", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="estimatedCompletionDate">Estimated Completion Date</Label>
                <Input
                  id="estimatedCompletionDate"
                  type="date"
                  value={formData.estimatedCompletionDate}
                  onChange={(e) => handleInputChange("estimatedCompletionDate", e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="scopeDescription">Project Scope</Label>
                <Textarea
                  id="scopeDescription"
                  value={formData.scopeDescription}
                  onChange={(e) => handleInputChange("scopeDescription", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="projectNotes">Project Notes</Label>
                <Textarea
                  id="projectNotes"
                  value={formData.projectNotes}
                  onChange={(e) => handleInputChange("projectNotes", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="downPaymentPercentage">Down Payment (%)</Label>
                <Input
                  id="downPaymentPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.downPaymentPercentage}
                  onChange={(e) => handleInputChange("downPaymentPercentage", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="milestonePaymentPercentage">Milestone Payment (%)</Label>
                <Input
                  id="milestonePaymentPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.milestonePaymentPercentage}
                  onChange={(e) => handleInputChange("milestonePaymentPercentage", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <Label htmlFor="finalPaymentPercentage">Final Payment (%)</Label>
                <Input
                  id="finalPaymentPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.finalPaymentPercentage}
                  onChange={(e) => handleInputChange("finalPaymentPercentage", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="md:col-span-3">
                <Label htmlFor="milestoneDescription">Milestone Description</Label>
                <Textarea
                  id="milestoneDescription"
                  value={formData.milestoneDescription}
                  onChange={(e) => handleInputChange("milestoneDescription", e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateQuoteMutation.isPending}
            >
              {updateQuoteMutation.isPending ? "Updating..." : "Update Quote"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}