import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import type { Milestone, Invoice, Project } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  Receipt, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ProjectFinanceTabProps {
  projectId: number;
}

export function ProjectFinanceTab({ projectId }: ProjectFinanceTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingMilestoneId, setLoadingMilestoneId] = useState<number | null>(null);

  const handleViewInvoice = (invoiceId: number) => {
    window.open(`/invoices/${invoiceId}/view`, '_blank');
  };

  const handleDownloadInvoice = async (invoiceId: number, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/invoices/${invoiceId}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the invoice PDF.",
        variant: "destructive",
      });
    }
  };

  // Fetch milestones for the project
  const {
    data: milestones = [],
    isLoading: isLoadingMilestones,
    error: milestonesError,
  } = useQuery<Milestone[]>({
    queryKey: [`/api/projects/${projectId}/milestones`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!projectId,
  });

  // Fetch invoices for the project
  const {
    data: invoices = [],
    isLoading: isLoadingInvoices,
    error: invoicesError,
  } = useQuery<Invoice[]>({
    queryKey: [`/api/projects/${projectId}/invoices`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!projectId,
  });

  // Fetch project data to get total budget
  const {
    data: project,
    isLoading: isLoadingProject,
    error: projectError,
  } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!projectId,
  });

  // Billing mutation for completed milestones
  const billMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: number) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/milestones/${milestoneId}/bill`);
      return response.json();
    },
    onSuccess: (data) => {
      // Check if the API returned a newly created invoice
      if (data && data.invoice) {
        toast({
          title: "Draft Invoice Generated",
          description: `Invoice #${data.invoice.invoiceNumber} was created successfully.`,
        });
      } else {
        // Handle the case where the invoice already existed
        toast({
          title: "Invoice Already Exists",
          description: "A draft invoice for this milestone has already been generated.",
          variant: "default",
        });
      }

      // Always invalidate queries to refresh the UI state
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/milestones`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/invoices`] });
      setLoadingMilestoneId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Billing Failed",
        description: error.message || "Failed to generate invoice",
        variant: "destructive",
      });
      setLoadingMilestoneId(null);
    },
  });

  const handleBillMilestone = (milestoneId: number) => {
    setLoadingMilestoneId(milestoneId);
    billMilestoneMutation.mutate(milestoneId);
  };

  const getMilestoneStatusBadge = (milestone: Milestone) => {
    if (milestone.billedAt) {
      return <Badge className="bg-green-100 text-green-800">Invoiced</Badge>;
    }
    if (milestone.status === 'completed') {
      return <Badge className="bg-blue-100 text-blue-800">Ready to Bill</Badge>;
    }
    if (milestone.status === 'pending') {
      return <Badge variant="outline">Pending</Badge>;
    }
    return <Badge variant="secondary">{milestone.status}</Badge>;
  };

  const getInvoiceStatusBadge = (invoice: Invoice) => {
    switch (invoice.status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      default:
        return <Badge variant="outline">{invoice.status}</Badge>;
    }
  };

  const calculateFinancialSummary = () => {
    const projectBudget = project ? parseFloat(project.totalBudget) : 0;
    
    // Calculate total billable percentage (sum of all billable milestone percentages)
    const totalBillablePercentage = milestones
      .filter(m => m.isBillable)
      .reduce((sum, m) => sum + parseFloat(m.billingPercentage || '0'), 0);
    
    // Calculate total billable amount based on project budget
    const totalBillableAmount = (projectBudget * totalBillablePercentage) / 100;
    
    const totalInvoiced = invoices
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    
    const totalPaid = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    const remainingToInvoice = Math.max(0, totalBillableAmount - totalInvoiced);
    const remainingToPay = Math.max(0, totalInvoiced - totalPaid);

    return { 
      projectBudget,
      totalBillablePercentage, 
      totalBillableAmount,
      totalInvoiced, 
      totalPaid,
      remainingToInvoice,
      remainingToPay
    };
  };

  const { 
    projectBudget,
    totalBillablePercentage, 
    totalBillableAmount,
    totalInvoiced, 
    totalPaid,
    remainingToInvoice,
    remainingToPay
  } = calculateFinancialSummary();

  if (isLoadingMilestones || isLoadingInvoices || isLoadingProject) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (milestonesError || invoicesError || projectError) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load financial data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Budget */}
            <div className="text-center p-4 bg-slate-50 rounded-lg border">
              <div className="text-2xl font-bold text-slate-700">${projectBudget.toFixed(2)}</div>
              <div className="text-sm text-slate-600">Total Project Value</div>
            </div>
            
            {/* Total Billable Amount */}
            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <div className="text-2xl font-bold text-blue-700">${totalBillableAmount.toFixed(2)}</div>
              <div className="text-sm text-blue-600">Total Billable ({totalBillablePercentage.toFixed(1)}%)</div>
            </div>
            
            {/* Total Collected */}
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <div className="text-2xl font-bold text-green-700">${totalPaid.toFixed(2)}</div>
              <div className="text-sm text-green-600">Total Collected</div>
            </div>
            
            {/* Remaining to Collect */}
            <div className="text-center p-4 bg-orange-50 rounded-lg border">
              <div className="text-2xl font-bold text-orange-700">${remainingToPay.toFixed(2)}</div>
              <div className="text-sm text-orange-600">Remaining to Collect</div>
            </div>
          </div>
          
          {/* Additional breakdown */}
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Invoiced:</span>
                <span className="font-medium">${totalInvoiced.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Remaining to Invoice:</span>
                <span className="font-medium">${remainingToInvoice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Milestones & Billing
          </CardTitle>
          <CardDescription>
            Manage milestones and generate invoices for completed work
          </CardDescription>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No milestones found. Milestones are automatically created when you add billable tasks.
            </p>
          ) : (
            <div className="space-y-4">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{milestone.title}</h3>
                        {getMilestoneStatusBadge(milestone)}
                        {milestone.isBillable && (
                          <Badge variant="outline" className="gap-1">
                            <DollarSign className="h-3 w-3" />
                            {milestone.billingPercentage}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{milestone.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(milestone.plannedDate), 'MMM dd, yyyy')}
                        </span>

                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {milestone.status === 'completed' && !milestone.billedAt && milestone.isBillable && (
                        <Button
                          size="sm"
                          onClick={() => handleBillMilestone(milestone.id)}
                          disabled={loadingMilestoneId === milestone.id}
                          className="gap-1"
                        >
                          <Receipt className="h-4 w-4" />
                          {loadingMilestoneId === milestone.id ? "Generating..." : "Generate Invoice"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>
            Track all invoices generated for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No invoices generated yet. Complete milestones to generate invoices.
            </p>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">Invoice #{invoice.invoiceNumber}</h3>
                        {getInvoiceStatusBadge(invoice)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{invoice.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Issued: {format(new Date(invoice.issueDate), 'MMM dd, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due: {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-bold">${parseFloat(invoice.amount).toFixed(2)}</div>
                        <div className="text-sm text-gray-500">{invoice.invoiceType}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewInvoice(invoice.id)}
                          className="gap-1"
                        >
                          <FileText className="h-4 w-4" /> View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownloadInvoice(invoice.id, invoice.invoiceNumber)}
                          className="gap-1"
                        >
                          <Download className="h-4 w-4" /> Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}