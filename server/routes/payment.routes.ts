import { Router } from 'express';
import Stripe from 'stripe';
import { storage } from '../storage';
import { HttpError } from '../errors';
import { sendEmail } from '../email';
import { paymentService } from '../services/payment.service';

let stripe: Stripe | null = null;

try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Warning: STRIPE_SECRET_KEY not found - payment routes will be disabled');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
    });
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
}

const router = Router();

/**
 * Accept quote and create project (without immediate payment)
 * Payment will be triggered manually by admin later
 */
router.post('/payment/quotes/:id/accept', async (req, res, next) => {
  try {
    console.log('[accept-quote] Starting quote acceptance process...');
    console.log('[accept-quote] Request body:', JSON.stringify(req.body, null, 2));

    const quoteId = parseInt(req.params.id);

    if (isNaN(quoteId)) {
      console.log('[accept-quote] ERROR: Invalid quote ID');
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const { customerName, customerEmail, customerPhone } = req.body;
    console.log(`[accept-quote] Processing for quote ID: ${quoteId}, customer: ${customerName} (${customerEmail})`);

    if (!customerName || !customerEmail) {
      console.log('[accept-quote] ERROR: Missing customer information');
      return res.status(400).json({ error: 'Customer name and email are required' });
    }

    console.log('[accept-quote] Calling paymentService.processQuoteAcceptance...');
    // Use PaymentService to create project without payment
    const result = await paymentService.processQuoteAcceptance(quoteId, {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    });
    console.log('[accept-quote] Project created successfully');

    console.log('[accept-quote] Updating quote status to accepted...');
    // Update quote status to accepted
    await storage.quotes.updateQuote(quoteId, {
      status: 'accepted',
      customerName,
      customerEmail,
      respondedAt: new Date(),
    });

    const response = {
      success: true,
      message: 'Quote accepted successfully. Project has been created.',
      project: {
        id: Number(result.project.id),
        name: String(result.project.name),
        status: String(result.project.status),
        totalBudget: String(result.project.totalBudget),
      },
      invoice: {
        id: Number(result.downPaymentInvoice.id),
        invoiceNumber: String(result.downPaymentInvoice.invoiceNumber),
        amount: String(result.downPaymentInvoice.amount),
        status: String(result.downPaymentInvoice.status),
        description: 'Down payment invoice created (draft status - will be sent manually)',
      },
    };

    console.log('[accept-quote] Sending response:', JSON.stringify(response));
    return res.status(200).json(response);
  } catch (error) {
    console.error('[accept-quote] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to accept quote'
    });
  }
});

/**
 * Manually trigger down payment for a project
 * This creates the payment intent and sends payment instructions to the customer
 */
router.post('/projects/:id/trigger-down-payment', async (req, res, next) => {
  try {
    console.log('[trigger-down-payment] Triggering down payment for project...');

    if (!stripe) {
      console.log('[trigger-down-payment] ERROR: Stripe not initialized');
      throw new HttpError(503, 'Payment processing temporarily unavailable');
    }

    const projectId = parseInt(req.params.id);
    console.log(`[trigger-down-payment] Project ID: ${projectId}`);

    const result = await paymentService.triggerDownPayment(projectId);
    console.log('[trigger-down-payment] Down payment triggered successfully');

    res.json({
      success: true,
      message: 'Down payment invoice sent to customer',
      invoice: {
        id: result.invoice.id,
        invoiceNumber: result.invoice.invoiceNumber,
        amount: result.invoice.amount,
        status: 'pending',
        paymentLink: result.invoice.paymentLink,
      },
      paymentIntent: {
        id: result.paymentIntent.id,
        status: result.paymentIntent.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Handle successful payment confirmation from client-side
 * This endpoint processes payments that are confirmed on the client side.
 * It uses the same payment processing logic as the webhook to ensure consistency.
 */
router.post('/payment-success', async (req, res, next) => {
  try {
    console.log('[payment-success] Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[payment-success] Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { paymentIntentId } = req.body;
    console.log('[payment-success] Extracted paymentIntentId:', paymentIntentId);

    if (!paymentIntentId) {
      console.log('[payment-success] Missing paymentIntentId in request body');
      throw new HttpError(400, 'Payment intent ID is required');
    }

    if (!stripe) {
      throw new HttpError(503, 'Payment processing temporarily unavailable');
    }

    // Retrieve payment intent from Stripe to verify it succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // For test/development: Allow processing even if payment hasn't succeeded yet
    // In production, only process actually succeeded payments
    const shouldProcess = paymentIntent.status === 'succeeded' || 
                         (process.env.NODE_ENV !== 'production' && paymentIntent.status === 'requires_payment_method');

    if (!shouldProcess) {
      throw new HttpError(400, `Payment status '${paymentIntent.status}' cannot be processed`);
    }

    // Use the same payment processing logic as the webhook
    await paymentService.handlePaymentSuccess(paymentIntentId);

    // Get the processed invoice and project details for response
    const metadata = paymentIntent.metadata;
    const invoiceId = metadata.invoiceId ? parseInt(metadata.invoiceId) : null;
    const projectId = metadata.projectId ? parseInt(metadata.projectId) : null;
    const quoteId = metadata.quoteId ? parseInt(metadata.quoteId) : null;

    let responseData: any = {
      success: true,
      message: 'Payment processed successfully',
    };

    // Add additional details if available
    if (invoiceId) {
      const invoice = await storage.invoices.getInvoiceById(invoiceId);
      if (invoice) {
        responseData.invoice = {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          status: invoice.status,
        };
      }
    }

    if (projectId) {
      const project = await storage.projects.getProjectById(projectId);
      if (project) {
        responseData.project = {
          id: project.id,
          name: project.name,
          status: project.status,
        };
      }
    }

    if (quoteId) {
      const quote = await storage.quotes.getQuoteById(quoteId);
      if (quote) {
        responseData.quote = {
          id: quote.id,
          status: quote.status,
          title: quote.title,
          quoteNumber: quote.quoteNumber,
        };
      }
    }

    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

/**
 * Create payment intent for milestone payments
 */
router.post('/projects/:id/milestone-payment', async (req, res, next) => {
  try {
    if (!stripe) {
      throw new HttpError(503, 'Payment processing temporarily unavailable');
    }

    const projectId = parseInt(req.params.id);
    const { milestoneDescription } = req.body;

    const project = await storage.projects.getProjectById(projectId);
    if (!project || !project.originQuoteId) {
      throw new HttpError(404, 'Project or originating quote not found');
    }

    const quote = await storage.quotes.getQuoteById(project.originQuoteId);
    if (!quote) {
      throw new HttpError(404, 'Originating quote not found');
    }

    // Calculate milestone payment amount
    const total = parseFloat(quote.total?.toString() || '0');
    const milestonePercentage = quote.milestonePaymentPercentage || 40;
    const milestoneAmount = (total * milestonePercentage) / 100;

    // Create Stripe payment intent
    const paymentIntent = await stripe!.paymentIntents.create({
      amount: Math.round(milestoneAmount * 100),
      currency: 'usd',
      description: `Milestone payment for ${project.name}`,
      metadata: {
        projectId: project.id.toString(),
        quoteId: quote.id.toString(),
        paymentType: 'milestone',
        milestonePercentage: milestonePercentage.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: milestoneAmount,
      milestonePercentage,
      project: {
        id: project.id,
        name: project.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Test endpoint to debug routing
 */
router.get('/test', (req, res) => {
  res.json({ status: 'working', timestamp: new Date().toISOString() });
});

/**
 * Get payment information by client secret - PUBLIC ENDPOINT
 * This endpoint is accessible without authentication for customer payments
 */
router.get('/payment/info/:clientSecret', async (req, res, next) => {
  // Force JSON response headers to prevent HTML interception
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  try {
    if (!stripe) {
      throw new HttpError(503, 'Payment processing temporarily unavailable');
    }

    const clientSecret = req.params.clientSecret;
    
    // Extract payment intent ID from client secret
    const paymentIntentId = clientSecret.split('_secret_')[0];
    
    if (!paymentIntentId) {
      throw new HttpError(400, 'Invalid client secret format');
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent) {
      throw new HttpError(404, 'Payment intent not found');
    }

    // Get associated invoice from database using payment intent ID
    const invoice = await storage.invoices.getInvoiceByPaymentIntentId(paymentIntentId);
    
    if (!invoice) {
      throw new HttpError(404, 'Associated invoice not found');
    }

    // Get project information if available
    let projectName = 'Your Project';
    if (invoice.projectId) {
      const project = await storage.projects.getProjectById(invoice.projectId);
      if (project) {
        projectName = project.name;
      }
    }

    const paymentInfo = {
      amount: paymentIntent.amount / 100, // Convert from cents to dollars
      description: paymentIntent.description || invoice.description || 'Payment',
      customerName: invoice.customerName || undefined,
      projectName: projectName,
      invoiceNumber: invoice.invoiceNumber,
    };

    res.json(paymentInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * Send project welcome email after down payment
 */
async function sendProjectWelcomeEmail(
  customerEmail: string,
  customerName: string,
  quote: any
): Promise<void> {
  const subject = `Welcome to Your Project - ${quote.title}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3d4552;">Welcome to Your Project!</h2>
      
      <p>Dear ${customerName},</p>
      
      <p>Thank you for your payment! Your project <strong>${quote.title}</strong> is now officially underway.</p>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #3d4552;">Payment Confirmed</h3>
        <p><strong>Quote Number:</strong> ${quote.quoteNumber}</p>
        <p><strong>Down Payment:</strong> Received</p>
        <p><strong>Project Status:</strong> Planning Phase</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #3d4552;">Next Steps</h3>
        <ul>
          <li>Project planning and scheduling will begin within 2 business days</li>
          <li>You'll receive regular progress updates via email</li>
          <li>Your project manager will contact you to schedule the kick-off meeting</li>
          <li>Milestone payments will be requested as work progresses</li>
        </ul>
      </div>
      
      <p>We're excited to work with you and bring your vision to life!</p>
      
      <p>Best regards,<br>The Kolmo Construction Team</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">
        This is an automated message. Please do not reply directly to this email.
      </p>
    </div>
  `;

  if (!customerEmail) {
    throw new Error('Customer email is required for welcome email');
  }

  await sendEmail({
    to: customerEmail,
    subject,
    html,
    fromName: 'Kolmo Construction',
  });
}

export { router as paymentRoutes };