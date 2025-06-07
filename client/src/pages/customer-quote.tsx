import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, X, MessageSquare, Calendar, MapPin, Clock, Phone, Mail, Shield, Award, Star, FileText, DollarSign, Calculator, Wrench, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

interface QuoteResponse {
  id: number;
  quoteNumber: string;
  title: string;
  description?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  projectType: string;
  location?: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  downPaymentPercentage: number;
  milestonePaymentPercentage: number;
  finalPaymentPercentage: number;
  milestoneDescription?: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  validUntil: string;
  status: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeImageCaption?: string;
  afterImageCaption?: string;
  projectNotes?: string;
  scopeDescription?: string;
  lineItems?: Array<{
    id: number;
    category: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    totalPrice: string;
  }>;
  responses?: Array<{
    id: number;
    action: string;
    customerName?: string;
    customerEmail?: string;
    message?: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [showResponse, setShowResponse] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: [`/api/quotes/public/${token}`],
    enabled: !!token,
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (data: { action: string; customerName: string; customerEmail: string; message: string }) => {
      return await apiRequest(`/api/quotes/public/${token}/respond`, "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Response Sent",
        description: "Your response has been sent successfully",
      });
      setShowResponse(false);
      // Refresh the quote data
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send response",
        variant: "destructive",
      });
    },
  });

  const handleResponse = (action: 'accepted' | 'declined') => {
    if (!customerName || !customerEmail) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email",
        variant: "destructive",
      });
      return;
    }

    respondMutation.mutate({
      action,
      customerName,
      customerEmail,
      message,
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const isExpired = quote && new Date() > new Date(quote.validUntil);
  const hasResponded = quote?.responses && quote.responses.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
              <p className="text-gray-600 mb-4">
                The quote you're looking for doesn't exist or may have expired.
              </p>
              <p className="text-sm text-gray-500">
                Please check the link or contact us for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quoteData = quote as QuoteResponse;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-full p-3">
                <Home className="h-8 w-8" />
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold">Kolmo Construction</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-emerald-100 mt-1">
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    <span>Licensed & Insured</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    <span>EPA Certified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>Seattle's Premier Builder</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="flex flex-col sm:items-end gap-2">
                <a href="tel:+12064105100" className="flex items-center gap-2 text-emerald-100 hover:text-white transition-colors">
                  <Phone className="h-4 w-4" />
                  <span className="font-semibold">(206) 410-5100</span>
                </a>
                <a href="mailto:projects@kolmo.io" className="flex items-center gap-2 text-emerald-100 hover:text-white transition-colors">
                  <Mail className="h-4 w-4" />
                  <span>projects@kolmo.io</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Quote Overview Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-6 w-6" />
                  <h2 className="text-2xl font-bold">Project Proposal</h2>
                  <Badge 
                    variant={isExpired ? "destructive" : hasResponded ? "secondary" : "default"}
                    className="bg-white/20 text-white border-white/30"
                  >
                    {isExpired ? "Expired" : hasResponded ? "Responded" : "Awaiting Response"}
                  </Badge>
                </div>
                <p className="text-emerald-100 text-lg">Quote #{quoteData.quoteNumber}</p>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-emerald-100 text-sm">Valid Until</div>
                <div className="text-white font-semibold text-lg">{formatDate(quoteData.validUntil)}</div>
                <div className="text-emerald-100 text-sm mt-1">Created {formatDate(quoteData.createdAt)}</div>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-emerald-50 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{formatCurrency(quoteData.total)}</div>
                <div className="text-slate-600 text-sm">Total Investment</div>
              </div>
              <div className="text-center">
                <div className="bg-emerald-50 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {quoteData.estimatedStartDate ? formatDate(quoteData.estimatedStartDate) : "TBD"}
                </div>
                <div className="text-slate-600 text-sm">Estimated Start</div>
              </div>
              <div className="text-center">
                <div className="bg-emerald-50 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Wrench className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-lg font-semibold text-slate-900">{quoteData.lineItems?.length || 0}</div>
                <div className="text-slate-600 text-sm">Project Components</div>
              </div>
            </div>
          </div>
        </div>

        {/* Response Required Section */}
        {!hasResponded && !isExpired && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg text-white p-6">
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-blue-200" />
              <h3 className="text-2xl font-bold mb-2">Ready to Transform Your Space?</h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                We're excited to bring your vision to life with our expert craftsmanship. 
                Please review the details and let us know how you'd like to proceed.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => setShowResponse(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-semibold"
                  size="lg"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Accept This Proposal
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowResponse(true)}
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 px-8 py-3"
                  size="lg"
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Ask Questions
                </Button>
              </div>
              <p className="text-blue-200 text-sm mt-4">
                Valid until {formatDate(quoteData.validUntil)} • Free consultations available
              </p>
            </div>
          </div>
        )}

        {/* Project Information */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Project Details</h3>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-2xl font-bold text-slate-900 mb-2">{quoteData.title}</h4>
              <div className="flex items-center gap-2 text-emerald-600 font-medium mb-4">
                <Home className="h-5 w-5" />
                <span>{quoteData.projectType}</span>
              </div>
              {quoteData.description && (
                <p className="text-slate-700 leading-relaxed">{quoteData.description}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-slate-500">Location</div>
                  <div className="font-semibold text-slate-900">{quoteData.location || "To be determined"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <Calendar className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-slate-500">Project Start</div>
                  <div className="font-semibold text-slate-900">
                    {quoteData.estimatedStartDate ? formatDate(quoteData.estimatedStartDate) : "To be scheduled"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <Clock className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-slate-500">Completion</div>
                  <div className="font-semibold text-slate-900">
                    {quoteData.estimatedCompletionDate ? formatDate(quoteData.estimatedCompletionDate) : "To be determined"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        {quoteData.lineItems && quoteData.lineItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Calculator className="h-6 w-6 text-emerald-600" />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Investment Breakdown</h3>
                  <p className="text-slate-600">Transparent pricing for every component</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {quoteData.lineItems.map((item, index) => (
                  <div key={item.id} className="group hover:bg-slate-50 rounded-xl p-4 transition-colors border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-emerald-100 rounded-full p-2">
                            <Wrench className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{item.category}</h4>
                            <p className="text-slate-600 text-sm">{item.description}</p>
                          </div>
                        </div>
                        <div className="text-sm text-slate-500 ml-11">
                          {parseFloat(item.quantity)} {item.unit} × {formatCurrency(item.unitPrice)} each
                        </div>
                      </div>
                      <div className="text-right sm:text-left">
                        <div className="text-xl font-bold text-slate-900">{formatCurrency(item.totalPrice)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Before/After Images */}
        {(quoteData.beforeImageUrl || quoteData.afterImageUrl) && (
          <Card>
            <CardHeader>
              <CardTitle>Project Transformation</CardTitle>
              <CardDescription>Conceptual view - not for acceptance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quoteData.beforeImageUrl && (
                  <div className="text-center">
                    <img 
                      src={quoteData.beforeImageUrl} 
                      alt="Before" 
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
                    <p className="text-sm text-gray-600">{quoteData.beforeImageCaption || "Before"}</p>
                  </div>
                )}
                {quoteData.afterImageUrl && (
                  <div className="text-center">
                    <img 
                      src={quoteData.afterImageUrl} 
                      alt="After" 
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
                    <p className="text-sm text-gray-600">{quoteData.afterImageCaption || "After"}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">
                <strong>Professional Transformation:</strong> See the quality difference our expert craftsmanship makes. 
                This is the level of excellence you can expect for your project.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quote Summary */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl shadow-lg text-white p-6">
          <div className="text-center mb-6">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-emerald-200" />
            <h3 className="text-2xl font-bold mb-2">Investment Summary</h3>
            <p className="text-emerald-100">Your complete project investment</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center text-emerald-100">
              <span className="text-lg">Project Subtotal</span>
              <span className="text-lg font-semibold">{formatCurrency(quoteData.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-100">
              <span className="text-lg">Tax ({parseFloat(quoteData.taxRate)}%)</span>
              <span className="text-lg font-semibold">{formatCurrency(quoteData.taxAmount)}</span>
            </div>
            <Separator className="bg-white/20" />
            <div className="flex justify-between items-center text-white">
              <span className="text-2xl font-bold">Total Investment</span>
              <span className="text-3xl font-bold">{formatCurrency(quoteData.total)}</span>
            </div>
            <div className="text-center text-emerald-100 text-sm mt-4 p-3 bg-white/10 rounded-lg">
              <Clock className="h-4 w-4 inline mr-2" />
              This quote is valid until {formatDate(quoteData.validUntil)}
            </div>
          </div>
        </div>

        {/* Payment Schedule */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="text-xl font-bold text-slate-900">Payment Schedule</h3>
                <p className="text-slate-600">Flexible payment structure to fit your budget</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-emerald-50 rounded-xl border-2 border-emerald-100">
                <div className="bg-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg">1</div>
                <h4 className="font-bold text-slate-900 mb-2">Down Payment</h4>
                <div className="text-3xl font-bold text-emerald-600 mb-2">{quoteData.downPaymentPercentage}%</div>
                <div className="text-2xl font-semibold text-slate-900 mb-2">
                  {formatCurrency((parseFloat(quoteData.total) * quoteData.downPaymentPercentage / 100).toString())}
                </div>
                <p className="text-slate-600 text-sm">To secure your project start date</p>
              </div>
              
              <div className="text-center p-6 bg-blue-50 rounded-xl border-2 border-blue-100">
                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg">2</div>
                <h4 className="font-bold text-slate-900 mb-2">Progress Payment</h4>
                <div className="text-3xl font-bold text-blue-600 mb-2">{quoteData.milestonePaymentPercentage}%</div>
                <div className="text-2xl font-semibold text-slate-900 mb-2">
                  {formatCurrency((parseFloat(quoteData.total) * quoteData.milestonePaymentPercentage / 100).toString())}
                </div>
                <p className="text-slate-600 text-sm">At project milestone completion</p>
              </div>
              
              <div className="text-center p-6 bg-green-50 rounded-xl border-2 border-green-100">
                <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg">3</div>
                <h4 className="font-bold text-slate-900 mb-2">Final Payment</h4>
                <div className="text-3xl font-bold text-green-600 mb-2">{quoteData.finalPaymentPercentage}%</div>
                <div className="text-2xl font-semibold text-slate-900 mb-2">
                  {formatCurrency((parseFloat(quoteData.total) * quoteData.finalPaymentPercentage / 100).toString())}
                </div>
                <p className="text-slate-600 text-sm">Upon project completion</p>
              </div>
            </div>
            
            {quoteData.milestoneDescription && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h5 className="font-semibold text-slate-900 mb-2">Progress Milestone Details:</h5>
                <p className="text-slate-700">{quoteData.milestoneDescription}</p>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-slate-900 mb-1">Payment Options & Protection</h5>
                  <ul className="text-slate-700 text-sm space-y-1">
                    <li>• We accept cash, check, and all major credit cards</li>
                    <li>• 3% processing fee applies to credit card payments</li>
                    <li>• All payments are secured and protected</li>
                    <li>• Flexible scheduling available upon request</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Scope */}
        {quoteData.scopeDescription && (
          <Card>
            <CardHeader>
              <CardTitle>Project Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p>{quoteData.scopeDescription}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>{quoteData.customerName}</strong>
              </div>
              <div>{quoteData.customerEmail}</div>
              {quoteData.customerPhone && <div>{quoteData.customerPhone}</div>}
              {quoteData.customerAddress && <div>{quoteData.customerAddress}</div>}
            </div>
            {quoteData.projectNotes && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <div className="text-sm font-medium mb-1">Project Notes</div>
                <div className="text-sm text-gray-600">{quoteData.projectNotes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Questions?
            </CardTitle>
            <CardDescription>
              Have questions about this quote? We're here to help.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">(206) 410-5100</p>
              <p className="text-gray-600">projects@kolmo.io</p>
              <p className="text-sm text-gray-500">Seattle, WA & Surrounding Areas</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 border-t">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/api/placeholder/40/40" alt="Kolmo Construction" className="h-8 w-8" />
            <span className="font-semibold">Kolmo Construction</span>
          </div>
          <p className="text-sm text-gray-600">
            Professional home improvement services with over a decade of experience in the Pacific Northwest.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Licensed, Bonded & Insured • EPA Lead-Safe Certified
          </p>
          <p className="text-xs text-gray-400 mt-4">
            © 2024 Kolmo Construction. All rights reserved.
          </p>
        </div>
      </div>

      {/* Response Dialog */}
      {showResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Respond to Quote</CardTitle>
              <CardDescription>
                Please provide your contact information and response
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Your Name</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email Address</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Any additional comments or questions..."
                  />
                </div>
              </div>
            </CardContent>
            <div className="flex justify-between p-6 pt-0">
              <Button variant="outline" onClick={() => setShowResponse(false)}>
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleResponse('declined')}
                  disabled={respondMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  Decline Quote
                </Button>
                <Button
                  onClick={() => handleResponse('accepted')}
                  disabled={respondMutation.isPending}
                >
                  Accept Quote
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}