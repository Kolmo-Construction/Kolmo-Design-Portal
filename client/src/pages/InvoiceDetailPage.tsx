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
import { ArrowLeft, Download, FileText, MapPin, Calendar, DollarSign, Send, Loader2, Mail, Phone, Building2 } from "lucide-react";
import { formatDate, getInvoiceStatusLabel, getInvoiceStatusBadgeClasses } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-unified";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Kolmo Brand Colors
const colors = {
  primary: '#3d4f52',    // Dark Slate - Text/Headers/Table Headers
  accent: '#d8973c',     // Gold - Highlights/Total/Border
  secondary: '#4a6670',  // Subtext
  muted: '#f5f5f5',      // Backgrounds
  base: '#ffffff',       // Paper Background
};

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
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Action Buttons - Float above invoice */}
      <div className="max-w-[210mm] mx-auto mb-6">
        <div className="flex justify-between items-center">
          <Button
            onClick={() => setLocation('/financials')}
            variant="ghost"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Financials
          </Button>

          <div className="flex gap-3">
            <Badge
              className={getInvoiceStatusBadgeClasses(invoice.status as any)}
              style={{
                backgroundColor: invoice.status === 'paid' ? colors.accent : undefined
              }}
            >
              {getInvoiceStatusLabel(invoice.status as any)}
            </Badge>

            {invoice.status === 'draft' && (
              <Button
                onClick={() => sendInvoice()}
                disabled={isSending}
                style={{ backgroundColor: colors.accent }}
                className="hover:opacity-90"
              >
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

      {/* A4 Paper-like Invoice Container */}
      <div
        className="max-w-[210mm] mx-auto bg-white shadow-2xl"
        style={{
          minHeight: '297mm',
          backgroundColor: colors.base,
        }}
      >
        {/* Gold Top Border */}
        <div
          className="h-3"
          style={{ backgroundColor: colors.accent }}
        />

        {/* Main Invoice Content */}
        <div className="p-12">
          {/* Header Section */}
          <div className="flex justify-between items-start mb-12">
            {/* Left: Company Info */}
            <div className="space-y-3">
              {/* Logo */}
              <div className="mb-4">
                <img
                  src="/assets/kolmo-logo.png"
                  alt="Kolmo Construction"
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    // Fallback if logo fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div
                  className="hidden w-16 h-16 flex items-center justify-center text-3xl font-bold text-white"
                  style={{ backgroundColor: colors.primary }}
                >
                  K
                </div>
              </div>

              <h1
                className="text-2xl font-bold tracking-wide"
                style={{ color: colors.primary }}
              >
                Kolmo Construction
              </h1>
              <p className="text-sm italic" style={{ color: colors.secondary }}>
                Technology-Driven Home Remodeling
              </p>

              <div
                className="space-y-1.5 text-sm pt-2"
                style={{ color: colors.secondary }}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: colors.accent }} />
                  <span>4018 NE 125th St</span>
                </div>
                <div className="flex items-center gap-2 ml-6">
                  <span>Seattle, WA 98125</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" style={{ color: colors.accent }} />
                  <span>(206) 410-5100</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: colors.accent }} />
                  <span>projects@kolmo.io</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" style={{ color: colors.accent }} />
                  <span className="text-xs">kolmo.io</span>
                </div>
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="text-right space-y-4">
              <h2
                className="text-4xl font-bold tracking-tight"
                style={{ color: colors.primary }}
              >
                INVOICE
              </h2>

              <div
                className="space-y-2 text-sm"
                style={{ color: colors.secondary }}
              >
                <div className="flex justify-end items-center gap-2">
                  <span className="font-semibold">Invoice #:</span>
                  <span className="font-mono">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-end items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span className="font-semibold">Date:</span>
                  <span>{formatDate(invoice.issueDate)}</span>
                </div>
                <div className="flex justify-end items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span className="font-semibold">Due Date:</span>
                  <span className="font-semibold">{formatDate(invoice.dueDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Info - 2 Columns */}
          <div className="grid grid-cols-2 gap-8 mb-12">
            {/* Bill To */}
            <div
              className="p-6 rounded-lg"
              style={{ backgroundColor: colors.muted }}
            >
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: colors.primary }}
              >
                Bill To
              </h3>
              <div
                className="space-y-1"
                style={{ color: colors.secondary }}
              >
                <p className="font-semibold text-base">{project.name}</p>
                <p className="text-sm">{project.address}</p>
                <p className="text-sm">{project.city}, {project.state} {project.zipCode}</p>
              </div>
            </div>

            {/* Project Site */}
            <div
              className="p-6 rounded-lg"
              style={{ backgroundColor: colors.muted }}
            >
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: colors.primary }}
              >
                Project Site
              </h3>
              <div
                className="space-y-1"
                style={{ color: colors.secondary }}
              >
                <p className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4" />
                  {project.address}
                </p>
                <p className="text-sm ml-6">{project.city}, {project.state} {project.zipCode}</p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-12">
            <table className="w-full">
              <thead>
                <tr
                  className="text-white text-left"
                  style={{ backgroundColor: colors.primary }}
                >
                  <th className="py-4 px-4 text-sm font-semibold uppercase tracking-wide">
                    Description
                  </th>
                  <th className="py-4 px-4 text-sm font-semibold uppercase tracking-wide text-center">
                    Qty
                  </th>
                  <th className="py-4 px-4 text-sm font-semibold uppercase tracking-wide text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: colors.base }}>
                  <td
                    className="py-4 px-4 text-sm"
                    style={{ color: colors.primary }}
                  >
                    <p className="font-semibold">Construction Services</p>
                    <p className="text-xs mt-1" style={{ color: colors.secondary }}>
                      Professional construction services for {project.name}
                    </p>
                    {invoice.description && (
                      <p className="text-xs mt-1" style={{ color: colors.secondary }}>
                        {invoice.description}
                      </p>
                    )}
                  </td>
                  <td
                    className="py-4 px-4 text-sm text-center"
                    style={{ color: colors.secondary }}
                  >
                    1
                  </td>
                  <td
                    className="py-4 px-4 text-sm text-right font-mono font-semibold"
                    style={{ color: colors.primary }}
                  >
                    ${amount.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-12">
            <div
              className="w-80 p-6 rounded-lg space-y-3"
              style={{ backgroundColor: colors.muted }}
            >
              <div className="flex justify-between items-center">
                <span
                  className="text-sm font-semibold"
                  style={{ color: colors.secondary }}
                >
                  Subtotal
                </span>
                <span
                  className="font-mono text-sm"
                  style={{ color: colors.primary }}
                >
                  ${amount.toFixed(2)}
                </span>
              </div>

              <div
                className="pt-3 border-t-2"
                style={{ borderColor: colors.accent }}
              >
                <div className="flex justify-between items-center">
                  <span
                    className="text-xl font-bold"
                    style={{ color: colors.accent }}
                  >
                    Total Due
                  </span>
                  <span
                    className="font-mono text-2xl font-bold"
                    style={{ color: colors.accent }}
                  >
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="pt-8 border-t flex justify-between items-end"
            style={{ borderColor: colors.muted }}
          >
            <div className="max-w-md">
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: colors.primary }}
              >
                Payment Terms
              </h4>
              <p
                className="text-xs leading-relaxed"
                style={{ color: colors.secondary }}
              >
                Payment is due within 30 days of invoice date. Late payments subject to 1.5% monthly interest.
                Please include invoice number #{invoice.invoiceNumber} with your payment.
              </p>
            </div>

            <div className="text-right">
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: colors.primary }}
              >
                Thank you for your business
              </p>
              <p
                className="text-xs"
                style={{ color: colors.secondary }}
              >
                www.kolmo.io
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}