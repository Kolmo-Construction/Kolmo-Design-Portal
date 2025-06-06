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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Professional Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col space-y-6 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
                <img 
                  src={kolmoLogoPath} 
                  alt="Kolmo Construction" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Kolmo Construction</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    <Shield className="w-3 h-3 mr-1" />
                    Licensed & Bonded
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    EPA RRP Certified
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    OSHA 40 Certified
                  </Badge>
                </div>
                <p className="text-slate-600 text-sm mt-2">
                  EPA RRP (Renovation, Repair, and Painting) certified for lead-safe work practices in Washington State
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-1">
              <div className="flex items-center justify-start sm:justify-end space-x-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="text-slate-700 font-semibold">(206) 410-5100</span>
              </div>
              <div className="flex items-center justify-start sm:justify-end space-x-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-accent font-semibold">projects@kolmo.io</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Quote Header Card */}
        <Card className="mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-secondary p-6 sm:p-8 text-white">
            <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
              <div className="space-y-2">
                <Badge className="bg-white/20 text-white border-white/30 w-fit">
                  <Clock className="w-3 h-3 mr-1" />
                  Quote Proposal
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{quote.projectTitle}</h2>
                <p className="text-white/90 text-lg">Quote #{quote.quoteNumber}</p>
                <p className="text-white/80">Valid until {formatDate(quote.validUntil)}</p>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-4xl sm:text-5xl font-bold mb-2">
                  {formatCurrency(quote.totalAmount)}
                </div>
                <p className="text-white/90 font-semibold text-lg">Total Investment</p>
                <div className="flex flex-wrap justify-center sm:justify-end gap-2 mt-4">
                  {isExpired && (
                    <Badge variant="destructive" className="bg-red-500 text-white">
                      Quote Expired
                    </Badge>
                  )}
                  {hasResponded && (
                    <Badge className="bg-green-500 text-white">
                      Response Received
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <p className="text-xl text-slate-700 mb-2">Prepared for</p>
              <h3 className="text-2xl font-bold text-slate-900">{quote.customerName}</h3>
            </div>
          </CardContent>
        </Card>

        {/* Project & Contact Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Project Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                  <Building className="w-4 h-4 text-primary" />
                </div>
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Project Type</span>
                  <span className="font-semibold text-slate-900">{quote.projectType}</span>
                </div>
                {quote.projectLocation && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-600 font-medium">Location</span>
                    <span className="font-semibold text-slate-900 text-right">{quote.projectLocation}</span>
                  </div>
                )}
                {quote.estimatedStartDate && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-600 font-medium">Est. Start</span>
                    <span className="font-semibold text-slate-900">{formatDate(quote.estimatedStartDate)}</span>
                  </div>
                )}
                {quote.estimatedCompletionDate && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-600 font-medium">Est. Completion</span>
                    <span className="font-semibold text-slate-900">{formatDate(quote.estimatedCompletionDate)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center mr-3">
                  <User className="w-4 h-4 text-accent" />
                </div>
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                  <Mail className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-800 font-medium break-all">{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <Phone className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-800 font-medium">{quote.customerPhone}</span>
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-800 font-medium">{quote.customerAddress}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project Description */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              Project Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="text-slate-700 leading-relaxed text-lg">{quote.projectDescription}</p>
            </div>
          </CardContent>
        </Card>

        {/* Project Breakdown */}
        {quote.lineItems && quote.lineItems.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mr-3">
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
                Project Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
                      <th className="text-center py-3 px-2 font-medium text-slate-600">Qty</th>
                      <th className="text-center py-3 px-2 font-medium text-slate-600">Unit</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Unit Price</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item: any, index: number) => (
                      <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium text-slate-800">{item.category}</div>
                            <div className="text-sm text-slate-600">{item.description}</div>
                          </div>
                        </td>
                        <td className="text-center py-4 px-2 text-slate-800">{item.quantity}</td>
                        <td className="text-center py-4 px-2 text-slate-600">{item.unit}</td>
                        <td className="text-right py-4 px-4 text-slate-800">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right py-4 px-4 font-medium text-slate-800">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Summary Section */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Subtotal</span>
                    <span className="text-slate-800 font-semibold">{formatCurrency(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Tax</span>
                    <span className="text-slate-800 font-semibold">{formatCurrency(quote.taxAmount)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-slate-800">Total</span>
                      <span className="text-2xl font-bold text-accent">{formatCurrency(quote.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Transformations */}
        {beforeAfterPairs && beforeAfterPairs.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <Camera className="w-5 h-5 text-green-600" />
                </div>
                Project Transformations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {beforeAfterPairs.map((pair) => (
                  <div key={pair.id} className="border border-slate-200 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-slate-800 mb-2">{pair.title}</h4>
                    {pair.description && (
                      <p className="text-slate-600 mb-4">{pair.description}</p>
                    )}
                    {(pair.beforeImageUrl && pair.afterImageUrl) ? (
                      <BeforeAfterSlider
                        beforeImageUrl={pair.beforeImageUrl || undefined}
                        afterImageUrl={pair.afterImageUrl || undefined}
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {pair.beforeImageUrl && (
                          <div className="space-y-2">
                            <div className="aspect-video rounded-lg overflow-hidden border">
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
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                Before
                              </Badge>
                            </div>
                          </div>
                        )}
                        {pair.afterImageUrl && (
                          <div className="space-y-2">
                            <div className="aspect-video rounded-lg overflow-hidden border">
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
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                After
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Project Images */}
        {quote.images && quote.images.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Camera className="w-5 h-5 text-blue-600" />
                </div>
                Project Gallery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {quote.images.map((image: any) => (
                  <div key={image.id} className="group">
                    <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
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
            </CardContent>
          </Card>
        )}

        {/* Payment Information */}
        {(quote.downPaymentPercentage || quote.acceptsCreditCards) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mr-3">
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Payment Schedule */}
              {(quote.downPaymentPercentage || quote.milestonePaymentPercentage || quote.finalPaymentPercentage) && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-4">Payment Schedule</h4>
                  <div className="space-y-4">
                    {quote.downPaymentPercentage && (
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-800">Down Payment</span>
                          <p className="text-sm text-slate-600">Due upon contract signing ({quote.downPaymentPercentage}%)</p>
                        </div>
                        <span className="text-xl font-bold text-accent">
                          {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.downPaymentPercentage) / 100).toString())}
                        </span>
                      </div>
                    )}
                    {quote.milestonePaymentPercentage && (
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-800">Milestone Payment</span>
                          <p className="text-sm text-slate-600">
                            {quote.milestoneDescription || `At project milestone (${quote.milestonePaymentPercentage}%)`}
                          </p>
                        </div>
                        <span className="text-xl font-bold text-accent">
                          {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.milestonePaymentPercentage) / 100).toString())}
                        </span>
                      </div>
                    )}
                    {quote.finalPaymentPercentage && (
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-800">Final Payment</span>
                          <p className="text-sm text-slate-600">Upon project completion ({quote.finalPaymentPercentage}%)</p>
                        </div>
                        <span className="text-xl font-bold text-accent">
                          {formatCurrency((parseFloat(quote.totalAmount) * parseFloat(quote.finalPaymentPercentage) / 100).toString())}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Payment Methods */}
              <div>
                <h4 className="text-lg font-semibold text-slate-800 mb-4">Accepted Payment Methods</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quote.acceptsCreditCards && (
                    <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
                      <div className="flex items-center mb-2">
                        <CheckCircle className="w-5 h-5 text-primary mr-2" />
                        <span className="font-semibold text-slate-800">Credit & Debit Cards</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {quote.creditCardProcessingFee && quote.creditCardProcessingFee.length > 0 
                          ? `${quote.creditCardProcessingFee}% processing fee applies`
                          : 'Visa, MasterCard, American Express'
                        }
                      </p>
                    </div>
                  )}
                  <div className="p-4 border border-accent/20 bg-accent/5 rounded-lg">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-accent mr-2" />
                      <span className="font-semibold text-slate-800">Bank Transfer & Check</span>
                    </div>
                    <p className="text-sm text-slate-600">No additional processing fees</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Response Required Section */}
        {!hasResponded && !isExpired && (
          <Card className="mb-8 bg-gradient-to-br from-primary to-secondary text-white border-0">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <Clock className="w-12 h-12 mx-auto mb-4 text-white/80" />
                <h3 className="text-2xl sm:text-3xl font-bold mb-3">Response Required</h3>
                <p className="text-white/90 text-lg">
                  Please review this quote and let us know if you'd like to proceed. Valid until {formatDate(quote.validUntil)}.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button 
                  onClick={() => handleResponse("accepted")}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  size="lg"
                >
                  <CheckCircle className="w-6 h-6 mr-2" />
                  Accept Quote
                </Button>
                <Button 
                  onClick={() => handleResponse("declined")}
                  variant="outline"
                  className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 py-4 text-lg font-semibold rounded-lg backdrop-blur-sm transition-all duration-200"
                  size="lg"
                >
                  <XCircle className="w-6 h-6 mr-2" />
                  Decline Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Response Status */}
        {hasResponded && (
          <Card className="mb-8">
            <CardContent className="p-6 sm:p-8">
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
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  {quote.customerResponse === "accepted" ? "Quote Accepted!" : "Quote Declined"}
                </h3>
                <p className="text-slate-600 text-base">
                  Response received on {formatDate(quote.respondedAt)}
                </p>
                {quote.customerResponse === "accepted" && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 text-lg font-medium">
                      Thank you for choosing Kolmo Construction! Our team will contact you within 24 hours to discuss next steps.
                    </p>
                  </div>
                )}
              </div>
              {quote.customerNotes && (
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-100">
                  <h4 className="font-semibold text-slate-800 mb-3">Your Message:</h4>
                  <p className="text-slate-700 leading-relaxed">{quote.customerNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
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

        {/* Company Information Footer */}
        <Card className="mt-8">
          <CardContent className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                  <Phone className="w-5 h-5 mr-2 text-primary" />
                  Contact Information
                </h4>
                <div className="space-y-3 text-slate-600">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>(206) 410-5100</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>projects@kolmo.io</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <span>4018 NE 125th St<br />Seattle, WA 98125</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-accent" />
                  Business Hours
                </h4>
                <div className="space-y-2 text-slate-600">
                  <div className="flex justify-between">
                    <span>Monday - Friday:</span>
                    <span>8:00 AM - 5:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday:</span>
                    <span>9:00 AM - 1:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday:</span>
                    <span>Closed</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center">
                  <Building className="w-5 h-5 mr-2 text-green-600" />
                  About Kolmo
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  Licensed and bonded general contractor delivering high-quality residential and commercial construction services with smart technology, transparency, and expert craftsmanship.
                </p>
              </div>
            </div>
            
            <div className="flex justify-center items-center mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-lg shadow-sm border border-slate-200 p-2 flex items-center justify-center">
                  <img 
                    src={kolmoLogoPath} 
                    alt="Kolmo Construction" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 text-lg">Kolmo Construction</p>
                  <p className="text-slate-500 text-sm">Innovate Everyday. Residential & Commercial</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}