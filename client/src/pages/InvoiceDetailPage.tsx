import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Invoice, Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, FileText, MapPin, Calendar, DollarSign, Send, Loader2 } from "lucide-react";
import { formatDate, getInvoiceStatusLabel, getInvoiceStatusBadgeClasses } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-unified";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface InvoiceDetailResponse {
  invoice: Invoice;
  project: {
    id: number;
    name: string;
    description: string | null;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: invoiceData,
    isLoading,
    error
  } = useQuery<InvoiceDetailResponse>({
    queryKey: [`/api/invoices/${invoiceId}/view`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!invoiceId,
  });

  const { mutate: sendInvoice, isPending: isSending } = useMutation({
    mutationFn: () => apiRequest('POST', `/api/projects/${invoiceData?.invoice.projectId}/invoices/${invoiceData?.invoice.id}/send`),
    onSuccess: () => {
      toast({
        title: "Invoice Sent",
        description: "The invoice has been successfully emailed to the customer.",
      });
      // Refresh the invoice data to show its new 'pending' status
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${invoiceData?.invoice.projectId}/invoices`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}/view`] });
    },
    onError: (error: any) => {
      toast({
        title: "Send Failed",
        description: error.message || "Could not send the invoice.",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceData?.invoice.invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Invoice Not Found</h3>
            <p className="text-slate-600 mb-4">The invoice you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button onClick={() => setLocation('/financials')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Financials
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invoice, project } = invoiceData;
  const amount = Number(invoice.amount);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            onClick={() => setLocation('/financials')} 
            variant="ghost" 
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Financials
          </Button>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Invoice #{invoice.invoiceNumber}</h1>
              <p className="text-slate-600 mt-1">Project: {project.name}</p>
            </div>
            
            <div className="flex gap-3">
              <Badge className={getInvoiceStatusBadgeClasses(invoice.status as any)}>
                {getInvoiceStatusLabel(invoice.status as any)}
              </Badge>
              
              {/* Only show the "Send" button if the invoice is in 'draft' status */}
              {invoice.status === 'draft' && (
                <Button onClick={() => sendInvoice()} disabled={isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Invoice
                    </>
                  )}
                </Button>
              )}

              <Button onClick={handleDownload} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Issue Date</p>
                      <p className="text-sm text-slate-600">{formatDate(invoice.issueDate)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Due Date</p>
                      <p className="text-sm text-slate-600">{formatDate(invoice.dueDate)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Amount</p>
                      <p className="text-lg font-semibold text-slate-900">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Status</p>
                      <Badge className={getInvoiceStatusBadgeClasses(invoice.status as any)} variant="outline">
                        {getInvoiceStatusLabel(invoice.status as any)}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {invoice.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-slate-900 mb-2">Description</p>
                      <p className="text-sm text-slate-600">{invoice.description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Service Details */}
            <Card>
              <CardHeader>
                <CardTitle>Service Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg">
                  <div className="px-4 py-3 bg-slate-50 border-b">
                    <div className="grid grid-cols-3 gap-4 text-sm font-medium text-slate-700">
                      <span>Description</span>
                      <span className="text-center">Quantity</span>
                      <span className="text-right">Amount</span>
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">Construction Services</p>
                        <p className="text-slate-600">Professional construction services for {project.name}</p>
                        {invoice.description && (
                          <p className="text-slate-500 mt-1 text-xs">{invoice.description}</p>
                        )}
                      </div>
                      <div className="text-center text-slate-600">1</div>
                      <div className="text-right font-medium text-slate-900">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-slate-50 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-900">Total</span>
                      <span className="text-xl font-bold text-slate-900">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Project Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Project Name</p>
                  <p className="text-sm text-slate-600">{project.name}</p>
                </div>
                
                {project.description && (
                  <div>
                    <p className="text-sm font-medium text-slate-900">Description</p>
                    <p className="text-sm text-slate-600">{project.description}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm font-medium text-slate-900">Project Address</p>
                  <p className="text-sm text-slate-600">
                    {project.address}<br />
                    {project.city}, {project.state} {project.zipCode}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-slate-900">Project ID</p>
                  <p className="text-sm text-slate-600">#{project.id}</p>
                </div>
              </CardContent>
            </Card>

            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle>KOLMO</CardTitle>
                <CardDescription>Construction Excellence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>Professional Construction Services</p>
                <p>Licensed & Insured</p>
                <p>contact@kolmo.io</p>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <p>Payment is due within 30 days of invoice date.</p>
                <p>Please include invoice number #{invoice.invoiceNumber} with your payment.</p>
                <p className="font-medium">Questions? Contact us at contact@kolmo.io</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}