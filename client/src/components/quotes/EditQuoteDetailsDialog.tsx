import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QuoteWithDetails } from "@shared/schema";

interface EditQuoteDetailsDialogProps {
  quote: QuoteWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Milestone {
  id?: number;
  description: string;
  percentage: number;
  order: number;
}

export function EditQuoteDetailsDialog({ quote, open, onOpenChange }: EditQuoteDetailsDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [location, setLocation] = useState("");
  const [estimatedStartDate, setEstimatedStartDate] = useState("");
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open && quote) {
      setCustomerName(quote.customerName || "");
      setCustomerEmail(quote.customerEmail || "");
      setCustomerPhone(quote.customerPhone || "");
      setCustomerAddress(quote.customerAddress || "");
      setTitle(quote.title || "");
      setDescription(quote.description || "");
      setProjectType(quote.projectType || "");
      setLocation(quote.location || "");
      setEstimatedStartDate(quote.estimatedStartDate ? new Date(quote.estimatedStartDate).toISOString().split('T')[0] : "");
      setEstimatedCompletionDate(quote.estimatedCompletionDate ? new Date(quote.estimatedCompletionDate).toISOString().split('T')[0] : "");
      setValidUntil(quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : "");
      setScopeDescription(quote.scopeDescription || "");
      setProjectNotes(quote.projectNotes || "");
      
      // Initialize milestones from quote data
      const quoteMilestones: Milestone[] = [];
      
      // Always include all three payment phases, even if they are 0
      // Check if quote has any payment structure defined
      const hasPaymentStructure = quote.downPaymentPercentage !== undefined || 
                                  quote.milestonePaymentPercentage !== undefined || 
                                  quote.finalPaymentPercentage !== undefined;
      
      if (hasPaymentStructure) {
        // Use actual values from the quote, including 0 values
        quoteMilestones.push({ 
          description: "Down Payment", 
          percentage: Number(quote.downPaymentPercentage || 0), 
          order: 1 
        });
        
        quoteMilestones.push({ 
          description: quote.milestoneDescription || "Mid-project Milestone", 
          percentage: Number(quote.milestonePaymentPercentage || 0), 
          order: 2 
        });
        
        quoteMilestones.push({ 
          description: "Final Payment", 
          percentage: Number(quote.finalPaymentPercentage || 0), 
          order: 3 
        });
      } else {
        // If no payment structure exists, set defaults
        quoteMilestones.push(
          { description: "Down Payment", percentage: 40, order: 1 },
          { description: "Mid-project Milestone", percentage: 40, order: 2 },
          { description: "Final Payment", percentage: 20, order: 3 }
        );
      }
      
      setMilestones(quoteMilestones);
    }
  }, [open, quote]);

  const updateQuoteMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return await apiRequest("/api/quotes/" + quote.id, "PATCH", updatedData);
    },
    onSuccess: () => {
      toast({
        title: "Quote Updated",
        description: "Quote details have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quote details",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Validate required fields
    if (!customerName.trim() || !customerEmail.trim() || !title.trim() || !projectType.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Customer Name, Email, Title, Project Type)",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validate milestone percentages add up to 100
    const totalPercentage = milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast({
        title: "Validation Error",
        description: `Milestone percentages must add up to 100%. Current total: ${totalPercentage}%`,
        variant: "destructive",
      });
      return;
    }

    const updatedData = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || null,
      customerAddress: customerAddress.trim() || null,
      title: title.trim(),
      description: description.trim() || null,
      projectType: projectType.trim(),
      location: location.trim() || null,
      estimatedStartDate: estimatedStartDate || null,
      estimatedCompletionDate: estimatedCompletionDate || null,
      validUntil: validUntil || null,
      scopeDescription: scopeDescription.trim() || null,
      projectNotes: projectNotes.trim() || null,
      downPaymentPercentage: milestones.find(m => m.order === 1)?.percentage || 0,
      milestonePaymentPercentage: milestones.find(m => m.order === 2)?.percentage || 0,
      finalPaymentPercentage: milestones.find(m => m.order === 3)?.percentage || 0,
      milestoneDescription: milestones.find(m => m.order === 2)?.description || null,
    };

    updateQuoteMutation.mutate(updatedData);
  };

  const addMilestone = () => {
    const newOrder = Math.max(...milestones.map(m => m.order), 0) + 1;
    setMilestones([...milestones, { description: "New Milestone", percentage: 0, order: newOrder }]);
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string | number) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const totalMilestonePercentage = milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quote Details</DialogTitle>
          <DialogDescription>
            Update customer information, project details, and milestone structure
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email Address *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone Number</Label>
                  <Input
                    id="customerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="customerAddress">Project Address</Label>
                  <Input
                    id="customerAddress"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="123 Main St, City, State 12345"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Information */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Project Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter project title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="projectType">Project Type *</Label>
                  <Input
                    id="projectType"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    placeholder="e.g., Kitchen Remodel, Bathroom Renovation"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Project location"
                  />
                </div>
                <div>
                  <Label htmlFor="validUntil">Quote Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedStartDate">Estimated Start Date</Label>
                  <Input
                    id="estimatedStartDate"
                    type="date"
                    value={estimatedStartDate}
                    onChange={(e) => setEstimatedStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedCompletionDate">Estimated Completion Date</Label>
                  <Input
                    id="estimatedCompletionDate"
                    type="date"
                    value={estimatedCompletionDate}
                    onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Project Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the project"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="scopeDescription">Project Scope</Label>
                <Textarea
                  id="scopeDescription"
                  value={scopeDescription}
                  onChange={(e) => setScopeDescription(e.target.value)}
                  placeholder="Detailed scope of work"
                  rows={4}
                />
              </div>
              
              <div>
                <Label htmlFor="projectNotes">Project Notes</Label>
                <Textarea
                  id="projectNotes"
                  value={projectNotes}
                  onChange={(e) => setProjectNotes(e.target.value)}
                  placeholder="Additional notes or special requirements"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Milestones */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Payment Milestones</CardTitle>
                  <CardDescription>
                    Define payment schedule and milestones. Total must equal 100%.
                    Current total: <span className={totalMilestonePercentage === 100 ? "text-green-600" : "text-red-600"}>{totalMilestonePercentage}%</span>
                  </CardDescription>
                </div>
                <Button onClick={addMilestone} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Milestone
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {milestones.map((milestone, index) => (
                  <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <Label>Milestone Description</Label>
                      <Input
                        value={milestone.description}
                        onChange={(e) => updateMilestone(index, "description", e.target.value)}
                        placeholder="e.g., Down Payment, Mid-project Milestone"
                      />
                    </div>
                    <div className="w-32">
                      <Label>Percentage</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={milestone.percentage}
                        onChange={(e) => updateMilestone(index, "percentage", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    {milestones.length > 1 && (
                      <Button
                        onClick={() => removeMilestone(index)}
                        size="sm"
                        variant="outline"
                        className="mb-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateQuoteMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateQuoteMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}