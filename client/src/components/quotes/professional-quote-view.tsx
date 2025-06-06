import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle, XCircle, Calendar, MapPin, Phone, Mail, FileText, Camera, DollarSign, Clock, Building, Palette, User, Home, Shield } from "lucide-react";
import kolmoLogoPath from "@assets/kolmo-logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BeforeAfterSlider } from "./before-after-slider";
import type { QuoteBeforeAfterPair } from "@shared/schema";

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

export default function ProfessionalQuoteView() {
  const { token } = useParams();
  const [customerNotes, setCustomerNotes] = useState("");
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [pendingResponse, setPendingResponse] = useState<"accepted" | "declined" | null>(null);
  const { toast } = useToast();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: [`/api/quotes/view/${token}`],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/view/${token}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      return response.json();
    },
    enabled: !!token
  });

  // Fetch before/after pairs for this quote
  const { data: beforeAfterPairs = [] } = useQuery({
    queryKey: [`/api/quotes/${quote?.id}/before-after-pairs`],
    queryFn: async (): Promise<QuoteBeforeAfterPair[]> => {
      const response = await fetch(`/api/quotes/${quote.id}/before-after-pairs`);
      if (!response.ok) throw new Error('Failed to fetch before/after pairs');
      return response.json();
    },
    enabled: !!quote?.id
  });

  const respondMutation = useMutation({
    mutationFn: async ({ response, notes }: { response: string; notes?: string }) => {
      const res = await fetch(`/api/quotes/view/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, notes })
      });
      if (!res.ok) {
        throw new Error('Failed to respond to quote');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Response submitted successfully" });
      setShowResponseDialog(false);
      setPendingResponse(null);
      setCustomerNotes("");
    },
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-xl mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header matching Kolmo.io design */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Kolmo Construction</h1>
                <p className="text-sm text-gray-600">Licensed, Bonded & Insured • EPA Lead Safe Certified</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600 space-y-1">
              <div className="flex items-center justify-end space-x-1">
                <Phone className="w-4 h-4" />
                <span>(206) 410-5100</span>
              </div>
              <div className="flex items-center justify-end space-x-1">
                <Mail className="w-4 h-4" />
                <span>projects@kolmo.io</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Status and Credentials Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              {quote.status === 'sent' ? 'Pending' : quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex items-center justify-center space-x-2">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Licensed: KOLMO**335</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Shield className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Bonded & Insured</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">OSHA 40 Certified</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-600">
            EPA RRP (Renovation, Repair, and Painting) certified for lead-safe work practices in Washington State.
          </div>
        </div>

        {/* Quote Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Quote</h1>
              <p className="text-gray-600">Quote #{quote.quoteNumber}</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div>Valid until {formatDate(quote.validUntil)}</div>
              <div>Created {formatDate(quote.createdAt)}</div>
            </div>
          </div>
        </div>

        {/* Response Required Section */}
        {!hasResponded && !isExpired && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-start space-x-3 mb-4">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900">Response Required</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Please review this quote and let us know if you'd like to proceed. Valid until {formatDate(quote.validUntil)}.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button 
                onClick={() => handleResponse("accepted")} 
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                disabled={respondMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept Quote
              </Button>
              <Button 
                onClick={() => handleResponse("declined")} 
                variant="outline"
                className="w-full"
                disabled={respondMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Decline Quote
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Project Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Description */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-3">{quote.projectTitle}</h2>
              <div className="text-sm text-gray-600 mb-4">{quote.projectType}</div>
              <p className="text-gray-700 leading-relaxed">{quote.projectDescription}</p>
              
              {quote.projectLocation && (
                <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{quote.projectLocation}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {quote.estimatedStartDate && (
                  <div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span>Estimated Start</span>
                    </div>
                    <div className="font-medium text-gray-900">{formatDate(quote.estimatedStartDate)}</div>
                  </div>
                )}
                {quote.estimatedCompletionDate && (
                  <div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span>Estimated Completion</span>
                    </div>
                    <div className="font-medium text-gray-900">{formatDate(quote.estimatedCompletionDate)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            {quote.lineItems && quote.lineItems.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Breakdown</h3>
                <div className="space-y-3">
                  {quote.lineItems.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.description}</div>
                        <div className="text-sm text-gray-600">{item.category}</div>
                        <div className="text-sm text-gray-500">
                          {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Before/After Images */}
            {beforeAfterPairs.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Visualization</h3>
                <div className="space-y-6">
                  {beforeAfterPairs.map((pair: any) => (
                    <div key={pair.id}>
                      {pair.title && (
                        <h4 className="font-medium text-gray-900 mb-2">{pair.title}</h4>
                      )}
                      {pair.description && (
                        <p className="text-sm text-gray-600 mb-4">{pair.description}</p>
                      )}
                      <BeforeAfterSlider
                        beforeImageUrl={pair.beforeImageUrl}
                        afterImageUrl={pair.afterImageUrl}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Quote Summary & Payment */}
          <div className="space-y-6">
            {/* Quote Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">{formatCurrency(quote.taxAmount)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-xl text-gray-900">
                      {formatCurrency(quote.totalAmount)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Valid until {formatDate(quote.validUntil)}
                </div>
              </div>
            </div>

            {/* Payment Schedule */}
            {(quote.downPaymentPercentage || quote.milestonePaymentPercentage || quote.finalPaymentPercentage) && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Schedule</h3>
                <div className="space-y-3 text-sm">
                  {quote.downPaymentPercentage && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Down Payment</span>
                      <span className="font-medium">{quote.downPaymentPercentage}%</span>
                    </div>
                  )}
                  {quote.milestonePaymentPercentage && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Milestone Payment</span>
                      <span className="font-medium">{quote.milestonePaymentPercentage}%</span>
                    </div>
                  )}
                  {quote.finalPaymentPercentage && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Final Payment</span>
                      <span className="font-medium">{quote.finalPaymentPercentage}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingResponse === "accepted" ? "Accept Quote" : "Decline Quote"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {pendingResponse === "accepted" 
                ? "Please confirm that you would like to accept this quote and proceed with the project."
                : "Please let us know why you're declining this quote (optional)."
              }
            </div>
            <Textarea
              placeholder={pendingResponse === "accepted" 
                ? "Any additional notes or requirements..."
                : "Reason for declining (optional)..."
              }
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={3}
            />
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowResponseDialog(false)}
                disabled={respondMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={submitResponse}
                disabled={respondMutation.isPending}
                className={pendingResponse === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              >
                {pendingResponse === "accepted" ? "Accept Quote" : "Decline Quote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}