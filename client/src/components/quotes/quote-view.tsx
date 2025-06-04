import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle, XCircle, Calendar, MapPin, Phone, Mail, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BeforeAfterSlider } from "./before-after-slider";

interface QuoteData {
  id: number;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  projectTitle: string;
  projectDescription: string;
  projectType: string;
  projectLocation?: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  validUntil: string;
  status: string;
  viewedAt?: string;
  respondedAt?: string;
  customerResponse?: string;
  customerNotes?: string;
  createdAt: string;
  showBeforeAfter?: boolean;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeAfterTitle?: string;
  beforeAfterDescription?: string;
  showColorVerification?: boolean;
  colorVerificationTitle?: string;
  colorVerificationDescription?: string;
  paintColors?: Record<string, string>;
  permitRequired?: boolean;
  permitDetails?: string;
  downPaymentPercentage?: string;
  milestonePaymentPercentage?: string;
  finalPaymentPercentage?: string;
  milestoneDescription?: string;
  creditCardProcessingFee?: string;
  acceptsCreditCards?: boolean;
  lineItems: Array<{
    id: number;
    category: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    totalPrice: string;
  }>;
  images: Array<{
    id: number;
    imageUrl: string;
    caption?: string;
    imageType: string;
  }>;
}

export default function QuoteView() {
  const { token } = useParams();
  const [customerNotes, setCustomerNotes] = useState("");
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<"accepted" | "declined" | null>(null);
  const { toast } = useToast();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: [`/api/quotes/view/${token}`],
    queryFn: () => apiRequest(`/api/quotes/view/${token}`),
    enabled: !!token
  });

  const respondMutation = useMutation({
    mutationFn: ({ response, notes }: { response: string; notes?: string }) =>
      apiRequest(`/api/quotes/respond/${token}`, {
        method: "POST",
        body: { response, notes }
      }),
    onSuccess: () => {
      toast({ title: "Response submitted successfully" });
      setShowResponseDialog(false);
      setPendingResponse(null);
      setCustomerNotes("");
    },
    onError: () => {
      toast({ title: "Failed to submit response", variant: "destructive" });
    }
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleResponse = (response: "accepted" | "declined") => {
    setPendingResponse(response);
    setShowResponseDialog(true);
  };

  const submitResponse = () => {
    if (pendingResponse) {
      respondMutation.mutate({ 
        response: pendingResponse, 
        notes: customerNotes.trim() || undefined 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-6"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Not Found</h1>
            <p className="text-gray-600">
              This quote link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(quote.validUntil) < new Date();
  const hasResponded = quote.respondedAt;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Kolmo Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">K</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Kolmo</h1>
                <p className="text-sm text-slate-600">Premier Construction & Remodeling</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">4018 NE 125th St, Seattle, WA 98125</p>
              <p className="text-sm text-slate-600">(206) 410-5100 • projects@kolmo.io</p>
            </div>
          </div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Quote {quote.quoteNumber}
              </h2>
              <p className="text-lg text-slate-600">{quote.projectTitle}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-500 mb-1">
                {formatCurrency(quote.totalAmount)}
              </div>
              <div className="text-sm text-slate-600">
                Valid until {formatDate(quote.validUntil)}
              </div>
              {isExpired && (
                <Badge variant="destructive" className="mt-1">
                  Expired
                </Badge>
              )}
            </div>
          </div>

          {/* Project Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Project Information</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Type:</span> {quote.projectType}</p>
                {quote.projectLocation && (
                  <p className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {quote.projectLocation}
                  </p>
                )}
                {quote.estimatedStartDate && (
                  <p className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Start: {formatDate(quote.estimatedStartDate)}
                  </p>
                )}
                {quote.estimatedCompletionDate && (
                  <p className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Completion: {formatDate(quote.estimatedCompletionDate)}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Contact Information</h3>
              <div className="space-y-2">
                <p className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  {quote.customerEmail}
                </p>
                {quote.customerPhone && (
                  <p className="flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    {quote.customerPhone}
                  </p>
                )}
                {quote.customerAddress && (
                  <p className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {quote.customerAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Project Description */}
          <div className="mt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Project Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{quote.projectDescription}</p>
          </div>
        </div>

        {/* Line Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Unit Price</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3">
                        <div>
                          <div className="font-medium">{item.description}</div>
                          <div className="text-sm text-gray-600">{item.category}</div>
                        </div>
                      </td>
                      <td className="text-right py-3">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="text-right py-3">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="text-right py-3 font-medium">
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr>
                    <td colSpan={3} className="text-right py-2 font-medium">Subtotal:</td>
                    <td className="text-right py-2">{formatCurrency(quote.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="text-right py-2 font-medium">Tax:</td>
                    <td className="text-right py-2">{formatCurrency(quote.taxAmount)}</td>
                  </tr>
                  <tr className="border-t">
                    <td colSpan={3} className="text-right py-2 text-lg font-bold">Total:</td>
                    <td className="text-right py-2 text-lg font-bold">
                      {formatCurrency(quote.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Before/After Images */}
        {quote.showBeforeAfter && (quote.beforeImageUrl || quote.afterImageUrl) && (
          <div className="mb-6">
            <BeforeAfterSlider
              beforeImageUrl={quote.beforeImageUrl}
              afterImageUrl={quote.afterImageUrl}
              title={quote.beforeAfterTitle}
              description={quote.beforeAfterDescription}
            />
          </div>
        )}

        {/* Other Project Images */}
        {quote.images && quote.images.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="w-5 h-5 mr-2" />
                Additional Project Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quote.images.map((image) => (
                  <div key={image.id} className="space-y-2">
                    <img
                      src={image.imageUrl}
                      alt={image.caption || "Project image"}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {image.caption && (
                      <p className="text-sm text-gray-600">{image.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Terms */}
        {(quote.downPaymentPercentage || quote.acceptsCreditCards) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quote.downPaymentPercentage && (
                <p>
                  <span className="font-medium">Down Payment:</span> {quote.downPaymentPercentage}%
                </p>
              )}
              {quote.milestonePaymentPercentage && (
                <p>
                  <span className="font-medium">Milestone Payment:</span> {quote.milestonePaymentPercentage}%
                  {quote.milestoneDescription && ` (${quote.milestoneDescription})`}
                </p>
              )}
              {quote.finalPaymentPercentage && (
                <p>
                  <span className="font-medium">Final Payment:</span> {quote.finalPaymentPercentage}%
                </p>
              )}
              {quote.acceptsCreditCards && (
                <p>
                  <span className="font-medium">Credit Cards:</span> Accepted
                  {quote.creditCardProcessingFee && ` (${quote.creditCardProcessingFee}% processing fee)`}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Response Section */}
        {!hasResponded && !isExpired && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Respond to Quote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  onClick={() => handleResponse("accepted")}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Quote
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleResponse("declined")}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Response Status */}
        {hasResponded && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                {quote.customerResponse === "accepted" ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <h3 className="font-semibold">
                    Quote {quote.customerResponse === "accepted" ? "Accepted" : "Declined"}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Responded on {formatDate(quote.respondedAt!)}
                  </p>
                </div>
              </div>
              {quote.customerNotes && (
                <div className="mt-3 p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium text-gray-700 mb-1">Your notes:</p>
                  <p className="text-gray-700">{quote.customerNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Response Dialog */}
        <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingResponse === "accepted" ? "Accept Quote" : "Decline Quote"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to {pendingResponse} this quote?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional notes (optional):
                </label>
                <Textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Add any comments or questions..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowResponseDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitResponse}
                  disabled={respondMutation.isPending}
                  className={pendingResponse === "accepted" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {pendingResponse === "accepted" ? "Accept Quote" : "Decline Quote"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Kolmo Footer */}
        <div className="bg-white rounded-lg shadow-sm p-8 mt-6">
          <div className="border-t pt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Contact Information</h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4" />
                    <span>(206) 410-5100</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>projects@kolmo.io</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>4018 NE 125th St, Seattle, WA 98125</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Business Hours</h4>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
                  <p>Saturday: 9:00 AM - 1:00 PM</p>
                  <p>Sunday: Closed</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">About Kolmo</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Licensed and bonded general contractor delivering high-quality residential and commercial construction services with smart technology, transparency, and expert craftsmanship.
                </p>
              </div>
            </div>
            
            <div className="flex justify-center items-center mt-6 pt-6 border-t">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">K</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Kolmo Construction</p>
                  <p className="text-xs text-slate-500">Innovate Everyday. Residential & Commercial</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}