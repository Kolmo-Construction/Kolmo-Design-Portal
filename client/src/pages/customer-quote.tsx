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
  const isExpired = quoteData && new Date() > new Date(quoteData.validUntil);
  const hasResponded = quoteData?.responses && quoteData.responses.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200" style={{color: '#1a1a1a'}}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gray-50 rounded-lg p-2">
                <img src="@assets/kolmo-logo (1).png" alt="Kolmo Constructions" className="h-12 w-12" />
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold" style={{color: '#1a1a1a'}}>Kolmo Constructions</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm mt-1" style={{color: '#4a6670'}}>
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" style={{color: '#db973c'}} />
                    <span>Licensed & Insured</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4" style={{color: '#db973c'}} />
                    <span>EPA Certified</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" style={{color: '#db973c'}} />
                    <span>Seattle's Premier Builder</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="flex flex-col sm:items-end gap-2">
                <a href="tel:+12064105100" className="flex items-center gap-2 transition-colors" style={{color: '#4a6670'}} onMouseEnter={e => e.currentTarget.style.color = '#db973c'} onMouseLeave={e => e.currentTarget.style.color = '#4a6670'}>
                  <Phone className="h-4 w-4" />
                  <span className="font-semibold">(206) 410-5100</span>
                </a>
                <a href="mailto:projects@kolmo.io" className="flex items-center gap-2 transition-colors" style={{color: '#4a6670'}} onMouseEnter={e => e.currentTarget.style.color = '#db973c'} onMouseLeave={e => e.currentTarget.style.color = '#4a6670'}>
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
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-6" style={{backgroundColor: '#3d4552', color: 'white'}}>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-6 w-6" />
                  <h2 className="text-2xl font-bold">Project Proposal</h2>
                  <Badge 
                    variant={isExpired ? "destructive" : hasResponded ? "secondary" : "default"}
                    className="px-3 py-1 text-xs font-medium"
                    style={{backgroundColor: '#db973c', color: 'white'}}
                  >
                    {isExpired ? "Expired" : hasResponded ? "Responded" : "Awaiting Response"}
                  </Badge>
                </div>
                <p className="text-white/80 text-lg">Quote #{quoteData.quoteNumber}</p>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-white/70 text-sm">Valid Until</div>
                <div className="text-white font-semibold text-lg">{formatDate(quoteData.validUntil)}</div>
                <div className="text-white/70 text-sm mt-1">Created {formatDate(quoteData.createdAt)}</div>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: '#f5f5f5'}}>
                  <DollarSign className="h-8 w-8" style={{color: '#db973c'}} />
                </div>
                <div className="text-2xl font-bold" style={{color: '#1a1a1a'}}>{formatCurrency(quoteData.total)}</div>
                <div className="text-sm" style={{color: '#4a6670'}}>Total Investment</div>
              </div>
              <div className="text-center">
                <div className="rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: '#f5f5f5'}}>
                  <Calendar className="h-8 w-8" style={{color: '#db973c'}} />
                </div>
                <div className="text-lg font-semibold" style={{color: '#1a1a1a'}}>
                  {quoteData.estimatedStartDate ? formatDate(quoteData.estimatedStartDate) : "TBD"}
                </div>
                <div className="text-sm" style={{color: '#4a6670'}}>Estimated Start</div>
              </div>
              <div className="text-center">
                <div className="rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center" style={{backgroundColor: '#f5f5f5'}}>
                  <Wrench className="h-8 w-8" style={{color: '#db973c'}} />
                </div>
                <div className="text-lg font-semibold" style={{color: '#1a1a1a'}}>{quoteData.lineItems?.length || 0}</div>
                <div className="text-sm" style={{color: '#4a6670'}}>Project Components</div>
              </div>
            </div>
          </div>
        </div>

        {/* Response Required Section */}
        {!hasResponded && !isExpired && (
          <div className="rounded-2xl shadow-lg text-white p-6" style={{backgroundColor: '#4a6670'}}>
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto mb-4" style={{color: '#db973c'}} />
              <h3 className="text-2xl font-bold mb-2">Ready to Transform Your Space?</h3>
              <p className="text-white/80 mb-6 max-w-2xl mx-auto">
                We're excited to bring your vision to life with our expert craftsmanship. 
                Please review the details and let us know how you'd like to proceed.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => setShowResponse(true)}
                  className="px-8 py-3 text-lg font-semibold text-white"
                  style={{backgroundColor: '#db973c'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c8863a'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#db973c'}
                  size="lg"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Accept This Proposal
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowResponse(true)}
                  className="px-8 py-3 text-white border-white/30"
                  style={{backgroundColor: 'rgba(255,255,255,0.1)'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  size="lg"
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Ask Questions
                </Button>
              </div>
              <p className="text-white/70 text-sm mt-4">
                Valid until {formatDate(quoteData.validUntil)} • Free consultations available
              </p>
            </div>
          </div>
        )}

        {/* Project Information */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
            <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Project Details</h3>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-2xl font-bold mb-2" style={{color: '#1a1a1a'}}>{quoteData.title}</h4>
              <div className="flex items-center gap-2 font-medium mb-4" style={{color: '#db973c'}}>
                <Home className="h-5 w-5" />
                <span>{quoteData.projectType}</span>
              </div>
              {quoteData.description && (
                <p className="leading-relaxed" style={{color: '#4a6670'}}>{quoteData.description}</p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{backgroundColor: '#f5f5f5'}}>
                <MapPin className="h-5 w-5" style={{color: '#db973c'}} />
                <div>
                  <div className="text-sm font-medium" style={{color: '#4a6670'}}>Location</div>
                  <div className="font-semibold" style={{color: '#1a1a1a'}}>{quoteData.location || "To be determined"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{backgroundColor: '#f5f5f5'}}>
                <Calendar className="h-5 w-5" style={{color: '#db973c'}} />
                <div>
                  <div className="text-sm font-medium" style={{color: '#4a6670'}}>Project Start</div>
                  <div className="font-semibold" style={{color: '#1a1a1a'}}>
                    {quoteData.estimatedStartDate ? formatDate(quoteData.estimatedStartDate) : "To be scheduled"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{backgroundColor: '#f5f5f5'}}>
                <Clock className="h-5 w-5" style={{color: '#db973c'}} />
                <div>
                  <div className="text-sm font-medium" style={{color: '#4a6670'}}>Completion</div>
                  <div className="font-semibold" style={{color: '#1a1a1a'}}>
                    {quoteData.estimatedCompletionDate ? formatDate(quoteData.estimatedCompletionDate) : "To be determined"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        {quoteData.lineItems && quoteData.lineItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
              <div className="flex items-center gap-3">
                <Calculator className="h-6 w-6" style={{color: '#db973c'}} />
                <div>
                  <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Investment Breakdown</h3>
                  <p style={{color: '#4a6670'}}>Transparent pricing for every component</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {quoteData.lineItems.map((item, index) => (
                  <div key={item.id} className="group hover:bg-gray-50 rounded-xl p-4 transition-colors border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="rounded-full p-2" style={{backgroundColor: '#f5f5f5'}}>
                            <Wrench className="h-4 w-4" style={{color: '#db973c'}} />
                          </div>
                          <div>
                            <h4 className="font-semibold" style={{color: '#1a1a1a'}}>{item.category}</h4>
                            <p className="text-sm" style={{color: '#4a6670'}}>{item.description}</p>
                          </div>
                        </div>
                        <div className="text-sm ml-11" style={{color: '#4a6670'}}>
                          {parseFloat(item.quantity)} {item.unit} × {formatCurrency(item.unitPrice)} each
                        </div>
                      </div>
                      <div className="text-right sm:text-left">
                        <div className="text-xl font-bold" style={{color: '#1a1a1a'}}>{formatCurrency(item.totalPrice)}</div>
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
        <div className="rounded-2xl shadow-lg text-white p-6" style={{backgroundColor: '#4a6670'}}>
          <div className="text-center mb-6">
            <DollarSign className="h-12 w-12 mx-auto mb-4" style={{color: '#db973c'}} />
            <h3 className="text-2xl font-bold mb-2">Investment Summary</h3>
            <p className="text-white/80">Your complete project investment</p>
          </div>
          
          <div className="backdrop-blur-sm rounded-xl p-6 space-y-4" style={{backgroundColor: 'rgba(255,255,255,0.1)'}}>
            <div className="flex justify-between items-center text-white/80">
              <span className="text-lg">Project Subtotal</span>
              <span className="text-lg font-semibold">{formatCurrency(quoteData.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-white/80">
              <span className="text-lg">Tax ({parseFloat(quoteData.taxRate)}%)</span>
              <span className="text-lg font-semibold">{formatCurrency(quoteData.taxAmount)}</span>
            </div>
            <Separator className="bg-white/20" />
            <div className="flex justify-between items-center text-white">
              <span className="text-2xl font-bold">Total Investment</span>
              <span className="text-3xl font-bold">{formatCurrency(quoteData.total)}</span>
            </div>
            <div className="text-center text-white/70 text-sm mt-4 p-3 rounded-lg" style={{backgroundColor: 'rgba(255,255,255,0.1)'}}>
              <Clock className="h-4 w-4 inline mr-2" />
              This quote is valid until {formatDate(quoteData.validUntil)}
            </div>
          </div>
        </div>

        {/* Payment Schedule */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6" style={{color: '#db973c'}} />
              <div>
                <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Payment Schedule</h3>
                <p style={{color: '#4a6670'}}>Flexible payment structure to fit your budget</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl border-2 border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
                <div className="text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg" style={{backgroundColor: '#3d4552'}}>1</div>
                <h4 className="font-bold mb-2" style={{color: '#1a1a1a'}}>Down Payment</h4>
                <div className="text-3xl font-bold mb-2" style={{color: '#db973c'}}>{quoteData.downPaymentPercentage}%</div>
                <div className="text-2xl font-semibold mb-2" style={{color: '#1a1a1a'}}>
                  {formatCurrency((parseFloat(quoteData.total) * quoteData.downPaymentPercentage / 100).toString())}
                </div>
                <p className="text-sm" style={{color: '#4a6670'}}>To secure your project start date</p>
              </div>
              
              <div className="text-center p-6 rounded-xl border-2 border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
                <div className="text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg" style={{backgroundColor: '#4a6670'}}>2</div>
                <h4 className="font-bold mb-2" style={{color: '#1a1a1a'}}>Progress Payment</h4>
                <div className="text-3xl font-bold mb-2" style={{color: '#db973c'}}>{quoteData.milestonePaymentPercentage}%</div>
                <div className="text-2xl font-semibold mb-2" style={{color: '#1a1a1a'}}>
                  {formatCurrency((parseFloat(quoteData.total) * quoteData.milestonePaymentPercentage / 100).toString())}
                </div>
                <p className="text-sm" style={{color: '#4a6670'}}>At project milestone completion</p>
              </div>
              
              <div className="text-center p-6 rounded-xl border-2 border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
                <div className="text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold text-lg" style={{backgroundColor: '#db973c'}}>3</div>
                <h4 className="font-bold mb-2" style={{color: '#1a1a1a'}}>Final Payment</h4>
                <div className="text-3xl font-bold mb-2" style={{color: '#db973c'}}>{quoteData.finalPaymentPercentage}%</div>
                <div className="text-2xl font-semibold mb-2" style={{color: '#1a1a1a'}}>
                  {formatCurrency((parseFloat(quoteData.total) * quoteData.finalPaymentPercentage / 100).toString())}
                </div>
                <p className="text-sm" style={{color: '#4a6670'}}>Upon project completion</p>
              </div>
            </div>
            
            {quoteData.milestoneDescription && (
              <div className="mt-6 p-4 rounded-xl border border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
                <h5 className="font-semibold mb-2" style={{color: '#1a1a1a'}}>Progress Milestone Details:</h5>
                <p style={{color: '#4a6670'}}>{quoteData.milestoneDescription}</p>
              </div>
            )}
            
            <div className="mt-6 p-4 rounded-xl border border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 mt-0.5" style={{color: '#db973c'}} />
                <div>
                  <h5 className="font-semibold mb-1" style={{color: '#1a1a1a'}}>Payment Options & Protection</h5>
                  <ul className="text-sm space-y-1" style={{color: '#4a6670'}}>
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
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6" style={{color: '#db973c'}} />
                <div>
                  <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Project Scope & Details</h3>
                  <p style={{color: '#4a6670'}}>Comprehensive overview of your project</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="prose prose-slate max-w-none">
                <p className="leading-relaxed" style={{color: '#4a6670'}}>{quoteData.scopeDescription}</p>
              </div>
            </div>
          </div>
        )}

        {/* Customer Information */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="text-xl font-bold text-slate-900">Your Project Contact</h3>
                <p className="text-slate-600">We'll keep you updated every step of the way</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-slate-500">Primary Contact</div>
                  <div className="text-lg font-semibold text-slate-900">{quoteData.customerName}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Email Address</div>
                  <div className="text-slate-900">{quoteData.customerEmail}</div>
                </div>
              </div>
              <div className="space-y-4">
                {quoteData.customerPhone && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Phone Number</div>
                    <div className="text-slate-900">{quoteData.customerPhone}</div>
                  </div>
                )}
                {quoteData.customerAddress && (
                  <div>
                    <div className="text-sm font-medium text-slate-500">Project Address</div>
                    <div className="text-slate-900">{quoteData.customerAddress}</div>
                  </div>
                )}
              </div>
            </div>
            {quoteData.projectNotes && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h5 className="font-semibold text-slate-900 mb-2">Special Project Notes:</h5>
                <p className="text-slate-700">{quoteData.projectNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Questions & Support */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-lg text-white p-8">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-2xl font-bold mb-2">Questions About Your Project?</h3>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
              Our experienced team is here to help. We're committed to making your project vision a reality 
              with transparent communication and expert craftsmanship.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
              <a href="tel:+12064105100" className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl p-4 transition-colors">
                <Phone className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Call Us</div>
                  <div className="text-sm text-emerald-100">(206) 410-5100</div>
                </div>
              </a>
              <a href="mailto:projects@kolmo.io" className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 rounded-xl p-4 transition-colors">
                <Mail className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Email Us</div>
                  <div className="text-sm text-blue-100">projects@kolmo.io</div>
                </div>
              </a>
            </div>
            
            <p className="text-slate-400 text-sm mt-6">
              Serving Seattle, WA & Surrounding Areas • Free Consultations Available
            </p>
          </div>
        </div>
      </div>

      {/* Professional Footer */}
      <div className="text-white mt-12" style={{backgroundColor: '#3d4552'}}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="rounded-lg p-3" style={{backgroundColor: '#4a6670'}}>
                <img src="@assets/kolmo-logo (1).png" alt="Kolmo Constructions" className="h-12 w-12" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold">Kolmo Constructions</h3>
                <p style={{color: 'rgba(255,255,255,0.7)'}}>Building Excellence Since 2010</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="flex items-center justify-center gap-3" style={{color: 'rgba(255,255,255,0.7)'}}>
                <Shield className="h-6 w-6" style={{color: '#db973c'}} />
                <div>
                  <div className="font-semibold text-white">Licensed & Insured</div>
                  <div className="text-sm">WA State Contractor License</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3" style={{color: 'rgba(255,255,255,0.7)'}}>
                <Award className="h-6 w-6" style={{color: '#db973c'}} />
                <div>
                  <div className="font-semibold text-white">EPA Certified</div>
                  <div className="text-sm">Lead-Safe Work Practices</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3" style={{color: 'rgba(255,255,255,0.7)'}}>
                <Star className="h-6 w-6" style={{color: '#db973c'}} />
                <div>
                  <div className="font-semibold text-white">Trusted Locally</div>
                  <div className="text-sm">Pacific Northwest Experts</div>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-6" style={{borderColor: '#4a6670'}}>
              <p className="text-sm" style={{color: 'rgba(255,255,255,0.6)'}}>
                © 2024 Kolmo Constructions. All rights reserved. | 
                Professional home improvement services with over a decade of experience in the Pacific Northwest.
              </p>
            </div>
          </div>
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