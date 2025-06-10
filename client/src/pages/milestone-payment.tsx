import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { PaymentForm } from '@/components/payment/PaymentForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle, AlertCircle, Building2, Calendar, DollarSign } from 'lucide-react';

// Load Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentDetails {
  amount: number;
  description: string;
  projectName: string;
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  dueDate: string;
  paymentType: 'milestone' | 'final';
  isValid: boolean;
}

export default function MilestonePaymentPage() {
  const [, params] = useRoute('/payment/:clientSecret*');
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract full client secret from URL path
  const clientSecret = location.replace('/payment/', '');

  useEffect(() => {
    if (clientSecret) {
      loadPaymentDetails();
    }
  }, [clientSecret]);

  const loadPaymentDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', `/api/payment/details/${clientSecret}`);
      const data = await response.json();
      
      if (!data.isValid) {
        setError('This payment link is invalid or has expired.');
        return;
      }
      
      setPaymentDetails(data);
    } catch (error) {
      console.error('Error loading payment details:', error);
      setError('Failed to load payment details. Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentCompleted(true);
    toast({
      title: "Payment Successful!",
      description: "Your payment has been processed and you will receive a confirmation email shortly.",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <p className="text-lg font-medium">Loading payment details...</p>
            <p className="text-sm text-gray-600 mt-2">Please wait while we verify your payment link</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-red-600">Payment Link Error</CardTitle>
            <CardDescription className="text-gray-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              If you believe this is an error, please contact our support team.
            </p>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline" 
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment completed state
  if (paymentCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription>
              Your {paymentDetails?.paymentType === 'milestone' ? 'milestone' : 'final'} payment has been processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="font-medium">Invoice #{paymentDetails?.invoiceNumber}</p>
              <p className="text-sm text-gray-600">{paymentDetails?.projectName}</p>
              <p className="text-lg font-semibold text-green-600 mt-2">
                {paymentDetails && formatCurrency(paymentDetails.amount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">What happens next:</p>
              <ul className="text-sm space-y-1 text-left">
                <li>• You'll receive a payment confirmation email shortly</li>
                <li>• Our team will be notified of your payment</li>
                {paymentDetails?.paymentType === 'milestone' ? (
                  <>
                    <li>• Work will continue on your project</li>
                    <li>• You'll receive updates on project progress</li>
                  </>
                ) : (
                  <>
                    <li>• Your project is now complete</li>
                    <li>• Final project handover will be scheduled</li>
                  </>
                )}
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

  // Payment form state
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Building2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Kolmo Construction</h1>
            </div>
            <h2 className="text-xl text-gray-600">
              {paymentDetails?.paymentType === 'milestone' ? 'Milestone Payment' : 'Final Payment'}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                  <span className="font-medium">Amount Due:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {paymentDetails && formatCurrency(paymentDetails.amount)}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Project:</span>
                    <span className="font-medium">{paymentDetails?.projectName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice:</span>
                    <span className="font-medium">#{paymentDetails?.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="font-medium">
                      {paymentDetails && formatDate(paymentDetails.dueDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Type:</span>
                    <Badge variant={paymentDetails?.paymentType === 'final' ? 'default' : 'secondary'}>
                      {paymentDetails?.paymentType === 'milestone' ? 'Milestone Payment' : 'Final Payment'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Customer Information</h4>
                  <div className="text-sm text-gray-600">
                    <p>{paymentDetails?.customerName}</p>
                    <p>{paymentDetails?.customerEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Form */}
            {paymentDetails && clientSecret && (
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret: clientSecret,
                  appearance: {
                    theme: 'stripe',
                  },
                }}
              >
                <PaymentForm
                  clientSecret={clientSecret}
                  amount={paymentDetails.amount}
                  description={`${paymentDetails.paymentType === 'milestone' ? 'Milestone' : 'Final'} payment for ${paymentDetails.projectName}`}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}