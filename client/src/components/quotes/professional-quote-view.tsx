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
import { MultipleBeforeAfterSlider } from "./multiple-before-after-slider";

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
  beforeAfterPairs?: Array<{
    id: number;
    title: string;
    description?: string;
    beforeImageUrl: string;
    afterImageUrl: string;
    sortOrder: number;
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
      {/* Mobile-First Kolmo Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-start sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                <img 
                  src={kolmoLogoPath} 
                  alt="Kolmo Construction" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary tracking-tight">Kolmo Construction</h1>
                <p className="text-slate-600 text-sm sm:text-base font-medium mt-1">Licensed & Bonded General Contractor</p>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">WA License #KOLMO*123BC</p>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-1 text-sm sm:text-base">
              <p className="text-slate-700 font-medium">4018 NE 125th St</p>
              <p className="text-slate-700 font-medium">Seattle, WA 98125</p>
              <p className="text-slate-700 font-medium">(206) 410-5100</p>
              <p className="text-accent font-semibold">projects@kolmo.io</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Mobile-First Quote Header */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8 mb-6">
          <div className="space-y-6">
            {/* Quote Badge */}
            <div className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-accent/10 text-accent text-xs sm:text-sm font-semibold">
              <span className="w-2 h-2 bg-accent rounded-full mr-2"></span>
              QUOTE PROPOSAL
            </div>
            
            {/* Project Title */}
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2 leading-tight">{quote.projectTitle}</h2>
              <p className="text-slate-600 text-base sm:text-lg lg:text-xl">Quote #{quote.quoteNumber}</p>
              <p className="text-muted-foreground text-sm sm:text-base mt-1">Prepared for {quote.customerName}</p>
            </div>
            
            {/* Total Investment - Mobile First */}
            <div className="bg-slate-50 rounded-xl p-4 sm:p-6 border border-slate-100">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-accent mb-2">
                  {formatCurrency(quote.totalAmount)}
                </div>
                <p className="text-slate-700 font-semibold text-base sm:text-lg">Total Investment</p>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="font-medium">Valid until {formatDate(quote.validUntil)}</p>
                  <div className="flex justify-center mt-3 space-x-2">
                    {isExpired && (
                      <Badge variant="destructive">
                        Quote Expired
                      </Badge>
                    )}
                    {hasResponded && (
                      <Badge variant="secondary">
                        Response Received
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile-First Info Sections */}
          <div className="space-y-6 pt-6 border-t border-slate-100">
            {/* Project Details */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-primary mb-4 flex items-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg sm:rounded-xl flex items-center justify-center mr-3">
                  <Building className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                Project Details
              </h3>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                  <span className="text-muted-foreground font-medium text-sm sm:text-base">Project Type:</span>
                  <span className="font-semibold text-slate-800 text-sm sm:text-base">{quote.projectType}</span>
                </div>
                {quote.projectLocation && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                    <span className="text-muted-foreground font-medium text-sm sm:text-base">Location:</span>
                    <span className="font-semibold text-slate-800 text-sm sm:text-base">{quote.projectLocation}</span>
                  </div>
                )}
                {quote.estimatedStartDate && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                    <span className="text-muted-foreground font-medium text-sm sm:text-base">Est. Start:</span>
                    <span className="font-semibold text-slate-800 text-sm sm:text-base">{formatDate(quote.estimatedStartDate)}</span>
                  </div>
                )}
                {quote.estimatedCompletionDate && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-1 sm:space-y-0">
                    <span className="text-muted-foreground font-medium text-sm sm:text-base">Est. Completion:</span>
                    <span className="font-semibold text-slate-800 text-sm sm:text-base">{formatDate(quote.estimatedCompletionDate)}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Contact Information */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-primary mb-4 flex items-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/10 rounded-lg sm:rounded-xl flex items-center justify-center mr-3">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                </div>
                Contact Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-slate-800 font-medium text-sm sm:text-base break-all">{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-slate-800 font-medium text-sm sm:text-base">{quote.customerPhone}</span>
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-slate-800 font-medium text-sm sm:text-base">{quote.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8 mb-6">
          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-primary mb-6 flex items-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-lg sm:rounded-xl flex items-center justify-center mr-3">
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

        {/* Multiple Before/After Image Pairs */}
        {quote.beforeAfterPairs && quote.beforeAfterPairs.length > 0 && (
          <MultipleBeforeAfterSlider pairs={quote.beforeAfterPairs} />
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
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8 mb-6">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-primary mb-6 flex items-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-accent/10 rounded-lg sm:rounded-xl flex items-center justify-center mr-3">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-accent" />
              </div>
              Payment Structure
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

        {/* Mobile-First Decision Section */}
        {!hasResponded && !isExpired && (
          <div className="bg-gradient-to-br from-primary to-secondary rounded-xl sm:rounded-2xl shadow-lg border border-primary/20 p-4 sm:p-6 lg:p-8 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3">Ready to Start Your Project?</h3>
              <p className="text-primary-foreground/90 text-sm sm:text-base lg:text-lg px-2">
                Let's bring your vision to life with Kolmo's expert craftsmanship.
              </p>
            </div>
            <div className="space-y-3 sm:space-y-0 sm:flex sm:gap-4">
              <Button 
                onClick={() => handleResponse("accepted")}
                className="w-full sm:flex-1 bg-accent hover:bg-accent/90 text-white py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
              >
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Yes, Let's Begin
              </Button>
              <Button 
                onClick={() => handleResponse("declined")}
                variant="outline"
                className="w-full sm:flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20 py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-xl backdrop-blur-sm transition-all duration-200"
                size="lg"
              >
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Not Right Now
              </Button>
            </div>
            <div className="text-center mt-6">
              <p className="text-primary-foreground/80 text-xs sm:text-sm px-2">
                Questions? Contact us at <br className="sm:hidden" />
                <span className="font-semibold text-accent">(206) 410-5100</span> or <br className="sm:hidden" />
                <span className="font-semibold text-accent">projects@kolmo.io</span>
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