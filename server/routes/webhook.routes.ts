import { Router } from 'express';
import { stripeService } from '../services/stripe.service';
import { paymentService } from '../services/payment.service';

const router = Router();

/**
 * Stripe webhook endpoint
 * Handles payment events from Stripe
 * Note: This endpoint needs raw body for signature verification
 */
router.post('/stripe', async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Construct and verify the webhook event
    const event = await stripeService.constructEvent(req.body, signature);

    console.log(`[Webhook] Received event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any; // Stripe.Checkout.Session
        // Pass the entire session object to the success handler
        await paymentService.handlePaymentSuccess(session);
        console.log(`[Webhook] Successfully processed Checkout Session: ${session.id}`);
        break;
      }

      case 'payment_intent.succeeded':
        await paymentService.handlePaymentSuccess(event.data.object.id);
        console.log(`[Webhook] Successfully processed payment: ${event.data.object.id}`);
        break;

      case 'payment_intent.payment_failed':
        console.log(`[Webhook] Payment failed: ${event.data.object.id}`);
        // TODO: Handle failed payment notification
        break;

      case 'customer.created':
        console.log(`[Webhook] Customer created: ${event.data.object.id}`);
        break;

      case 'invoice.payment_succeeded':
        console.log(`[Webhook] Invoice payment succeeded: ${event.data.object.id}`);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    next(error);
  }
});

export { router as webhookRoutes };