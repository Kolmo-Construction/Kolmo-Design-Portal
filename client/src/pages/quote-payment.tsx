import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PaymentForm } from '@/components/payment/PaymentForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle, FileText, DollarSign } from 'lucide-react';

// Kolmo Brand Colors
const colors = {
  primary: '#3d4f52',    // Dark Slate
  accent: '#d8973c',     // Gold
  secondary: '#4a6670',  // Subtext
  muted: '#f5f5f5',      // Backgrounds
  base: '#ffffff',       // Paper Background
};

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface Quote {
  id: number;
  title: string;
  quoteNumber: string;
  description: string;
  total: number;
  downPaymentPercentage: number;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

interface PaymentData {
  clientSecret: string;
  amount: number;
  downPaymentPercentage: number;
  quote: Quote;
}

export default function QuotePaymentPage() {
  const [, params] = useRoute('/quote-payment/:token');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [quote, setQuote] = useState<Quote | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const quoteToken = params?.token;

  useEffect(() => {
    if (quoteToken) {
      loadQuote();
    }
  }, [quoteToken]);

  const loadQuote = async () => {
    try {
      setIsLoadingQuote(true);
      // Use public quote access since this is a customer-facing page
      const res = await fetch(`/api/quotes/public/${quoteToken}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Quote not found or expired');
        }
        throw new Error(`Failed to load quote: ${res.statusText}`);
      }
      
      const quoteData = await res.json();
      setQuote(quoteData);
      
      // Pre-fill customer information from quote
      if (quoteData.customerName) {
        setCustomerInfo(prev => ({
          ...prev,
          name: quoteData.customerName,
          email: quoteData.customerEmail || '',
          phone: quoteData.customerPhone || '',
        }));
      }
      
      if (quoteData.status === 'accepted') {
        toast({
          title: "Quote Already Accepted",
          description: "This quote has already been accepted and processed.",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }
    } catch (error) {
      console.error('Error loading quote:', error);
      toast({
        title: "Error",
        description: "Failed to load quote details. Please try again.",
        variant: "destructive",
      });
      setLocation('/');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleCustomerInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerInfo.name || !customerInfo.email) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingPayment(true);
      const paymentData = await apiRequest('POST', `/api/quotes/${quote?.id}/accept-payment`, {
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
      });
      
      setPaymentData(paymentData);
      setShowPaymentForm(true);
    } catch (error) {
      console.error('Error creating payment:', error);
      toast({
        title: "Error",
        description: "Failed to create payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = (result: any) => {
    setPaymentCompleted(true);
    toast({
      title: "Payment Successful!",
      description: "Your project has been created and you will receive a confirmation email shortly.",
    });
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (isLoadingQuote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium">Quote not found</p>
          <Button onClick={() => setLocation('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (paymentCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-lg mx-auto shadow-lg border-t-4" style={{ borderTopColor: colors.accent }}>
          {/* Success Header */}
          <CardHeader className="text-center pb-4">
            <CheckCircle className="h-20 w-20 mx-auto mb-4" style={{ color: colors.accent }} />
            <CardTitle className="text-3xl font-bold mb-2" style={{ color: colors.primary }}>
              Payment Confirmed
            </CardTitle>
            <CardDescription className="text-base" style={{ color: colors.secondary }}>
              Your project is ready to begin
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Project Details */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: colors.muted }}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: colors.secondary }}>
                    Quote Number
                  </p>
                  <p className="font-mono font-semibold" style={{ color: colors.primary }}>
                    #{quote.quoteNumber}
                  </p>
                </div>
              </div>
              <p className="font-semibold mt-2" style={{ color: colors.primary }}>
                {quote.title}
              </p>
            </div>

            {/* Next Steps */}
            <div>
              <h3 className="font-semibold mb-3" style={{ color: colors.primary }}>
                Next Steps
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: colors.accent }} />
                  <p className="text-sm" style={{ color: colors.secondary }}>
                    Confirmation email sent to your inbox
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: colors.accent }} />
                  <p className="text-sm" style={{ color: colors.secondary }}>
                    Project manager will contact you within 2 business days
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: colors.accent }} />
                  <p className="text-sm" style={{ color: colors.secondary }}>
                    Scheduling and planning phase begins
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => window.close()}
              className="w-full"
              style={{ backgroundColor: colors.primary }}
            >
              Close
            </Button>

            {/* Footer */}
            <div className="text-center pt-2 border-t" style={{ borderColor: colors.muted }}>
              <p className="text-xs" style={{ color: colors.secondary }}>
                Questions? Contact us at <span className="font-semibold">projects@kolmo.io</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Accept Quote & Make Payment</h1>
          <p className="text-gray-600 mt-2">
            Complete your information and payment to get started on your project
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quote Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quote Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold text-lg">{quote.title}</p>
                <p className="text-sm text-gray-600">Quote #{quote.quoteNumber}</p>
              </div>
              
              {quote.description && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Description:</p>
                  <p className="text-sm">{quote.description}</p>
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Project Cost:</span>
                  <span className="font-semibold">{formatCurrency(quote.total)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Down Payment ({quote.downPaymentPercentage}%):</span>
                  <span className="font-semibold">
                    {formatCurrency((quote.total * quote.downPaymentPercentage) / 100)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Remaining Balance:</span>
                  <span>
                    {formatCurrency(quote.total - (quote.total * quote.downPaymentPercentage) / 100)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info & Payment */}
          <div className="space-y-6">
            {!showPaymentForm ? (
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                  <CardDescription>
                    {quote?.customerName 
                      ? "Please confirm your information and proceed to payment"
                      : "Please provide your contact information to proceed with payment"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCustomerInfoSubmit} className="space-y-4">
                    {quote?.customerName ? (
                      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Customer Name</Label>
                          <div className="font-semibold text-gray-900">{quote.customerName}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                          <div className="font-semibold text-gray-900">{quote.customerEmail || customerInfo.email}</div>
                        </div>
                        {(quote.customerPhone || customerInfo.phone) && (
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                            <div className="font-semibold text-gray-900">{quote.customerPhone || customerInfo.phone}</div>
                          </div>
                        )}
                        {!quote.customerPhone && (
                          <div>
                            <Label htmlFor="phone">Phone Number (Optional)</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={customerInfo.phone}
                              onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="Add your phone number"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="name">Full Name *</Label>
                          <Input
                            id="name"
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="email">Email Address *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={customerInfo.email}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isCreatingPayment}
                    >
                      {isCreatingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Setting up payment...
                        </>
                      ) : (
                        <>
                          <DollarSign className="mr-2 h-4 w-4" />
                          Proceed to Payment
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              paymentData && (
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret: paymentData.clientSecret,
                    appearance: {
                      theme: 'stripe',
                    },
                  }}
                >
                  <PaymentForm
                    clientSecret={paymentData.clientSecret}
                    amount={paymentData.amount}
                    description={`Down payment for ${quote.title}`}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </Elements>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}