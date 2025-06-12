import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import { useToast } from "@/hooks/use-toast";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import FinancialSummary from "@/components/FinancialSummary";
import { Project, Invoice, Payment } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  FileText,
  Download,
  CircleDollarSign,
  Loader2,
  ArrowDownUp,
  Calendar
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Financials() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const { toast } = useToast();

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all invoices across all projects
  const { 
    data: allInvoices = [],
    isLoading: isLoadingInvoices 
  } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    enabled: projects.length > 0,
  });

  // Fetch all payments across all invoices
  const { 
    data: allPayments = [],
    isLoading: isLoadingPayments 
  } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: allInvoices.length > 0,
  });

  // Filter projects based on the selected filter
  const filteredProjects = projects.filter(project =>
    projectFilter === "all" || project.id.toString() === projectFilter
  );

  // Calculate total budget from the *filtered* projects
  const totalBudget = filteredProjects.reduce((sum, project) => {
    return sum + Number(project.totalBudget);
  }, 0);

  // Filter invoices based on project
  const filteredInvoices = allInvoices.filter(inv => 
    projectFilter === "all" || inv.projectId.toString() === projectFilter
  );

  // Filter payments based on filtered invoices
  const filteredPayments = allPayments.filter(payment =>
    filteredInvoices.some(inv => inv.id === payment.invoiceId)
  );

  // Format date
  const formatDate = (dateString: string | Date) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Handler functions for invoice actions
  const handleViewInvoice = async (invoice: Invoice) => {
    console.log('[GLOBAL-FRONTEND-VIEW] Starting handleViewInvoice');
    console.log('[GLOBAL-FRONTEND-VIEW] Invoice:', invoice);
    console.log('[GLOBAL-FRONTEND-VIEW] API URL:', `/api/projects/${invoice.projectId}/invoices/${invoice.id}/view`);
    
    try {
      console.log('[GLOBAL-FRONTEND-VIEW] Making fetch request...');
      const response = await fetch(`/api/projects/${invoice.projectId}/invoices/${invoice.id}/view`, {
        credentials: 'include'
      });
      
      console.log('[GLOBAL-FRONTEND-VIEW] Response status:', response.status);
      console.log('[GLOBAL-FRONTEND-VIEW] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[GLOBAL-FRONTEND-VIEW] Error response:', errorText);
        throw new Error(`Failed to fetch invoice details: ${response.status} - ${errorText}`);
      }
      
      console.log('[GLOBAL-FRONTEND-VIEW] Parsing response JSON...');
      const invoiceData = await response.json();
      console.log('[GLOBAL-FRONTEND-VIEW] Invoice data received:', invoiceData);
      
      console.log('[GLOBAL-FRONTEND-VIEW] Opening new window...');
      const invoiceWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
      if (invoiceWindow) {
        console.log('[GLOBAL-FRONTEND-VIEW] Writing HTML to window...');
        invoiceWindow.document.write(generateInvoiceHTML(invoiceData.invoice, invoiceData.project));
        invoiceWindow.document.close();
        console.log('[GLOBAL-FRONTEND-VIEW] Invoice view completed successfully');
      } else {
        console.log('[GLOBAL-FRONTEND-VIEW] ERROR: Could not open new window');
        throw new Error('Could not open new window - popup blocked?');
      }
    } catch (error) {
      console.error('[GLOBAL-FRONTEND-VIEW] Invoice view error:', error);
      toast({
        title: "View Failed",
        description: "Could not load the invoice details.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadInvoice = async (invoiceId: number, invoiceNumber: string) => {
    console.log('[GLOBAL-FRONTEND-DOWNLOAD] Starting handleDownloadInvoice');
    console.log('[GLOBAL-FRONTEND-DOWNLOAD] InvoiceId:', invoiceId);
    console.log('[GLOBAL-FRONTEND-DOWNLOAD] InvoiceNumber:', invoiceNumber);
    
    // Find the invoice to get project ID
    const invoice = allInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] ERROR: Invoice not found in local data');
      toast({
        title: "Download Failed",
        description: "Invoice not found.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('[GLOBAL-FRONTEND-DOWNLOAD] API URL:', `/api/projects/${invoice.projectId}/invoices/${invoiceId}/download`);
    
    try {
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Making fetch request...');
      const response = await fetch(`/api/projects/${invoice.projectId}/invoices/${invoiceId}/download`, {
        credentials: 'include'
      });
      
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Response status:', response.status);
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[GLOBAL-FRONTEND-DOWNLOAD] Error response:', errorText);
        throw new Error(`Download failed: ${response.status} - ${errorText}`);
      }
      
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Converting response to blob...');
      const blob = await response.blob();
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Blob size:', blob.size);
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Blob type:', blob.type);
      
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Creating download link...');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Triggering download...');
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      console.log('[GLOBAL-FRONTEND-DOWNLOAD] Download completed successfully');
    } catch (error) {
      console.error('[GLOBAL-FRONTEND-DOWNLOAD] Invoice download error:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the invoice PDF.",
        variant: "destructive",
      });
    }
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

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .amount { font-size: 24px; font-weight: bold; color: #2563eb; }
            .status { padding: 5px 10px; border-radius: 5px; color: white; background: #6b7280; }
            .description { margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice ${invoice.invoiceNumber}</h1>
            <p>Project: ${project.name}</p>
          </div>
          
          <div class="invoice-details">
            <div>
              <p><strong>Issue Date:</strong> ${issueDate}</p>
              <p><strong>Due Date:</strong> ${dueDate}</p>
              <p><strong>Status:</strong> <span class="status">${invoice.status}</span></p>
            </div>
            <div>
              <p class="amount">$${parseFloat(invoice.amount).toFixed(2)}</p>
            </div>
          </div>

          ${invoice.description ? `
            <div class="description">
              <h3>Description</h3>
              <p>${invoice.description}</p>
            </div>
          ` : ''}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p><strong>Project Address:</strong></p>
            <p>${project.address || 'Not specified'}</p>
            <p>${project.city || ''} ${project.state || ''} ${project.zipCode || ''}</p>
          </div>
        </body>
      </html>
    `;
  };

  // Prepare data for charts
  const statusCounts = {
    draft: filteredInvoices.filter(i => i.status === "draft").length,
    pending: filteredInvoices.filter(i => i.status === "pending").length,
    paid: filteredInvoices.filter(i => i.status === "paid").length,
    overdue: filteredInvoices.filter(i => i.status === "overdue").length,
  };

  const pieChartData = [
    { name: "Draft", value: statusCounts.draft, color: "#3b82f6" },
    { name: "Pending", value: statusCounts.pending, color: "#facc15" },
    { name: "Paid", value: statusCounts.paid, color: "#16a34a" },
    { name: "Overdue", value: statusCounts.overdue, color: "#dc2626" },
  ].filter(item => item.value > 0);

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Financial Overview</h1>
          <p className="text-slate-600">Track budgets, invoices, and payments for your construction projects</p>
        </div>

        {/* Project Filter */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6">
            <div className="w-full sm:w-1/3">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Select Project</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <div className="mb-6">
          <FinancialSummary 
            totalBudget={totalBudget}
            invoices={filteredInvoices}
            isLoading={isLoadingProjects || isLoadingInvoices}
          />
        </div>

        {/* Financial Data Tabs */}
        <Tabs defaultValue="invoices" className="mb-6">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          
          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>
                  {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(isLoadingProjects || isLoadingInvoices) ? (
                  <div className="animate-pulse">
                    <div className="h-10 bg-slate-200 rounded mb-4"></div>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-slate-200 rounded mb-2"></div>
                    ))}
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <FileText className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Invoices Found</h3>
                    <p className="text-center text-slate-500 mb-6 max-w-md">
                      {allInvoices.length === 0 
                        ? "No invoices have been issued for any of your projects yet."
                        : "No invoices match your current filter. Try selecting a different project."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-slate-500">Invoice Status</CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                label
                              >
                                {pieChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-slate-500">Invoice Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Total Invoices:</span>
                            <span className="font-medium">{filteredInvoices.length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Total Amount:</span>
                            <span className="font-medium">
                              ${filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Draft:</span>
                            <span className="font-medium text-blue-600">
                              ${filteredInvoices.filter(i => i.status === "draft")
                                .reduce((sum, inv) => sum + Number(inv.amount), 0)
                                .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Pending:</span>
                            <span className="font-medium text-yellow-600">
                              ${filteredInvoices.filter(i => i.status === "pending")
                                .reduce((sum, inv) => sum + Number(inv.amount), 0)
                                .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Paid:</span>
                            <span className="font-medium text-green-600">
                              ${filteredInvoices.filter(i => i.status === "paid")
                                .reduce((sum, inv) => sum + Number(inv.amount), 0)
                                .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-600">Overdue:</span>
                            <span className="font-medium text-red-600">
                              ${filteredInvoices.filter(i => i.status === "overdue")
                                .reduce((sum, inv) => sum + Number(inv.amount), 0)
                                .toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Invoice #
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Project
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Issue Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Due Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredInvoices.map((invoice) => {
                            // Find project for this invoice
                            const project = projects.find(p => p.id === invoice.projectId);
                            
                            return (
                              <tr key={invoice.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                                  {invoice.invoiceNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {project?.name || `Project ID: ${invoice.projectId}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {formatDate(invoice.issueDate)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {formatDate(invoice.dueDate)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  ${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge
                                    className={
                                      invoice.status === "paid" ? "bg-green-600" :
                                      invoice.status === "overdue" ? "bg-red-600" :
                                      "bg-yellow-500"
                                    }
                                  >
                                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-primary-600 gap-1"
                                      onClick={() => handleViewInvoice(invoice)}
                                    >
                                      <FileText className="h-4 w-4" />
                                      View
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-primary-600 gap-1"
                                      onClick={() => handleDownloadInvoice(invoice.id, invoice.invoiceNumber)}
                                    >
                                      <Download className="h-4 w-4" />
                                      Download
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>
                  {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(isLoadingProjects || isLoadingInvoices || isLoadingPayments) ? (
                  <div className="animate-pulse">
                    <div className="h-10 bg-slate-200 rounded mb-4"></div>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-slate-200 rounded mb-2"></div>
                    ))}
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <CircleDollarSign className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Payments Found</h3>
                    <p className="text-center text-slate-500 mb-6 max-w-md">
                      {allPayments.length === 0 
                        ? "No payments have been recorded for any of your invoices yet."
                        : "No payments match your current filter. Try selecting a different project."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-slate-500">Payment Timeline</CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={filteredPayments.map(payment => ({
                                date: format(new Date(payment.paymentDate), "MMM d"),
                                amount: Number(payment.amount)
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis tickFormatter={(value) => `$${value}`} />
                              <Tooltip formatter={(value) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Amount']} />
                              <Bar dataKey="amount" fill="#3b82f6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Invoice #
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Project
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Payment Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Method
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              Reference
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {filteredPayments.map((payment) => {
                            // Find invoice for this payment
                            const invoice = allInvoices.find(i => i.id === payment.invoiceId);
                            // Find project for this invoice
                            const project = invoice ? projects.find(p => p.id === invoice.projectId) : undefined;
                            
                            return (
                              <tr key={payment.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                                  {invoice?.invoiceNumber || `Invoice ID: ${payment.invoiceId}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {project?.name || 'Unknown Project'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {formatDate(payment.paymentDate)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                  ${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {payment.paymentMethod}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                  {payment.reference || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
