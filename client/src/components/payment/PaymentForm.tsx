import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CreditCard } from 'lucide-react';

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  description: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function PaymentForm({ 
  clientSecret, 
  amount, 
  description, 
  onSuccess, 
  onError 
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        const errorMessage = error.message || 'Payment failed';
        toast({
          title: "Payment Failed",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Call our backend to handle the successful payment
        try {
          const result = await apiRequest('POST', '/api/payment-success', {
            paymentIntentId: paymentIntent.id,
          });

          toast({
            title: "Payment Successful",
            description: "Your payment has been processed successfully!",
          });
          
          onSuccess?.(result);
        } catch (backendError) {
          console.error('Backend processing error:', backendError);
          toast({
            title: "Payment Processed",
            description: "Payment succeeded but there was an issue updating records. Please contact support.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <span className="font-medium">Total Amount:</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(amount)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="min-h-[200px]">
            <PaymentElement 
              options={{
                layout: 'tabs',
              }}
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={!stripe || !elements || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                Pay {formatCurrency(amount)}
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Your payment is secured by Stripe
          </p>
        </div>
      </CardContent>
    </Card>
  );
}