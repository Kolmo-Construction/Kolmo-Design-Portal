import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import type { Milestone, Invoice } from "@shared/schema";
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
  TrendingUp
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

  // Billing mutation for completed milestones
  const billMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: number) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/milestones/${milestoneId}/bill`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invoice Generated",
        description: `Invoice #${data.invoice.invoiceNumber} created successfully`,
      });
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
    const totalBillable = milestones
      .filter(m => m.isBillable)
      .reduce((sum, m) => sum + (m.billingPercentage || 0), 0);
    
    const totalInvoiced = invoices
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    
    const totalPaid = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    return { totalBillable, totalInvoiced, totalPaid };
  };

  const { totalBillable, totalInvoiced, totalPaid } = calculateFinancialSummary();

  if (isLoadingMilestones || isLoadingInvoices) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (milestonesError || invoicesError) {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{totalBillable}%</div>
              <div className="text-sm text-blue-600">Total Billable</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">${totalInvoiced.toFixed(2)}</div>
              <div className="text-sm text-green-600">Total Invoiced</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">${totalPaid.toFixed(2)}</div>
              <div className="text-sm text-purple-600">Total Paid</div>
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
                        {milestone.taskId && (
                          <span>Task #{milestone.taskId}</span>
                        )}
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
                    <div className="text-right">
                      <div className="text-xl font-bold">${parseFloat(invoice.amount).toFixed(2)}</div>
                      <div className="text-sm text-gray-500">{invoice.invoiceType}</div>
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