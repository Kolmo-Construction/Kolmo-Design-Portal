import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle, XCircle, Calendar, MapPin, Phone, Mail, FileText, Camera, DollarSign, Clock, Building, Palette, User, Home, Shield } from "lucide-react";
import kolmoLogoPath from "@assets/kolmo-logo (1).png";
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
      const res = await fetch(`/api/quotes/respond/${token}`, {
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
      {/* Header with company info */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-4">
              <img 
                src={kolmoLogoPath} 
                alt="Kolmo Construction" 
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Kolmo Construction</h1>
                <p className="text-sm text-gray-600">Licensed & Bonded General Contractor</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>4018 NE 125th St</p>
              <p>Seattle, WA 98125</p>
              <p>(206) 410-5100</p>
              <p className="text-blue-600">projects@kolmo.io</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Response Required Alert */}
        {!hasResponded && !isExpired && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Clock className="w-5 h-5 text-orange-500 mt-0.5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Response Required</h3>
                <p className="text-gray-600 mt-1">
                  Please review this quote and let us know if you'd like to proceed. Valid until {formatDate(quote.validUntil)}.
                </p>
                <div className="mt-4 flex space-x-3">
                  <Button 
                    onClick={() => handleResponse("accepted")}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Quote
                  </Button>
                  <Button 
                    onClick={() => handleResponse("declined")}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Decline Quote
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Project Title and Description */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-start space-x-3 mb-4">
                <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <span className="text-sm text-gray-500 font-medium">{quote.projectType}</span>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{quote.projectTitle}</h1>
              <p className="text-gray-700 leading-relaxed mb-4">{quote.projectDescription}</p>
              
              {/* Project Details */}
              <div className="space-y-2 text-sm">
                {quote.projectLocation && (
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    {quote.projectLocation}
                  </div>
                )}
                {quote.estimatedStartDate && (
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    Est. Start: {formatDate(quote.estimatedStartDate)}
                  </div>
                )}
              </div>
            </div>

            {/* Project Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Project Breakdown</h2>
              <p className="text-sm text-gray-600 mb-6">Detailed cost breakdown for your project</p>
              
              {/* Line Items */}
              {quote.lineItems && quote.lineItems.length > 0 && (
                <div className="space-y-4">
                  {quote.lineItems.map((item: any, index: number) => (
                    <div key={item.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{item.category}</div>
                          <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
                        <div className="font-semibold text-gray-900 ml-4">
                          {formatCurrency(item.totalPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Before/After Images - Smaller Size */}
            {beforeAfterPairs && beforeAfterPairs.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Examples</h3>
                <div className="space-y-6">
                  {beforeAfterPairs.map((pair) => (
                    <div key={pair.id} className="space-y-3">
                      {pair.title && (
                        <h4 className="font-medium text-gray-900">{pair.title}</h4>
                      )}
                      {pair.description && (
                        <p className="text-sm text-gray-600">{pair.description}</p>
                      )}
                      <div className="flex gap-4">
                        {pair.beforeImageUrl && (
                          <div className="flex-1 space-y-2">
                            <div className="aspect-[4/3] h-32 rounded-lg overflow-hidden border border-gray-200">
                              <img 
                                src={pair.beforeImageUrl} 
                                alt="Before"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Failed to load before image:', pair.beforeImageUrl);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="text-center">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                                Before
                              </Badge>
                            </div>
                          </div>
                        )}
                        {pair.afterImageUrl && (
                          <div className="flex-1 space-y-2">
                            <div className="aspect-[4/3] h-32 rounded-lg overflow-hidden border border-gray-200">
                              <img 
                                src={pair.afterImageUrl} 
                                alt="After"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Failed to load after image:', pair.afterImageUrl);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="text-center">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                After
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quote Summary */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">{formatCurrency(quote.taxAmount)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(quote.totalAmount)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Valid until {formatDate(quote.validUntil)}</p>
              </div>
            </div>

            {/* Payment Schedule */}
            {(quote.downPaymentPercentage || quote.milestonePaymentPercentage || quote.finalPaymentPercentage) && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Schedule</h3>
                
                <div className="space-y-4">
                  {quote.downPaymentPercentage && (
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Down Payment</span>
                        <span className="font-bold text-gray-900">{quote.downPaymentPercentage}%</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.downPaymentPercentage) / 100).toString())}
                      </p>
                    </div>
                  )}
                  
                  {quote.milestonePaymentPercentage && (
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Milestone Payment</span>
                        <span className="font-bold text-gray-900">{quote.milestonePaymentPercentage}%</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.milestonePaymentPercentage) / 100).toString())}
                      </p>
                      {quote.milestoneDescription && (
                        <p className="text-xs text-gray-500 mt-1">{quote.milestoneDescription}</p>
                      )}
                    </div>
                  )}
                  
                  {quote.finalPaymentPercentage && (
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Final Payment</span>
                        <span className="font-bold text-gray-900">{quote.finalPaymentPercentage}%</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.finalPaymentPercentage) / 100).toString())}
                      </p>
                    </div>
                  )}
                </div>
                
                {quote.milestoneDescription && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      <strong>Milestone:</strong> {quote.milestoneDescription}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Contact Information */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{quote.customerPhone}</span>
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-sm text-gray-600">{quote.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Response Dialog */}
        <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {pendingResponse === "accepted" ? "Accept Quote" : "Decline Quote"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  {pendingResponse === "accepted" 
                    ? "Any additional notes or questions? (Optional)" 
                    : "Would you like to share why you're declining? (Optional)"}
                </label>
                <Textarea
                  id="notes"
                  placeholder={pendingResponse === "accepted" 
                    ? "Add any special requests, questions, or notes about the project..."
                    : "Let us know how we can improve our proposal..."}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={submitResponse}
                  disabled={respondMutation.isPending}
                  className={`flex-1 ${
                    pendingResponse === "accepted" 
                      ? "bg-gray-800 hover:bg-gray-700" 
                      : "bg-gray-600 hover:bg-gray-700"
                  }`}
                >
                  {respondMutation.isPending ? "Submitting..." : "Submit Response"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowResponseDialog(false)}
                  disabled={respondMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}