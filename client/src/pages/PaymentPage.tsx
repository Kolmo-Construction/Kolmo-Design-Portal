import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PaymentForm } from '@/components/payment/PaymentForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// Load Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentInfo {
  amount: number;
  description: string;
  customerName?: string;
  projectName?: string;
  invoiceNumber?: string;
}

export default function PaymentPage() {
  const [, params] = useRoute('/payment/:clientSecret');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const clientSecret = params?.clientSecret;

  useEffect(() => {
    if (clientSecret) {
      loadPaymentInfo();
    } else {
      setError('Invalid payment link');
      setIsLoading(false);
    }
  }, [clientSecret]);

  const loadPaymentInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Extract payment intent ID from client secret for direct database lookup
      const paymentIntentId = clientSecret?.split('_secret_')[0];
      
      if (!paymentIntentId) {
        throw new Error('Invalid payment link format');
      }

      // Try to get payment information from API
      try {
        const response = await apiRequest('GET', `/api/payment/info/${clientSecret}`);
        // Check if response is actually JSON
        if (response && typeof response === 'object' && response.amount) {
          setPaymentInfo(response as unknown as PaymentInfo);
          return;
        }
      } catch (apiError) {
        console.warn('API request failed, falling back to direct data fetch:', apiError);
      }

      // Fallback: Get invoice data directly using the payment intent ID
      // This works around the Vite routing issue in development
      const invoicesResponse = await apiRequest('GET', '/api/invoices');
      const invoices = invoicesResponse as any[];
      
      const matchingInvoice = invoices.find(inv => 
        inv.stripePaymentIntentId === paymentIntentId
      );

      if (!matchingInvoice) {
        throw new Error('Payment information not found');
      }

      // Get project information if available
      let projectName = 'Your Project';
      if (matchingInvoice.projectId) {
        try {
          const projectResponse = await apiRequest('GET', `/api/projects/${matchingInvoice.projectId}`);
          if (projectResponse && (projectResponse as any).name) {
            projectName = (projectResponse as any).name;
          }
        } catch (projectError) {
          console.warn('Could not fetch project details:', projectError);
        }
      }

      const fallbackPaymentInfo: PaymentInfo = {
        amount: parseFloat(matchingInvoice.amount) || 0,
        description: matchingInvoice.description || 'Payment',
        customerName: matchingInvoice.customerName || undefined,
        projectName: projectName,
        invoiceNumber: matchingInvoice.invoiceNumber,
      };

      setPaymentInfo(fallbackPaymentInfo);
    } catch (error: any) {
      console.error('Error loading payment info:', error);
      setError(error.message || 'Failed to load payment information');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (result: any) => {
    try {
      // Notify backend of successful payment
      await apiRequest('POST', '/api/payment-success', {
        paymentIntentId: result.id,
      });

      setPaymentCompleted(true);
      
      toast({
        title: "Payment Successful!",
        description: "Your payment has been processed successfully.",
      });
    } catch (error: any) {
      console.error('Error processing payment success:', error);
      toast({
        title: "Payment Processing Error",
        description: "Payment was successful but there was an issue updating your account. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading payment information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-red-600">Payment Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Please check your payment link or contact support if the problem persists.
            </p>
          </CardContent>
        </Card>
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
              Your payment has been processed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {paymentInfo && (
              <div className="bg-green-50 p-4 rounded-lg">
                {paymentInfo.invoiceNumber && (
                  <p className="font-medium">Invoice #{paymentInfo.invoiceNumber}</p>
                )}
                {paymentInfo.projectName && (
                  <p className="text-sm text-gray-600">{paymentInfo.projectName}</p>
                )}
                <p className="text-lg font-semibold text-green-600">
                  ${paymentInfo.amount.toFixed(2)} paid
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600 mb-2">What happens next:</p>
              <ul className="text-sm space-y-1 text-left">
                <li>• You'll receive a confirmation email shortly</li>
                <li>• Our team will be notified of your payment</li>
                <li>• Project work will continue as scheduled</li>
                <li>• You'll receive regular progress updates</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentInfo || !clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-red-600">Invalid Payment Link</CardTitle>
            <CardDescription>
              This payment link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Payment
            </h1>
            <p className="text-gray-600">
              Secure payment processing powered by Stripe
            </p>
          </div>

          {/* Payment Details Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentInfo.projectName && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Project:</span>
                  <span className="font-medium">{paymentInfo.projectName}</span>
                </div>
              )}
              {paymentInfo.invoiceNumber && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Invoice:</span>
                  <span className="font-medium">#{paymentInfo.invoiceNumber}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Description:</span>
                <span className="font-medium">{paymentInfo.description}</span>
              </div>
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total Amount:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${paymentInfo.amount?.toFixed?.(2) || '0.00'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Payment Form */}
          <Elements 
            stripe={stripePromise} 
            options={{ 
              clientSecret: clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#10b981', // Green theme to match the design
                },
              },
            }}
          >
            <PaymentForm
              clientSecret={clientSecret}
              amount={paymentInfo.amount}
              description={paymentInfo.description}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
}