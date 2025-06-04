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
    <div className="min-h-screen bg-slate-50">
      {/* Kolmo Brand Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 flex items-center justify-center">
                <img 
                  src={kolmoLogoPath} 
                  alt="Kolmo Construction" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-primary tracking-tight">Kolmo Construction</h1>
                <p className="text-slate-600 text-lg font-medium mt-1">Licensed & Bonded General Contractor</p>
                <p className="text-muted-foreground text-sm mt-1">WA License #KOLMO*123BC</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <p className="text-slate-700 font-medium">4018 NE 125th St</p>
              <p className="text-slate-700 font-medium">Seattle, WA 98125</p>
              <p className="text-slate-700 font-medium">(206) 410-5100</p>
              <p className="text-accent font-semibold">projects@kolmo.io</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Quote Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 mb-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-6">
                <span className="w-2 h-2 bg-accent rounded-full mr-3"></span>
                QUOTE PROPOSAL
              </div>
              <h2 className="text-4xl font-bold text-primary mb-3">{quote.projectTitle}</h2>
              <p className="text-slate-600 text-xl">Quote #{quote.quoteNumber}</p>
              <p className="text-muted-foreground text-base mt-2">Prepared for {quote.customerName}</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-accent mb-3">
                {formatCurrency(quote.totalAmount)}
              </div>
              <p className="text-slate-700 font-semibold text-lg">Total Investment</p>
              <div className="mt-6 text-sm text-muted-foreground">
                <p className="font-medium">Valid until {formatDate(quote.validUntil)}</p>
                {isExpired && (
                  <Badge variant="destructive" className="mt-3">
                    Quote Expired
                  </Badge>
                )}
                {hasResponded && (
                  <Badge variant="secondary" className="mt-3">
                    Response Received
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Project Info Grid */}
          <div className="grid md:grid-cols-2 gap-10 pt-10 border-t border-slate-100">
            <div>
              <h3 className="text-xl font-semibold text-primary mb-6 flex items-center">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mr-4">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                Project Details
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Project Type:</span>
                  <span className="font-semibold text-slate-800">{quote.projectType}</span>
                </div>
                {quote.projectLocation && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Location:</span>
                    <span className="font-semibold text-slate-800">{quote.projectLocation}</span>
                  </div>
                )}
                {quote.estimatedStartDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Est. Start:</span>
                    <span className="font-semibold text-slate-800">{formatDate(quote.estimatedStartDate)}</span>
                  </div>
                )}
                {quote.estimatedCompletionDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Est. Completion:</span>
                    <span className="font-semibold text-slate-800">{formatDate(quote.estimatedCompletionDate)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-primary mb-6 flex items-center">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center mr-4">
                  <User className="w-5 h-5 text-accent" />
                </div>
                Contact Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <span className="text-slate-800 font-medium">{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center space-x-4">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <span className="text-slate-800 font-medium">{quote.customerPhone}</span>
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-center space-x-4">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <span className="text-slate-800 font-medium">{quote.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 mb-8">
          <h3 className="text-2xl font-semibold text-primary mb-8 flex items-center">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mr-4">
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
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center mr-3">
                <Camera className="w-4 h-4 text-teal-600" />
              </div>
              Project Transformation
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
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-3">
                <Camera className="w-4 h-4 text-slate-600" />
              </div>
              Additional Project Gallery
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

        {/* Investment & Payment Structure */}
        {(quote.downPaymentPercentage || quote.acceptsCreditCards) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 mb-8">
            <h3 className="text-2xl font-semibold text-primary mb-8 flex items-center">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mr-4">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              Investment & Payment Structure
            </h3>
            
            <div className="space-y-8">
              {/* Payment Breakdown */}
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-6">Payment Breakdown</h4>
                <div className="space-y-4">
                  {quote.downPaymentPercentage && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="mb-2 sm:mb-0">
                        <span className="text-slate-700 font-semibold">Initial Payment</span>
                        <div className="text-sm text-muted-foreground">Due upon contract signing ({quote.downPaymentPercentage}%)</div>
                      </div>
                      <span className="text-xl font-bold text-accent">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.downPaymentPercentage) / 100).toString())}
                      </span>
                    </div>
                  )}
                  {quote.milestonePaymentPercentage && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="mb-2 sm:mb-0">
                        <span className="text-slate-700 font-semibold">Progress Payment</span>
                        <div className="text-sm text-muted-foreground">
                          {quote.milestoneDescription || `At project milestone (${quote.milestonePaymentPercentage}%)`}
                        </div>
                      </div>
                      <span className="text-xl font-bold text-accent">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.milestonePaymentPercentage) / 100).toString())}
                      </span>
                    </div>
                  )}
                  {quote.finalPaymentPercentage && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="mb-2 sm:mb-0">
                        <span className="text-slate-700 font-semibold">Final Payment</span>
                        <div className="text-sm text-muted-foreground">Upon project completion ({quote.finalPaymentPercentage}%)</div>
                      </div>
                      <span className="text-xl font-bold text-accent">
                        {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.finalPaymentPercentage) / 100).toString())}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Payment Methods */}
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-6">Accepted Payment Methods</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  {quote.acceptsCreditCards && (
                    <div className="p-5 border border-primary/20 bg-primary/5 rounded-xl">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                          <CheckCircle className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-slate-800">Credit & Debit Cards</span>
                      </div>
                      {quote.creditCardProcessingFee && quote.creditCardProcessingFee.length > 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {quote.creditCardProcessingFee}% processing fee applies
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Visa, MasterCard, American Express
                        </p>
                      )}
                    </div>
                  )}
                  <div className="p-5 border border-accent/20 bg-accent/5 rounded-xl">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center mr-3">
                        <CheckCircle className="w-4 h-4 text-accent" />
                      </div>
                      <span className="font-semibold text-slate-800">Bank Transfer & Check</span>
                    </div>
                    <p className="text-sm text-muted-foreground">No additional processing fees</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decision Section */}
        {!hasResponded && !isExpired && (
          <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg border border-primary/20 p-6 sm:p-10 mb-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to Start Your Project?</h3>
              <p className="text-primary-foreground/90 text-base sm:text-lg max-w-2xl mx-auto">
                Let's bring your vision to life with Kolmo's expert craftsmanship and innovative approach to construction.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
              <Button 
                onClick={() => handleResponse("accepted")}
                className="flex-1 bg-accent hover:bg-accent/90 text-white py-4 sm:py-5 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
              >
                <CheckCircle className="w-6 h-6 mr-3" />
                Yes, Let's Begin
              </Button>
              <Button 
                onClick={() => handleResponse("declined")}
                variant="outline"
                className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 py-4 sm:py-5 text-lg font-semibold rounded-xl backdrop-blur-sm transition-all duration-200"
                size="lg"
              >
                <XCircle className="w-6 h-6 mr-3" />
                Not Right Now
              </Button>
            </div>
            <div className="text-center mt-6">
              <p className="text-primary-foreground/80 text-sm">
                Questions? Contact us at <span className="font-semibold text-accent">(206) 410-5100</span> or <span className="font-semibold text-accent">projects@kolmo.io</span>
              </p>
            </div>
          </div>
        )}

        {/* Response Display */}
        {hasResponded && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 mb-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 mx-auto">
                {quote.customerResponse === "accepted" ? (
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                )}
              </div>
              <h3 className="text-2xl font-bold text-primary mb-2">
                {quote.customerResponse === "accepted" ? "Quote Accepted!" : "Quote Declined"}
              </h3>
              <p className="text-muted-foreground text-base">
                Response received on {formatDate(quote.respondedAt)}
              </p>
              {quote.customerResponse === "accepted" && (
                <p className="text-slate-700 mt-4 text-lg">
                  Thank you for choosing Kolmo Construction! Our team will contact you within 24 hours to discuss next steps.
                </p>
              )}
            </div>
            {quote.customerNotes && (
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <h4 className="font-semibold text-slate-800 mb-3">Your Message:</h4>
                <p className="text-slate-700 leading-relaxed">{quote.customerNotes}</p>
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