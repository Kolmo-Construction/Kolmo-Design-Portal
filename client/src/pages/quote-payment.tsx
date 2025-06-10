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
}

interface PaymentData {
  clientSecret: string;
  amount: number;
  downPaymentPercentage: number;
  quote: Quote;
}

export default function QuotePaymentPage() {
  const [, params] = useRoute('/quote-payment/:id');
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

  const quoteId = params?.id;

  useEffect(() => {
    if (quoteId) {
      loadQuote();
    }
  }, [quoteId]);

  const loadQuote = async () => {
    try {
      setIsLoadingQuote(true);
      const response = await apiRequest('GET', `/api/quotes/${quoteId}`);
      const quoteData = await response.json();
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
      const response = await apiRequest('POST', `/api/quotes/${quoteId}/accept-payment`, {
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
      });
      
      const paymentData = await response.json();
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription>
              Your project has been created and is ready to begin.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="font-medium">Quote #{quote.quoteNumber}</p>
              <p className="text-sm text-gray-600">{quote.title}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">What happens next:</p>
              <ul className="text-sm space-y-1 text-left">
                <li>• You'll receive a confirmation email shortly</li>
                <li>• Our team will contact you within 2 business days</li>
                <li>• Project planning and scheduling will begin</li>
                <li>• You'll receive regular progress updates</li>
              </ul>
            </div>
            <Button onClick={() => setLocation('/')} className="w-full">
              Return to Home
            </Button>
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