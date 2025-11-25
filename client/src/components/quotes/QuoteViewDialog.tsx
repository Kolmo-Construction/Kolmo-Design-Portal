import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { QuoteWithDetails, QuoteLineItem } from "@shared/schema";
import { theme } from "@/config/theme";

interface QuoteViewDialogProps {
  quote: QuoteWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export function QuoteViewDialog({ quote, open, onOpenChange, onEdit }: QuoteViewDialogProps) {
  const { toast } = useToast();

  const { data: freshQuote } = useQuery<QuoteWithDetails>({
    queryKey: [`/api/quotes/${quote.id}`],
    enabled: !!quote.id && open,
    retry: false,
    initialData: quote,
  });

  const { data: lineItems = [] } = useQuery<QuoteLineItem[]>({
    queryKey: [`/api/quotes/${quote.id}/line-items`],
    enabled: !!quote.id && open,
    retry: false,
  });

  const currentQuote = freshQuote || quote;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return { backgroundColor: theme.colors.surfaceLight, color: theme.colors.textDark };
      case "sent": return { backgroundColor: theme.colors.secondary, color: "white" };
      case "pending": return { backgroundColor: "#fef3c7", color: "#92400e" };
      case "accepted": return { backgroundColor: "#dcfce7", color: "#166534" };
      case "declined": return { backgroundColor: "#fee2e2", color: "#991b1b" };
      case "expired": return { backgroundColor: "#f3f4f6", color: "#6b7280" };
      default: return { backgroundColor: theme.colors.surfaceLight, color: theme.colors.textDark };
    }
  };

  const generateQuoteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/customer/quote/${quote.accessToken}`;
  };

  const copyQuoteLink = async () => {
    try {
      await navigator.clipboard.writeText(generateQuoteLink());
      toast({
        title: "Link Copied",
        description: "Quote link has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {currentQuote.quoteNumber}
                <Badge style={getStatusColor(currentQuote.status)}>
                  {currentQuote.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>{currentQuote.title}</DialogDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: theme.colors.accent }}>
                {formatCurrency(currentQuote.total)}
              </div>
              <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                Valid until {formatDate(currentQuote.validUntil)}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: theme.colors.primary }}>
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Name</div>
                  <div className="font-medium">{currentQuote.customerName}</div>
                </div>
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Email</div>
                  <div className="font-medium">{currentQuote.customerEmail}</div>
                </div>
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Phone</div>
                  <div className="font-medium">{currentQuote.customerPhone || "—"}</div>
                </div>
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Address</div>
                  <div className="font-medium">{currentQuote.customerAddress || "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: theme.colors.primary }}>
                Project Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Project Type</div>
                  <div className="font-medium">{currentQuote.projectType}</div>
                </div>
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Location</div>
                  <div className="font-medium">{currentQuote.location || "—"}</div>
                </div>
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Estimated Start</div>
                  <div className="font-medium">
                    {currentQuote.estimatedStartDate ? formatDate(currentQuote.estimatedStartDate) : "TBD"}
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.colors.textMuted }}>Estimated Completion</div>
                  <div className="font-medium">
                    {currentQuote.estimatedCompletionDate ? formatDate(currentQuote.estimatedCompletionDate) : "TBD"}
                  </div>
                </div>
              </div>
              {currentQuote.scopeDescription && (
                <div className="mt-4">
                  <div className="text-sm" style={{ color: theme.colors.textMuted }}>Project Scope</div>
                  <div className="text-sm mt-1">{currentQuote.scopeDescription}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items Summary */}
          {lineItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base" style={{ color: theme.colors.primary }}>
                  Line Items ({lineItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between py-2 border-b last:border-b-0"
                      style={{ borderColor: theme.colors.border }}
                    >
                      <div>
                        <span className="font-medium">{item.category}</span>
                        <span className="text-sm ml-2" style={{ color: theme.colors.textMuted }}>
                          {item.description}
                        </span>
                      </div>
                      <div className="font-medium">{formatCurrency(item.totalPrice)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quote Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: theme.colors.primary }}>
                Quote Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(currentQuote.subtotal || "0")}</span>
                </div>
                {currentQuote.discountAmount && parseFloat(currentQuote.discountAmount.toString()) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      Discount
                      {currentQuote.discountPercentage && parseFloat(currentQuote.discountPercentage.toString()) > 0 &&
                        ` (${parseFloat(currentQuote.discountPercentage.toString())}%)`
                      }
                    </span>
                    <span>-{formatCurrency(currentQuote.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>
                    Tax
                    {currentQuote.taxRate ? ` (${parseFloat(currentQuote.taxRate.toString()).toFixed(2)}%)` : ""}
                  </span>
                  <span>{formatCurrency(currentQuote.taxAmount || "0")}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span style={{ color: theme.colors.accent }}>
                    {formatCurrency(currentQuote.total || "0")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Access Link */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base" style={{ color: theme.colors.primary }}>
                Customer Access
              </CardTitle>
              <CardDescription>
                Share this link with your customer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div
                  className="flex-1 p-2 rounded text-sm font-mono break-all"
                  style={{ backgroundColor: theme.colors.surfaceLight }}
                >
                  {generateQuoteLink()}
                </div>
                <Button onClick={copyQuoteLink} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button
                  onClick={() => window.open(generateQuoteLink(), "_blank")}
                  variant="outline"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Edit Button at Bottom */}
          <div className="flex justify-end pt-4 border-t" style={{ borderColor: theme.colors.border }}>
            <Button
              onClick={onEdit}
              className="text-white"
              style={{ backgroundColor: theme.colors.accent }}
              data-testid="button-edit-from-view"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit This Quote
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
