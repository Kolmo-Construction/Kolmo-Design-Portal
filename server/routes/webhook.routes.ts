import { Router } from 'express';
import Stripe from 'stripe';
import { paymentService } from '../services/payment.service';

const router = Router();

// Initialize Stripe with webhook endpoint secret
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
}) : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook endpoint for handling payment events
 * This endpoint processes payment_intent.succeeded events to send confirmation emails
 */
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!stripe || !endpointSecret) {
    console.error('Stripe not configured - webhook cannot process events');
    return res.status(503).json({ error: 'Payment processing unavailable' });
  }

  if (!sig) {
    console.error('Missing Stripe signature in webhook request');
    return res.status(400).json({ error: 'Missing stripe signature' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature and construct event
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  console.log(`Received Stripe webhook event: ${event.type}`);

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Processing payment_intent.succeeded for: ${paymentIntent.id}`);
        
        // Use the payment service to handle the successful payment
        await paymentService.handlePaymentSuccess(paymentIntent.id);
        
        console.log(`Successfully processed payment: ${paymentIntent.id}`);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment failed for: ${failedPayment.id}`);
        
        // TODO: Implement failed payment handling if needed
        // This could include sending failure notifications or updating invoice status
        break;

      case 'customer.created':
        const customer = event.data.object as Stripe.Customer;
        console.log(`New customer created: ${customer.id}`);
        
        // TODO: Implement customer creation handling if needed
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment succeeded: ${invoice.id}`);
        
        // TODO: Implement invoice payment handling if needed for subscription billing
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export const webhookRoutes = router;