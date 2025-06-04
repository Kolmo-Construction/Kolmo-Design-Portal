import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { CheckCircle, XCircle, Calendar, MapPin, Phone, Mail, FileText, Image as ImageIcon, DollarSign, Clock, Building2 } from "lucide-react";
import kolmoLogoPath from "@assets/kolmo-logo (1).png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 flex items-center justify-center">
                <img 
                  src={kolmoLogoPath} 
                  alt="Kolmo Construction" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800 font-montserrat">Kolmo Construction</h1>
                <p className="text-slate-600 text-lg">Licensed & Bonded General Contractor</p>
                <p className="text-slate-500 text-sm mt-1">WA License #KOLMO*123BC</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-slate-600 font-medium">4018 NE 125th St</p>
              <p className="text-slate-600 font-medium">Seattle, WA 98125</p>
              <p className="text-slate-600 font-medium">(206) 410-5100</p>
              <p className="text-orange-600 font-medium">projects@kolmo.io</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Quote Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium mb-4">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                QUOTE PROPOSAL
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2 font-montserrat">{quote.projectTitle}</h2>
              <p className="text-slate-600 text-lg">Quote #{quote.quoteNumber}</p>
              <p className="text-slate-500 text-sm mt-1">Prepared for {quote.customerName}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-orange-500 mb-2">
                {formatCurrency(quote.totalAmount)}
              </div>
              <p className="text-slate-600 font-medium">Total Investment</p>
              <div className="mt-4 text-sm text-slate-500">
                <p>Valid until {formatDate(quote.validUntil)}</p>
                {isExpired && (
                  <Badge variant="destructive" className="mt-2">
                    Quote Expired
                  </Badge>
                )}
                {hasResponded && (
                  <Badge variant="secondary" className="mt-2">
                    Response Received
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Project Info Grid */}
          <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-gray-100">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center font-montserrat">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                Project Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Project Type:</span>
                  <span className="font-medium text-slate-800">{quote.projectType}</span>
                </div>
                {quote.projectLocation && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Location:</span>
                    <span className="font-medium text-slate-800">{quote.projectLocation}</span>
                  </div>
                )}
                {quote.estimatedStartDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Est. Start:</span>
                    <span className="font-medium text-slate-800">{formatDate(quote.estimatedStartDate)}</span>
                  </div>
                )}
                {quote.estimatedCompletionDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Est. Completion:</span>
                    <span className="font-medium text-slate-800">{formatDate(quote.estimatedCompletionDate)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center font-montserrat">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                Contact Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-800">{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-800">{quote.customerPhone}</span>
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-800">{quote.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            Complete Exterior Paint Renovation
          </h3>
          
          <div className="prose max-w-none mb-8">
            <p className="text-slate-700 leading-relaxed text-lg">{quote.projectDescription}</p>
          </div>

          {/* Line Items */}
          {quote.lineItems && quote.lineItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h4 className="font-semibold text-slate-800">Project Breakdown</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-6 font-medium text-slate-600">Description</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Qty</th>
                      <th className="text-center py-3 px-4 font-medium text-slate-600">Unit</th>
                      <th className="text-right py-3 px-6 font-medium text-slate-600">Unit Price</th>
                      <th className="text-right py-3 px-6 font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-medium text-slate-800">{item.category}</div>
                            <div className="text-sm text-slate-600">{item.description}</div>
                          </div>
                        </td>
                        <td className="text-center py-4 px-4 text-slate-800">{item.quantity}</td>
                        <td className="text-center py-4 px-4 text-slate-600">{item.unit}</td>
                        <td className="text-right py-4 px-6 text-slate-800">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right py-4 px-6 font-medium text-slate-800">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={4} className="text-right py-4 px-6 font-medium text-slate-700">Subtotal:</td>
                      <td className="text-right py-4 px-6 font-medium text-slate-800">
                        {formatCurrency(quote.subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-right py-2 px-6 text-slate-600">Tax:</td>
                      <td className="text-right py-2 px-6 text-slate-800">
                        {formatCurrency(quote.taxAmount)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-300">
                      <td colSpan={4} className="text-right py-4 px-6 text-lg font-bold text-slate-800">Total:</td>
                      <td className="text-right py-4 px-6 text-lg font-bold text-orange-600">
                        {formatCurrency(quote.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Before/After Images */}
        {quote.showBeforeAfter && (quote.beforeImageUrl || quote.afterImageUrl) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <ImageIcon className="w-4 h-4 text-purple-600" />
              </div>
              Project Images
            </h3>
            <BeforeAfterSlider
              beforeImageUrl={quote.beforeImageUrl}
              afterImageUrl={quote.afterImageUrl}
              title={quote.beforeAfterTitle}
              description={quote.beforeAfterDescription}
            />
          </div>
        )}

        {/* Additional Project Images */}
        {quote.images && quote.images.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
              </div>
              Exterior Transformation Preview
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quote.images.map((image) => (
                <div key={image.id} className="group">
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={image.imageUrl}
                      alt={image.caption || "Project image"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  {image.caption && (
                    <p className="text-sm text-slate-600 mt-2">{image.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        {(quote.downPaymentPercentage || quote.acceptsCreditCards) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <DollarSign className="w-4 h-4 text-yellow-600" />
              </div>
              Payment Schedule
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-medium text-slate-800 mb-4">Payment Structure</h4>
                <div className="space-y-3">
                  {quote.downPaymentPercentage && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-slate-600">Down Payment ({quote.downPaymentPercentage}%):</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.downPaymentPercentage) / 100).toString())}
                      </span>
                    </div>
                  )}
                  {quote.milestonePaymentPercentage && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-slate-600">Milestone Payment ({quote.milestonePaymentPercentage}%):</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.milestonePaymentPercentage) / 100).toString())}
                      </span>
                    </div>
                  )}
                  {quote.milestoneDescription && quote.milestoneDescription.length > 0 && (
                    <p className="text-sm text-slate-600 italic">
                      {quote.milestoneDescription}
                    </p>
                  )}
                  {quote.finalPaymentPercentage && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-slate-600">Final Payment ({quote.finalPaymentPercentage}%):</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.finalPaymentPercentage) / 100).toString())}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-800 mb-4">Payment Options</h4>
                <div className="space-y-3">
                  {quote.acceptsCreditCards && (
                    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                      <div className="flex items-center mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                        <span className="font-medium text-green-800">Credit Cards Accepted</span>
                      </div>
                      {quote.creditCardProcessingFee && quote.creditCardProcessingFee.length > 0 && (
                        <p className="text-sm text-green-700">
                          Processing fee: {quote.creditCardProcessingFee}%
                        </p>
                      )}
                    </div>
                  )}
                  <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="font-medium text-blue-800">Check/Bank Transfer</span>
                    </div>
                    <p className="text-sm text-blue-700">No additional fees</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!hasResponded && !isExpired && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-xl font-semibold text-slate-800 mb-6">Ready to move forward?</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => handleResponse("accepted")}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-medium"
                size="lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Accept Quote
              </Button>
              <Button 
                onClick={() => handleResponse("declined")}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50 py-4 text-lg font-medium"
                size="lg"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Decline Quote
              </Button>
            </div>
          </div>
        )}

        {/* Response Display */}
        {hasResponded && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">Your Response</h3>
            <div className="flex items-center space-x-3 mb-4">
              {quote.customerResponse === "accepted" ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
              <span className="text-lg font-medium">
                Quote {quote.customerResponse === "accepted" ? "Accepted" : "Declined"}
              </span>
              <span className="text-sm text-slate-500">
                on {formatDate(quote.respondedAt)}
              </span>
            </div>
            {quote.customerNotes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-slate-700">{quote.customerNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Response Dialog */}
        <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pendingResponse === "accepted" ? "Accept Quote" : "Decline Quote"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-600">
                {pendingResponse === "accepted" 
                  ? "You're about to accept this quote. Would you like to add any notes?"
                  : "Please let us know if you have any feedback or would like to discuss alternatives."
                }
              </p>
              <Textarea
                placeholder="Add any notes or comments (optional)"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end space-x-3">
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

        {/* Professional Footer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-8">
          <div className="border-t pt-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h4 className="font-semibold text-slate-800 mb-4">Contact Information</h4>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4" />
                    <span>(206) 410-5100</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4" />
                    <span>projects@kolmo.io</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-4 h-4" />
                    <span>4018 NE 125th St, Seattle, WA 98125</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-slate-800 mb-4">Business Hours</h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Monday - Friday: 8:00 AM - 5:00 PM</p>
                  <p>Saturday: 9:00 AM - 1:00 PM</p>
                  <p>Sunday: Closed</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-slate-800 mb-4">About Kolmo</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Licensed and bonded general contractor delivering high-quality residential and commercial construction services with smart technology, transparency, and expert craftsmanship.
                </p>
              </div>
            </div>
            
            <div className="flex justify-center items-center mt-8 pt-6 border-t">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <img 
                    src={kolmoLogoPath} 
                    alt="Kolmo Construction" 
                    className="w-full h-full object-contain"
                  />
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