import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle, XCircle, Calendar, MapPin, Phone, Mail, FileText, Camera, DollarSign, Clock, Building, Palette, User, Home, Shield, AlertCircle } from "lucide-react";
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
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [hasColorChanges, setHasColorChanges] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const { data: quote, isLoading, error, refetch } = useQuery({
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

  // Initialize color selections from quote data
  useEffect(() => {
    if (quote?.paintColors) {
      setSelectedColors(quote.paintColors);
    }
  }, [quote]);

  const respondMutation = useMutation({
    mutationFn: async ({ response, notes }: { response: string; notes?: string }) => {
      const res = await fetch(`/api/quotes/view/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, notes }),
      });
      if (!res.ok) throw new Error('Failed to submit response');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Response submitted",
        description: "Thank you for your response. We will be in touch soon.",
      });
      setShowResponseDialog(false);
      setPendingResponse(null);
      setCustomerNotes("");
      refetch();
    },
  });

  const handleResponse = (response: "accepted" | "declined") => {
    setPendingResponse(response);
    setShowResponseDialog(true);
  };

  const confirmResponse = () => {
    if (pendingResponse) {
      respondMutation.mutate({
        response: pendingResponse,
        notes: customerNotes || undefined,
      });
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">Error loading quote</div>;
  if (!quote) return <div className="min-h-screen flex items-center justify-center">Quote not found</div>;

  const isExpired = new Date(quote.validUntil) < new Date();
  const hasResponded = quote.customerResponse;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Kolmo.io Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={kolmoLogoPath} alt="Kolmo.io" className="h-8 w-auto" />
              <div className="text-sm text-gray-600">
                Quote #{quote.quoteNumber}
              </div>
            </div>
            <Badge variant={
              quote.status === 'accepted' ? 'default' :
              quote.status === 'declined' ? 'destructive' :
              isExpired ? 'secondary' : 'outline'
            }>
              {quote.status === 'accepted' ? 'Accepted' :
               quote.status === 'declined' ? 'Declined' :
               isExpired ? 'Expired' : 'Pending'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Response Required Banner */}
        {!hasResponded && !isExpired && (
          <Card className="mb-6 border-l-4 border-l-blue-500 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Response Required</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Please review this quote and let us know if you'd like to proceed. Valid until {formatDate(quote.validUntil)}.
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={() => handleResponse("accepted")} 
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Quote
                </Button>
                <Button 
                  onClick={() => handleResponse("declined")} 
                  variant="outline"
                  className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Project Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Title & Description */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{quote.projectTitle}</h1>
              <p className="text-gray-600 mb-4">{quote.projectType}</p>
              <p className="text-gray-700 leading-relaxed">{quote.projectDescription}</p>
              
              {quote.projectLocation && (
                <div className="flex items-center gap-2 mt-4 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{quote.projectLocation}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            {(quote.estimatedStartDate || quote.estimatedCompletionDate) && (
              <div className="grid grid-cols-2 gap-4">
                {quote.estimatedStartDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Estimated Start</p>
                      <p className="text-sm text-gray-600">{formatDate(quote.estimatedStartDate)}</p>
                    </div>
                  </div>
                )}
                {quote.estimatedCompletionDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Estimated Completion</p>
                      <p className="text-sm text-gray-600">{formatDate(quote.estimatedCompletionDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Project Breakdown */}
            {quote.lineItems && quote.lineItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Project Breakdown</CardTitle>
                  <p className="text-sm text-gray-600">Detailed cost breakdown for your project</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-0">
                    {quote.lineItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-start p-6 border-b border-gray-100 last:border-0">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.category}</p>
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">{formatCurrency(item.totalPrice)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Color Verification Section */}
            {quote.showColorVerification && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-blue-600" />
                    {quote.colorVerificationTitle || "Color Verification"}
                  </CardTitle>
                  {quote.colorVerificationDescription && (
                    <p className="text-sm text-gray-600">{quote.colorVerificationDescription}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {quote.paintColors && Object.keys(quote.paintColors).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(quote.paintColors).map(([area, color]) => (
                        <div key={area} className="text-center">
                          <div
                            className="w-full h-20 rounded-lg border-2 border-gray-200 mb-2"
                            style={{ backgroundColor: color }}
                          />
                          <p className="text-sm font-medium text-gray-900">{area}</p>
                          <p className="text-xs text-gray-600">{color}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Permit Information */}
            {quote.permitRequired && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    Permit Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{quote.permitDetails}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Quote Summary */}
          <div className="space-y-6">
            {/* Quote Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quote Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.taxAmount && parseFloat(quote.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{formatCurrency(quote.taxAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold">{formatCurrency(quote.totalAmount)}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Valid until {formatDate(quote.validUntil)}
                </p>
              </CardContent>
            </Card>

            {/* Payment Schedule */}
            {(quote.downPaymentPercentage || quote.milestonePaymentPercentage || quote.finalPaymentPercentage) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Schedule</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                  
                  {quote.milestoneDescription && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm font-medium text-gray-900 mb-1">Milestone:</p>
                      <p className="text-sm text-gray-600">{quote.milestoneDescription}</p>
                    </div>
                  )}

                  {quote.acceptsCreditCards && quote.creditCardProcessingFee && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-800">
                        Credit Card Processing: {quote.creditCardProcessingFee}% processing fee will be added when paying with credit cards.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{quote.customerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{quote.customerPhone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Before/After Images */}
        {beforeAfterPairs && beforeAfterPairs.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Before & After</CardTitle>
              <p className="text-sm text-gray-600">Visual examples of our work</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {beforeAfterPairs.map((pair) => (
                  <BeforeAfterSlider
                    key={pair.id}
                    beforeImage={pair.beforeImageUrl}
                    afterImage={pair.afterImageUrl}
                    title={pair.title}
                    description={pair.description}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Images */}
        {quote.images && quote.images.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Project Gallery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <p className="text-sm text-gray-600">
              {pendingResponse === "accepted" 
                ? "You are about to accept this quote. We will contact you shortly to discuss next steps."
                : "You are about to decline this quote. Please let us know if you have any concerns."
              }
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <Textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Any additional comments or questions..."
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowResponseDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={confirmResponse} 
                disabled={respondMutation.isPending}
                className="flex-1"
              >
                {respondMutation.isPending ? "Submitting..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}