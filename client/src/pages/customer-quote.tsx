import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, X, MessageSquare, Calendar, MapPin, Clock, Phone, Mail, Shield, Award, Star, FileText, DollarSign, Calculator, Wrench, Home, Hammer, Zap, Paintbrush, Users, Package, Truck, HardHat, Eye, EyeOff, CreditCard, Camera, Image as ImageIcon } from "lucide-react";
import QuoteAnalytics from "@/lib/quote-analytics";
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
import kolmoLogo from "@assets/kolmo-logo (1).png";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle
} from 'react-compare-slider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QuoteChatWidget } from "@/components/chat/QuoteChatWidget";
import { ChatProvider } from "@/contexts/ChatContext";

interface QuoteMedia {
  id: number;
  quoteId: number;
  mediaUrl: string;
  mediaType: string;
  caption: string;
  category: string;
  sortOrder: number;
  uploadedById: number;
  createdAt: string;
}

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
  discountPercentage?: string;
  discountAmount?: string;
  discountedSubtotal?: string;
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
    discountPercentage?: string;
    discountAmount?: string;
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

// Function to get appropriate icon for line item category
const getCategoryIcon = (category: string) => {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('labor') || categoryLower.includes('labour')) {
    return Users;
  } else if (categoryLower.includes('material') || categoryLower.includes('supply')) {
    return Package;
  } else if (categoryLower.includes('electrical') || categoryLower.includes('electric')) {
    return Zap;
  } else if (categoryLower.includes('plumbing') || categoryLower.includes('water')) {
    return Wrench;
  } else if (categoryLower.includes('paint') || categoryLower.includes('finish')) {
    return Paintbrush;
  } else if (categoryLower.includes('demolition') || categoryLower.includes('demo')) {
    return Hammer;
  } else if (categoryLower.includes('equipment') || categoryLower.includes('rental')) {
    return HardHat;
  } else if (categoryLower.includes('delivery') || categoryLower.includes('transport')) {
    return Truck;
  } else if (categoryLower.includes('permit') || categoryLower.includes('admin')) {
    return FileText;
  } else {
    return Hammer; // Default construction icon
  }
};

export default function CustomerQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [showResponse, setShowResponse] = useState(false);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [showAcceptSummary, setShowAcceptSummary] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [showBeforeAfter, setShowBeforeAfter] = useState(true);
  const { toast } = useToast();
  const analyticsRef = useRef<QuoteAnalytics | null>(null);

  const { data: quote, isLoading, error } = useQuery({
    queryKey: [`/api/quotes/public/${token}`],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      // Custom query function for public quote access - no credentials needed
      const res = await fetch(`/api/quotes/public/${token}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Quote not found or expired');
        }
        throw new Error(`Failed to load quote: ${res.statusText}`);
      }
      
      return await res.json();
    },
  });

  // Fetch quote media/photos for display to customer
  const { data: quotePhotos = [] } = useQuery<QuoteMedia[]>({
    queryKey: [`/api/quotes/${quote?.id}/media`],
    enabled: !!quote?.id,
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${quote.id}/media`);
      if (!res.ok) {
        return []; // Return empty array if photos can't be loaded
      }
      return await res.json();
    },
  });

  // Initialize analytics when quote data is loaded - ONLY for customer quote pages
  useEffect(() => {
    const quoteData = quote as QuoteResponse;
    // Only track analytics for actual customer quote views (not admin dashboard)
    const isCustomerView = window.location.pathname.includes('/customer/quote/');
    
    if (quoteData?.id && !analyticsRef.current && isCustomerView) {
      analyticsRef.current = new QuoteAnalytics(quoteData.id);
    }
    
    return () => {
      if (analyticsRef.current) {
        analyticsRef.current.destroy();
        analyticsRef.current = null;
      }
    };
  }, [quote]);

  // Track customer info when entered
  useEffect(() => {
    if (analyticsRef.current && (customerName || customerEmail)) {
      analyticsRef.current.trackCustomerInfo(customerEmail, customerName);
    }
  }, [customerName, customerEmail]);

  const respondMutation = useMutation({
    mutationFn: async (data: { action: string; customerName: string; customerEmail: string; message: string }) => {
      // Track form submission
      if (analyticsRef.current) {
        analyticsRef.current.trackFormSubmission('quote_response', { action: data.action });
      }
      
      // Custom fetch for public route - no credentials needed
      const res = await fetch(`/api/quotes/public/${token}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to submit response: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: (data, variables) => {
      if (variables.action === 'declined') {
        toast({
          title: "Thank You for Your Feedback",
          description: "We appreciate you taking the time to let us know. We'll be in touch if we can help in the future.",
        });
      } else {
        toast({
          title: "Response Sent",
          description: "Your response has been sent successfully",
        });
      }
      
      // Close all modals
      setShowResponse(false);
      setShowDeclineConfirm(false);
      setShowDeclineReason(false);
      setMessage("");
      
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

  const handleAccept = () => {
    const quoteData = quote as QuoteResponse;
    
    // Use existing customer information from the quote
    const finalCustomerName = customerName || quoteData?.customerName || '';
    const finalCustomerEmail = customerEmail || quoteData?.customerEmail || '';

    if (!finalCustomerName || !finalCustomerEmail) {
      toast({
        title: "Missing Information",
        description: "Customer information is required",
        variant: "destructive",
      });
      return;
    }

    // Show accept summary modal instead of redirecting immediately
    setShowAcceptSummary(true);
    setShowResponse(false);
  };

  const handleContinueToPayment = () => {
    // Use the token instead of ID for payment flow
    setLocation(`/quote-payment/${token}`);
  };

  const handleDecline = () => {
    const quoteData = quote as QuoteResponse;
    
    // Use existing customer information from the quote
    const finalCustomerName = customerName || quoteData?.customerName || '';
    const finalCustomerEmail = customerEmail || quoteData?.customerEmail || '';

    if (!finalCustomerName || !finalCustomerEmail) {
      toast({
        title: "Missing Information",
        description: "Customer information is required",
        variant: "destructive",
      });
      return;
    }

    // Show decline confirmation modal
    setShowDeclineConfirm(true);
    setShowResponse(false);
  };

  const handleDeclineWithFeedback = () => {
    const quoteData = quote as QuoteResponse;
    const finalCustomerName = customerName || quoteData?.customerName || '';
    const finalCustomerEmail = customerEmail || quoteData?.customerEmail || '';

    respondMutation.mutate({
      action: 'declined',
      customerName: finalCustomerName,
      customerEmail: finalCustomerEmail,
      message: message || 'No feedback provided',
    });
  };

  const handleDeclineWithoutFeedback = () => {
    const quoteData = quote as QuoteResponse;
    const finalCustomerName = customerName || quoteData?.customerName || '';
    const finalCustomerEmail = customerEmail || quoteData?.customerEmail || '';

    respondMutation.mutate({
      action: 'declined',
      customerName: finalCustomerName,
      customerEmail: finalCustomerEmail,
      message: 'No feedback provided',
    });
  };

  const handleResponse = (action: 'accepted' | 'declined') => {
    if (action === 'accepted') {
      handleAccept();
    } else if (action === 'declined') {
      handleDecline();
    }
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
  
  // Check for specific response types
  const acceptedResponse = quoteData?.responses?.find(r => r.action === 'accepted');
  const declinedResponse = quoteData?.responses?.find(r => r.action === 'declined');
  const hasAccepted = !!acceptedResponse;
  const hasDeclined = !!declinedResponse;

  return (
    <ChatProvider 
      isCustomer={true}
      quoteToken={token}
      customerName={quoteData?.customerName}
      customerEmail={quoteData?.customerEmail}
    >
      <div className="min-h-screen bg-white">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200" style={{color: '#1a1a1a'}}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gray-50 rounded-lg p-2">
                <img src={kolmoLogo} alt="Kolmo Construction" className="h-12 w-12 object-contain" />
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold" style={{color: '#1a1a1a'}}>Kolmo Construction</h1>
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
                    variant={isExpired ? "destructive" : hasAccepted ? "default" : hasDeclined ? "destructive" : hasResponded ? "secondary" : "default"}
                    className="px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: isExpired ? '#dc2626' : hasAccepted ? '#16a34a' : hasDeclined ? '#dc2626' : hasResponded ? '#6b7280' : '#db973c', 
                      color: 'white'
                    }}
                  >
                    {isExpired ? "Expired" : hasAccepted ? "Accepted" : hasDeclined ? "Declined" : hasResponded ? "Responded" : "Awaiting Response"}
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

        {/* Response Required Section - Only show if not accepted and not expired */}
        {!hasAccepted && !isExpired && (
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
                  onClick={handleAccept}
                  className="px-8 py-3 text-lg font-semibold text-white"
                  style={{backgroundColor: '#db973c'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c8863a'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#db973c'}
                  size="lg"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Accept Proposal
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDecline}
                  className="px-8 py-3 text-white border-white/30"
                  style={{backgroundColor: 'rgba(255,255,255,0.1)'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  size="lg"
                >
                  <X className="h-5 w-5 mr-2" />
                  Decline Proposal
                </Button>
              </div>
              <p className="text-white/70 text-sm mt-4">
                Valid until {formatDate(quoteData.validUntil)} • Free consultations available
              </p>
            </div>
          </div>
        )}

        {/* Quote Accepted Status */}
        {hasAccepted && (
          <div className="rounded-2xl shadow-lg text-white p-6" style={{backgroundColor: '#16a34a'}}>
            <div className="text-center">
              <Check className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Proposal Accepted!</h3>
              <p className="text-white/80 mb-4 max-w-2xl mx-auto">
                Thank you for accepting our proposal. We're excited to get started on your project!
              </p>
              <div className="bg-white/10 rounded-xl p-4 max-w-md mx-auto">
                <p className="text-sm text-white/90">
                  <strong>Accepted on:</strong> {formatDate(acceptedResponse?.createdAt || '')}
                </p>
                {acceptedResponse?.customerName && (
                  <p className="text-sm text-white/90 mt-1">
                    <strong>By:</strong> {acceptedResponse.customerName}
                  </p>
                )}
              </div>
              <p className="text-white/70 text-sm mt-4">
                Our team will be in touch shortly to schedule your project kickoff.
              </p>
            </div>
          </div>
        )}

        {/* Quote Declined Status */}
        {hasDeclined && (
          <div className="rounded-2xl shadow-lg text-white p-6" style={{backgroundColor: '#dc2626'}}>
            <div className="text-center">
              <X className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Proposal Declined</h3>
              <p className="text-white/80 mb-4 max-w-2xl mx-auto">
                We understand this proposal wasn't the right fit for you at this time.
              </p>
              <div className="bg-white/10 rounded-xl p-4 max-w-md mx-auto">
                <p className="text-sm text-white/90">
                  <strong>Declined on:</strong> {formatDate(declinedResponse?.createdAt || '')}
                </p>
                {declinedResponse?.message && (
                  <div className="mt-2">
                    <p className="text-sm text-white/90">
                      <strong>Reason:</strong>
                    </p>
                    <p className="text-sm text-white/80 mt-1">
                      "{declinedResponse.message}"
                    </p>
                  </div>
                )}
              </div>
              <p className="text-white/70 text-sm mt-4">
                Feel free to contact us if you'd like to discuss alternative options.
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
                <div className="prose prose-slate max-w-none leading-relaxed" style={{color: '#4a6670'}}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4" style={{color: '#1a1a1a'}} {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-semibold mb-3" style={{color: '#1a1a1a'}} {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-medium mb-2" style={{color: '#1a1a1a'}} {...props} />,
                      p: ({node, ...props}) => <p className="mb-3 leading-relaxed" style={{color: '#4a6670'}} {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-3 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-3 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li style={{color: '#4a6670'}} {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold" style={{color: '#1a1a1a'}} {...props} />,
                      hr: ({node, ...props}) => <hr className="my-6 border-gray-200" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 pl-4 italic" style={{borderColor: '#db973c', color: '#4a6670'}} {...props} />,
                    }}
                  >
                    {quoteData.description}
                  </ReactMarkdown>
                </div>
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
                            {(() => {
                              const IconComponent = getCategoryIcon(item.category);
                              return <IconComponent className="h-4 w-4" style={{color: '#db973c'}} />;
                            })()}
                          </div>
                          <div>
                            <h4 className="font-semibold" style={{color: '#1a1a1a'}}>{item.category}</h4>
                            <p className="text-sm" style={{color: '#4a6670'}}>{item.description}</p>
                          </div>
                        </div>
                        <div className="text-sm ml-11 space-y-1">
                          <div style={{color: '#4a6670'}}>
                            {parseFloat(item.quantity)} {item.unit} × {formatCurrency(item.unitPrice)} each
                          </div>
                          {/* Show line item discount if present */}
                          {(parseFloat(item.discountPercentage || '0') > 0 || parseFloat(item.discountAmount || '0') > 0) && (
                            <div className="text-sm" style={{color: '#db973c'}}>
                              Discount {parseFloat(item.discountPercentage || '0') > 0 && `(${parseFloat(item.discountPercentage || '0')}%)`}: 
                              -{formatCurrency((item.discountAmount || '0').toString())}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right sm:text-left">
                        <div className="text-xl font-bold" style={{color: '#1a1a1a'}}>{formatCurrency(item.totalPrice)}</div>
                        {/* Show original price if discounted */}
                        {(parseFloat(item.discountPercentage || '0') > 0 || parseFloat(item.discountAmount || '0') > 0) && (
                          <div className="text-sm line-through" style={{color: '#4a6670'}}>
                            {formatCurrency((parseFloat(item.quantity) * parseFloat(item.unitPrice)).toString())}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Before/After Images with Interactive Slider */}
        {(quoteData.beforeImageUrl || quoteData.afterImageUrl) && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="h-6 w-6" style={{color: '#db973c'}} />
                  <div>
                    <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Project Transformation</h3>
                    <p style={{color: '#4a6670'}}>Interactive before & after comparison</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {showBeforeAfter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showBeforeAfter ? "Hide" : "Show"} Images
                </Button>
              </div>
            </div>
            {showBeforeAfter && (
              <div className="p-6">
                {quoteData.beforeImageUrl && quoteData.afterImageUrl ? (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden shadow-lg">
                      <ReactCompareSlider
                        itemOne={
                          <ReactCompareSliderImage 
                            src={quoteData.beforeImageUrl} 
                            alt="Before" 
                            style={{ objectFit: 'contain', width: '100%', height: 'auto', maxHeight: '600px' }}
                          />
                        }
                        itemTwo={
                          <ReactCompareSliderImage 
                            src={quoteData.afterImageUrl} 
                            alt="After" 
                            style={{ objectFit: 'contain', width: '100%', height: 'auto', maxHeight: '600px' }}
                          />
                        }
                        position={50}
                        handle={
                          <ReactCompareSliderHandle
                            buttonStyle={{
                              backdropFilter: undefined,
                              background: '#db973c',
                              border: '2px solid white',
                              color: 'white',
                              borderRadius: '50%',
                              width: '44px',
                              height: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            }}
                            linesStyle={{
                              background: '#db973c',
                              boxShadow: '0 0 8px rgba(219, 151, 60, 0.3)'
                            }}
                          />
                        }
                        style={{
                          width: '100%',
                          height: 'auto',
                          minHeight: '300px',
                          maxHeight: '600px',
                          borderRadius: '12px',
                          overflow: 'hidden'
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 rounded-lg" style={{backgroundColor: '#f5f5f5'}}>
                        <p className="font-semibold mb-1" style={{color: '#1a1a1a'}}>Before</p>
                        <p className="text-sm" style={{color: '#4a6670'}}>
                          {quoteData.beforeImageCaption || "Current state"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg" style={{backgroundColor: '#f5f5f5'}}>
                        <p className="font-semibold mb-1" style={{color: '#1a1a1a'}}>After</p>
                        <p className="text-sm" style={{color: '#4a6670'}}>
                          {quoteData.afterImageCaption || "Transformed result"}
                        </p>
                      </div>
                    </div>
                    <div className="text-center p-4 rounded-xl" style={{backgroundColor: '#f5f5f5'}}>
                      <p className="text-sm" style={{color: '#4a6670'}}>
                        <strong>Interactive Comparison:</strong> Drag the slider to see the transformation. 
                        This represents the level of quality and craftsmanship you can expect for your project.
                      </p>
                    </div>
                  </div>
                ) : (
                  // Fallback for when only one image is available
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {quoteData.beforeImageUrl && (
                      <div className="text-center">
                        <img 
                          src={quoteData.beforeImageUrl} 
                          alt="Before" 
                          className="w-full max-h-96 object-contain rounded-lg mb-2"
                        />
                        <p className="text-sm" style={{color: '#4a6670'}}>
                          {quoteData.beforeImageCaption || "Before"}
                        </p>
                      </div>
                    )}
                    {quoteData.afterImageUrl && (
                      <div className="text-center">
                        <img 
                          src={quoteData.afterImageUrl} 
                          alt="After" 
                          className="w-full max-h-96 object-contain rounded-lg mb-2"
                        />
                        <p className="text-sm" style={{color: '#4a6670'}}>
                          {quoteData.afterImageCaption || "After"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Photo Gallery - Display uploaded images to customer */}
        {quotePhotos && quotePhotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
              <div className="flex items-center gap-3">
                <Camera className="h-6 w-6" style={{color: '#db973c'}} />
                <div>
                  <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Project Gallery</h3>
                  <p className="text-sm sm:text-base" style={{color: '#4a6670'}}>Additional photos and project details</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {quotePhotos
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((photo) => (
                    <div key={photo.id} className="group">
                      <div className="relative rounded-xl overflow-hidden shadow-lg mb-3 bg-gray-50">
                        <img 
                          src={photo.mediaUrl} 
                          alt={photo.caption || 'Project photo'} 
                          className="w-full h-48 sm:h-48 object-contain group-hover:scale-105 transition-transform duration-300"
                          style={{ minHeight: '192px' }}
                        />
                        {photo.category && photo.category !== 'gallery' && (
                          <div className="absolute top-2 right-2">
                            <Badge 
                              variant="secondary" 
                              className="bg-white/90 text-gray-700 text-xs font-medium"
                            >
                              {photo.category}
                            </Badge>
                          </div>
                        )}
                      </div>
                      {photo.caption && (
                        <div className="text-center px-2">
                          <p className="text-sm font-medium" style={{color: '#1a1a1a'}}>{photo.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              <div className="text-center mt-4 sm:mt-6 p-4 rounded-xl" style={{backgroundColor: '#f5f5f5'}}>
                <p className="text-sm" style={{color: '#4a6670'}}>
                  <ImageIcon className="h-4 w-4 inline mr-2" />
                  <strong>Project Gallery:</strong> These photos showcase our work quality, materials, and attention to detail. 
                  They represent the same level of craftsmanship you can expect for your project.
                </p>
              </div>
            </div>
          </div>
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
            
            {/* Show discount if present */}
            {(parseFloat(quoteData.discountPercentage || '0') > 0 || parseFloat(quoteData.discountAmount || '0') > 0) && (
              <div className="flex justify-between items-center" style={{color: '#db973c'}}>
                <span className="text-lg">
                  Discount {parseFloat(quoteData.discountPercentage || '0') > 0 && `(${parseFloat(quoteData.discountPercentage || '0')}%)`}
                </span>
                <span className="text-lg font-semibold">
                  -{formatCurrency(quoteData.discountAmount || '0')}
                </span>
              </div>
            )}
            
            {/* Show discounted subtotal if discount applied */}
            {(parseFloat(quoteData.discountPercentage || '0') > 0 || parseFloat(quoteData.discountAmount || '0') > 0) && (
              <div className="flex justify-between items-center text-white/80">
                <span className="text-lg">Discounted Subtotal</span>
                <span className="text-lg font-semibold">{formatCurrency(quoteData.discountedSubtotal || quoteData.subtotal)}</span>
              </div>
            )}
            
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
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6" style={{color: '#db973c'}} />
              <div>
                <h3 className="text-xl font-bold" style={{color: '#1a1a1a'}}>Your Project Contact</h3>
                <p style={{color: '#4a6670'}}>We'll keep you updated every step of the way</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium" style={{color: '#4a6670'}}>Primary Contact</div>
                  <div className="text-lg font-semibold" style={{color: '#1a1a1a'}}>{quoteData.customerName}</div>
                </div>
                <div>
                  <div className="text-sm font-medium" style={{color: '#4a6670'}}>Email Address</div>
                  <div style={{color: '#1a1a1a'}}>{quoteData.customerEmail}</div>
                </div>
              </div>
              <div className="space-y-4">
                {quoteData.customerPhone && (
                  <div>
                    <div className="text-sm font-medium" style={{color: '#4a6670'}}>Phone Number</div>
                    <div style={{color: '#1a1a1a'}}>{quoteData.customerPhone}</div>
                  </div>
                )}
                {quoteData.customerAddress && (
                  <div>
                    <div className="text-sm font-medium" style={{color: '#4a6670'}}>Project Address</div>
                    <div style={{color: '#1a1a1a'}}>{quoteData.customerAddress}</div>
                  </div>
                )}
              </div>
            </div>
            {quoteData.projectNotes && (
              <div className="mt-6 p-4 rounded-xl border border-gray-200" style={{backgroundColor: '#f5f5f5'}}>
                <h5 className="font-semibold mb-2" style={{color: '#1a1a1a'}}>Special Project Notes:</h5>
                <p style={{color: '#4a6670'}}>{quoteData.projectNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Questions & Support */}
        <div className="rounded-2xl shadow-lg text-white p-8" style={{backgroundColor: '#3d4552'}}>
          <div className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4" style={{color: '#db973c'}} />
            <h3 className="text-2xl font-bold mb-2">Questions About Your Project?</h3>
            <p className="text-white/80 mb-6 max-w-2xl mx-auto">
              Our experienced team is here to help. We're committed to making your project vision a reality 
              with transparent communication and expert craftsmanship.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
              <a href="tel:+12064105100" className="flex items-center justify-center gap-3 rounded-xl p-4 transition-colors text-white" style={{backgroundColor: '#db973c'}} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c8863a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#db973c'}>
                <Phone className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Call Us</div>
                  <div className="text-sm text-white/80">(206) 410-5100</div>
                </div>
              </a>
              <a href="mailto:projects@kolmo.io" className="flex items-center justify-center gap-3 rounded-xl p-4 transition-colors text-white" style={{backgroundColor: '#4a6670'}} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a757f'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#4a6670'}>
                <Mail className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Email Us</div>
                  <div className="text-sm text-white/80">projects@kolmo.io</div>
                </div>
              </a>
            </div>
            
            <p className="text-white/70 text-sm mt-6">
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
                <img src={kolmoLogo} alt="Kolmo Construction" className="h-12 w-12 object-contain" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold">Kolmo Construction</h3>
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
                © 2024 Kolmo. All rights reserved. | 
                Professional home improvement services with over a decade of experience in the Pacific Northwest.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-blue-600" />
                Help Us Improve
              </CardTitle>
              <CardDescription>
                We understand this proposal isn't the right fit. Would you mind sharing why? Your feedback helps us serve you better in the future.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Customer Info Summary */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">Declining Quote For:</div>
                  <div className="font-semibold">{quoteData?.customerName || customerName}</div>
                  <div className="text-sm text-gray-600">{quoteData?.customerEmail || customerEmail}</div>
                </div>

                {/* Optional Feedback */}
                <div>
                  <Label htmlFor="feedback" className="text-sm font-medium">
                    What made this proposal not quite right? <span className="text-gray-500">(Optional)</span>
                  </Label>
                  <Textarea
                    id="feedback"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g., Budget concerns, timeline doesn't work, different scope needed..."
                    className="min-h-[80px] mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This helps us create better proposals for you and future customers
                  </p>
                </div>

                {/* Relationship Preservation */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-1">We'd love to work with you in the future</div>
                  <div className="text-sm text-blue-700">
                    Feel free to reach out if your needs change or you'd like to discuss alternative options.
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="flex justify-between p-6 pt-0">
              <Button 
                variant="outline" 
                onClick={() => setShowDeclineConfirm(false)}
              >
                Back to Quote
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDeclineWithoutFeedback}
                  disabled={respondMutation.isPending}
                >
                  Skip Feedback
                </Button>
                <Button
                  onClick={handleDeclineWithFeedback}
                  disabled={respondMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {message.trim() ? 'Send Feedback' : 'Decline Quote'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Accept Summary Modal */}
      {showAcceptSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                Accept Quote & Continue to Payment
              </CardTitle>
              <CardDescription>
                Review your quote summary before proceeding to secure payment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Customer Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">Quote For:</div>
                  <div className="font-semibold">{quoteData?.customerName || customerName}</div>
                  <div className="text-sm text-gray-600">{quoteData?.customerEmail || customerEmail}</div>
                </div>

                {/* Quote Summary */}
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">Project Summary:</div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">{quoteData?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quote #{quoteData?.quoteNumber}</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Investment:</span>
                        <span className="text-green-600">{formatCurrency(quoteData?.total || '0')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">Payment Schedule:</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Down Payment ({quoteData?.downPaymentPercentage || 30}%):</span>
                      <span className="font-semibold">
                        {formatCurrency(((parseFloat(quoteData?.total || '0') * (quoteData?.downPaymentPercentage || 30)) / 100).toString())}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Progress Payment ({quoteData?.milestonePaymentPercentage || 40}%):</span>
                      <span>{formatCurrency(((parseFloat(quoteData?.total || '0') * (quoteData?.milestonePaymentPercentage || 40)) / 100).toString())}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Final Payment ({quoteData?.finalPaymentPercentage || 30}%):</span>
                      <span>{formatCurrency(((parseFloat(quoteData?.total || '0') * (quoteData?.finalPaymentPercentage || 30)) / 100).toString())}</span>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-1">Next Steps:</div>
                  <div className="text-sm text-blue-700">
                    You'll be taken to a secure payment page to process your down payment and finalize project details.
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="flex justify-between p-6 pt-0">
              <Button 
                variant="outline" 
                onClick={() => setShowAcceptSummary(false)}
              >
                Back to Quote
              </Button>
              <Button
                onClick={handleContinueToPayment}
                className="bg-green-600 hover:bg-green-700"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Continue to Payment
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Response Dialog */}
      {showResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>
                {showDeclineReason ? "Decline Proposal" : "Quote Response"}
              </CardTitle>
              <CardDescription>
                {showDeclineReason 
                  ? "Please let us know why you're declining this proposal"
                  : (quoteData?.customerName ? `Hello ${quoteData.customerName}` : 'Please respond to this quote')
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Show customer info summary if available and not in decline mode */}
                {!showDeclineReason && quoteData?.customerName && quoteData?.customerEmail && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Quote prepared for:</div>
                    <div className="font-semibold">{quoteData.customerName}</div>
                    <div className="text-sm text-gray-600">{quoteData.customerEmail}</div>
                  </div>
                )}

                {/* Only show customer info fields if they're missing AND not in decline mode */}
                {!showDeclineReason && (!quoteData?.customerName || !quoteData?.customerEmail) && (
                  <>
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
                  </>
                )}
                
                {/* Show decline reason field only when declining */}
                {showDeclineReason && (
                  <div>
                    <Label htmlFor="message">Reason for Declining (Required)</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please let us know why you're declining this proposal..."
                      required
                      className="min-h-[100px]"
                    />
                    {!message.trim() && (
                      <p className="text-red-600 text-sm mt-1">Please provide a reason for declining.</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            <div className="flex justify-between p-6 pt-0">
              <Button variant="outline" onClick={() => {
                setShowResponse(false);
                setShowDeclineReason(false);
                setMessage("");
              }}>
                Cancel
              </Button>
              <div className="flex gap-2">
                {!showDeclineReason ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowDeclineReason(true)}
                      disabled={respondMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Decline Proposal
                    </Button>
                    <Button
                      onClick={() => handleResponse('accepted')}
                      disabled={respondMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Accept Proposal
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeclineReason(false);
                        setMessage("");
                      }}
                      disabled={respondMutation.isPending}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => handleResponse('declined')}
                      disabled={respondMutation.isPending || !message.trim()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Confirm Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

        {/* Chat Widget - Always show for customer quote pages */}
        <QuoteChatWidget 
          quoteId={quoteData?.id?.toString() || ''}
          quoteNumber={quoteData?.quoteNumber || ''}
          isCustomer={true}
          customerName={quoteData?.customerName}
          customerEmail={quoteData?.customerEmail}
        />
      </div>
    </ChatProvider>
  );
}