import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PaymentForm } from '@/components/payment/PaymentForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, AlertCircle, CheckCircle, Shield, Lock } from 'lucide-react';

// Kolmo Brand Colors
const colors = {
  primary: '#3d4f52',    // Dark Slate - Text/Headers
  accent: '#d8973c',     // Gold - Highlights/Total
  secondary: '#4a6670',  // Subtext
  muted: '#f5f5f5',      // Backgrounds
  base: '#ffffff',       // Paper Background
};

// Load Stripe - initialize once and reuse
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
if (!stripePublicKey) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(stripePublicKey);

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

      if (!clientSecret) {
        throw new Error('No payment information provided');
      }

      // Try to get payment information from API first
      try {
        const response = await fetch(`/api/payment/info/${clientSecret}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === 'object' && 'amount' in data) {
            setPaymentInfo(data as PaymentInfo);
            return;
          }
        }
      } catch (apiError) {
        console.warn('API request failed:', apiError);
        
        // For production, if API fails, show error instead of fallback data
        throw new Error('Unable to load payment information. Please contact support.');
      }

      // This should not be reached if API is working correctly
      throw new Error('Payment information could not be loaded');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: colors.accent }} />
            <p style={{ color: colors.secondary }}>Loading payment information...</p>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md mx-auto shadow-lg border-t-4" style={{ borderTopColor: colors.accent }}>
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: colors.accent }} />
            <CardTitle className="text-2xl" style={{ color: colors.primary }}>
              Payment Successful!
            </CardTitle>
            <CardDescription style={{ color: colors.secondary }}>
              Your payment has been processed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {paymentInfo && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.muted }}>
                {paymentInfo.invoiceNumber && (
                  <p className="font-medium" style={{ color: colors.primary }}>
                    Invoice #{paymentInfo.invoiceNumber}
                  </p>
                )}
                {paymentInfo.projectName && (
                  <p className="text-sm" style={{ color: colors.secondary }}>
                    {paymentInfo.projectName}
                  </p>
                )}
                <p className="text-lg font-semibold mt-2" style={{ color: colors.accent }}>
                  ${paymentInfo.amount.toFixed(2)} paid
                </p>
              </div>
            )}
            <div>
              <p className="text-sm mb-2" style={{ color: colors.secondary }}>
                What happens next:
              </p>
              <ul className="text-sm space-y-1 text-left" style={{ color: colors.secondary }}>
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
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header with Gold Border */}
          <div className="text-center mb-8">
            {/* Logo */}
            <div
              className="w-16 h-16 flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4"
              style={{ backgroundColor: colors.primary }}
            >
              K
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: colors.primary }}>
              Complete Your Payment
            </h1>
            <div className="flex items-center justify-center gap-2" style={{ color: colors.secondary }}>
              <Shield className="w-4 h-4" />
              <p className="text-sm">
                Secure payment processing powered by Stripe
              </p>
            </div>
          </div>

          {/* Payment Details Card */}
          <Card className="mb-6 shadow-lg border-t-4" style={{ borderTopColor: colors.accent }}>
            <CardHeader>
              <CardTitle style={{ color: colors.primary }}>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentInfo.projectName && (
                <div className="flex justify-between items-center py-2">
                  <span style={{ color: colors.secondary }}>Project:</span>
                  <span className="font-medium" style={{ color: colors.primary }}>
                    {paymentInfo.projectName}
                  </span>
                </div>
              )}
              {paymentInfo.invoiceNumber && (
                <div className="flex justify-between items-center py-2">
                  <span style={{ color: colors.secondary }}>Invoice:</span>
                  <span className="font-medium font-mono" style={{ color: colors.primary }}>
                    #{paymentInfo.invoiceNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span style={{ color: colors.secondary }}>Description:</span>
                <span className="font-medium" style={{ color: colors.primary }}>
                  {paymentInfo.description}
                </span>
              </div>
              <div className="border-t-2 pt-4 mt-4" style={{ borderColor: colors.accent }}>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold" style={{ color: colors.primary }}>
                    Total Amount:
                  </span>
                  <span className="text-2xl font-bold font-mono" style={{ color: colors.accent }}>
                    ${paymentInfo.amount?.toFixed?.(2) || '0.00'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Payment Form */}
          {clientSecret && (
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{
                clientSecret: clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: colors.accent, // Kolmo Gold
                    colorBackground: colors.base,
                    colorText: colors.primary,
                    colorDanger: '#dc2626',
                    fontFamily: 'system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '8px',
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
          )}

          {/* Trust Badges */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-4 text-sm" style={{ color: colors.secondary }}>
              <div className="flex items-center gap-1">
                <Lock className="w-4 h-4" />
                <span>SSL Encrypted</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span>PCI Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}