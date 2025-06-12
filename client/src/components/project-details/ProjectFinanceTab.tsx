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
  Download,
  Send
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

  const handleViewInvoice = async (invoice: any) => {
    console.log('[FRONTEND-VIEW] Starting handleViewInvoice');
    console.log('[FRONTEND-VIEW] Invoice:', invoice);
    console.log('[FRONTEND-VIEW] ProjectId:', projectId);
    console.log('[FRONTEND-VIEW] API URL:', `/api/projects/${projectId}/invoices/${invoice.id}/view`);
    
    try {
      console.log('[FRONTEND-VIEW] Making fetch request...');
      const response = await fetch(`/api/projects/${projectId}/invoices/${invoice.id}/view`, {
        credentials: 'include'
      });
      
      console.log('[FRONTEND-VIEW] Response status:', response.status);
      console.log('[FRONTEND-VIEW] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[FRONTEND-VIEW] Error response:', errorText);
        throw new Error(`Failed to fetch invoice details: ${response.status} - ${errorText}`);
      }
      
      console.log('[FRONTEND-VIEW] Parsing response JSON...');
      const invoiceData = await response.json();
      console.log('[FRONTEND-VIEW] Invoice data received:', invoiceData);
      
      console.log('[FRONTEND-VIEW] Opening new window...');
      // Create a modal or new window to display invoice details
      const invoiceWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
      if (invoiceWindow) {
        console.log('[FRONTEND-VIEW] Writing HTML to window...');
        invoiceWindow.document.write(generateInvoiceHTML(invoiceData.invoice, invoiceData.project));
        invoiceWindow.document.close();
        console.log('[FRONTEND-VIEW] Invoice view completed successfully');
      } else {
        console.log('[FRONTEND-VIEW] ERROR: Could not open new window');
        throw new Error('Could not open new window - popup blocked?');
      }
    } catch (error) {
      console.error('[FRONTEND-VIEW] Invoice view error:', error);
      toast({
        title: "View Failed",
        description: "Could not load the invoice details.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadInvoice = async (invoiceId: number, invoiceNumber: string) => {
    console.log('[FRONTEND-DOWNLOAD] Starting handleDownloadInvoice');
    console.log('[FRONTEND-DOWNLOAD] InvoiceId:', invoiceId);
    console.log('[FRONTEND-DOWNLOAD] InvoiceNumber:', invoiceNumber);
    console.log('[FRONTEND-DOWNLOAD] ProjectId:', projectId);
    console.log('[FRONTEND-DOWNLOAD] API URL:', `/api/projects/${projectId}/invoices/${invoiceId}/download`);
    
    try {
      console.log('[FRONTEND-DOWNLOAD] Making fetch request...');
      const response = await fetch(`/api/projects/${projectId}/invoices/${invoiceId}/download`, {
        credentials: 'include'
      });
      
      console.log('[FRONTEND-DOWNLOAD] Response status:', response.status);
      console.log('[FRONTEND-DOWNLOAD] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[FRONTEND-DOWNLOAD] Error response:', errorText);
        throw new Error(`Download failed: ${response.status} - ${errorText}`);
      }
      
      console.log('[FRONTEND-DOWNLOAD] Converting response to blob...');
      const blob = await response.blob();
      console.log('[FRONTEND-DOWNLOAD] Blob size:', blob.size);
      console.log('[FRONTEND-DOWNLOAD] Blob type:', blob.type);
      
      console.log('[FRONTEND-DOWNLOAD] Creating download link...');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      
      console.log('[FRONTEND-DOWNLOAD] Triggering download...');
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      console.log('[FRONTEND-DOWNLOAD] Download completed successfully');
    } catch (error) {
      console.error('[FRONTEND-DOWNLOAD] Invoice download error:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the invoice PDF.",
        variant: "destructive",
      });
    }
  };

  const sendInvoiceMutation = useMutation({
    mutationFn: (invoiceId: number) => 
      apiRequest(`/api/invoices/${invoiceId}/send`, { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "Invoice Sent",
        description: "The invoice has been sent successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/invoices`] });
    },
    onError: (error: any) => {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send the invoice.",
        variant: "destructive",
      });
    },
  });

  const handleSendInvoice = (invoiceId: number) => {
    sendInvoiceMutation.mutate(invoiceId);
  };

  const generateInvoiceHTML = (invoice: Invoice, project: any) => {
    const issueDate = new Date(invoice.issueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const amount = Number(invoice.amount);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            margin: 20px;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            border: 1px solid #ddd;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
          }
          .invoice-title {
            text-align: right;
          }
          .invoice-title h1 {
            font-size: 36px;
            color: #2563eb;
            margin: 0;
          }
          .invoice-number {
            font-size: 16px;
            color: #666;
          }
          .invoice-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          .section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
          }
          .section-title {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 10px;
            text-transform: uppercase;
            font-size: 14px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .items-table th {
            background: #2563eb;
            color: white;
            padding: 15px;
            text-align: left;
          }
          .items-table td {
            padding: 15px;
            border-bottom: 1px solid #ddd;
          }
          .total-section {
            text-align: right;
            margin-top: 20px;
          }
          .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
          }
          .total-label {
            width: 150px;
            text-align: right;
            padding-right: 20px;
            font-weight: 500;
          }
          .total-amount {
            width: 120px;
            text-align: right;
            font-weight: 600;
          }
          .grand-total {
            border-top: 2px solid #2563eb;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-paid { background: #d1fae5; color: #065f46; }
          .status-overdue { background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div>
              <div class="company-name">KOLMO</div>
              <div style="color: #666;">Construction Excellence</div>
            </div>
            <div class="invoice-title">
              <h1>INVOICE</h1>
              <div class="invoice-number">#${invoice.invoiceNumber}</div>
              <div class="status-badge status-${invoice.status}">${invoice.status.toUpperCase()}</div>
            </div>
          </div>
          
          <div class="invoice-meta">
            <div class="section">
              <div class="section-title">Bill To</div>
              <div style="font-weight: 600; margin-bottom: 5px;">Client</div>
              <div>Project: ${project.name}</div>
              <div style="color: #666; font-size: 14px; margin-top: 5px;">
                ${project.address}, ${project.city}, ${project.state} ${project.zipCode}
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">Invoice Details</div>
              <div class="detail-row">
                <span>Issue Date:</span>
                <span>${issueDate}</span>
              </div>
              <div class="detail-row">
                <span>Due Date:</span>
                <span>${dueDate}</span>
              </div>
              <div class="detail-row">
                <span>Project ID:</span>
                <span>#${project.id}</span>
              </div>
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="width: 100px;">Quantity</th>
                <th style="width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Project Services</strong><br>
                  <span style="color: #666; font-size: 14px;">
                    Construction services for ${project.name}
                    ${invoice.description ? `<br>${invoice.description}` : ''}
                  </span>
                </td>
                <td style="text-align: center;">1</td>
                <td style="text-align: right;">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="total-section">
            <div class="total-row grand-total">
              <div class="total-label">Total Amount Due:</div>
              <div class="total-amount">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #f1f5f9; border-radius: 8px;">
            <div style="font-weight: 600; margin-bottom: 10px;">Payment Information</div>
            <div style="color: #666; font-size: 14px;">
              Payment is due within 30 days of invoice date. Please include invoice number #${invoice.invoiceNumber} with your payment.
              <br><br>
              <strong>Questions?</strong> Contact us at contact@kolmo.io or through your project portal.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
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
      return response;
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
              <div className="text-2xl font-bold text-blue-700">${totalInvoiced.toFixed(2)}</div>
              <div className="text-sm text-blue-600">Total Invoiced</div>
            </div>
            
            {/* Total Collected */}
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <div className="text-2xl font-bold text-green-700">${totalPaid.toFixed(2)}</div>
              <div className="text-sm text-green-600">Total Collected</div>
            </div>
            
            {/* Outstanding Balance */}
            <div className="text-center p-4 bg-orange-50 rounded-lg border">
              <div className="text-2xl font-bold text-orange-700">${remainingToPay.toFixed(2)}</div>
              <div className="text-sm text-orange-600">Outstanding Balance</div>
            </div>
          </div>
          
          {/* Payment Progress */}
          <div className="mt-6 pt-4 border-t">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-slate-600">Payment Progress</span>
              <span className="font-medium">{totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0}% Collected</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0}%` }}
              ></div>
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
                        {invoice.status === 'draft' && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => handleSendInvoice(invoice.id)}
                            className="gap-1"
                          >
                            <Send className="h-4 w-4" /> Send
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewInvoice(invoice)}
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