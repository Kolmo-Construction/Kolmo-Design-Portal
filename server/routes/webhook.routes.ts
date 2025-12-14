import { Router } from 'express';
import { stripeService } from '../services/stripe.service';
import { paymentService } from '../services/payment.service';
import { emailParserService, ParsedEmail } from '../services/email-parser.service';
import { storage } from '../storage';

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

/**
 * Email ingestion webhook for lead discovery
 * Receives emails forwarded from kolmo.constructions@gmail.com or projects@kolmo.io
 *
 * Expected format (SendGrid Inbound Parse or similar):
 * POST /api/webhooks/leads/email-ingest
 * {
 *   "from": "notifications@thumbtack.com",
 *   "subject": "New lead from John Smith for Kitchen Remodel in Seattle",
 *   "text": "Full email body...",
 *   "headers": { ... }
 * }
 */
router.post('/leads/email-ingest', async (req, res, next) => {
  try {
    console.log('[Webhook] Lead email received');

    // Parse incoming email (format may vary by provider)
    const parsedEmail: ParsedEmail = {
      from: req.body.from || req.body.envelope?.from || '',
      subject: req.body.subject || '',
      body: req.body.text || req.body.html || '',
      receivedAt: new Date(),
    };

    if (!parsedEmail.from || !parsedEmail.body) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Extract lead information
    const leadData = emailParserService.parseEmail(parsedEmail);

    if (!leadData) {
      console.log('[Webhook] Could not parse lead from email');
      return res.json({ received: true, action: 'ignored' });
    }

    // Save to database
    const lead = await storage.leads.createLead({
      ...leadData,
      detectedAt: parsedEmail.receivedAt,
    });

    console.log(`[Webhook] Created lead #${lead.id} from ${leadData.source}`);

    // TODO: Trigger LeadsAgent to analyze and draft response
    // await agentService.analyzeNewLead(lead.id);

    res.json({
      received: true,
      action: 'created_lead',
      leadId: lead.id
    });
  } catch (error) {
    console.error('[Webhook] Error processing lead email:', error);
    next(error);
  }
});

export { router as webhookRoutes };