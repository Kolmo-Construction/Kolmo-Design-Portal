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
 * Create payment intent for quote acceptance down payment
 */
router.post('/quotes/:id/accept-payment', async (req, res, next) => {
  try {
    if (!stripe) {
      throw new HttpError(503, 'Payment processing temporarily unavailable');
    }

    const quoteId = parseInt(req.params.id);
    const { customerName, customerEmail, customerPhone } = req.body;

    if (!customerName || !customerEmail) {
      throw new HttpError(400, 'Customer name and email are required');
    }

    // Use PaymentService to process quote acceptance
    const result = await paymentService.processQuoteAcceptance(quoteId, {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    });

    // Update quote status to accepted
    await storage.quotes.updateQuote(quoteId, {
      status: 'accepted',
      customerName,
      customerEmail,
      respondedAt: new Date(),
    });

    res.json({
      clientSecret: result.paymentIntent.client_secret,
      amount: parseFloat(result.downPaymentInvoice.amount.toString()),
      downPaymentPercentage: result.paymentIntent.metadata.downPaymentPercentage || '30',
      quote: {
        id: quoteId,
        title: result.project.name,
        quoteNumber: result.paymentIntent.metadata.quoteNumber,
        total: result.project.totalBudget,
      },
      project: {
        id: result.project.id,
        name: result.project.name,
        status: result.project.status,
      },
      invoice: {
        id: result.downPaymentInvoice.id,
        invoiceNumber: result.downPaymentInvoice.invoiceNumber,
        amount: result.downPaymentInvoice.amount,
        status: result.downPaymentInvoice.status,
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
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      throw new HttpError(400, 'Payment intent ID is required');
    }

    if (!stripe) {
      throw new HttpError(503, 'Payment processing temporarily unavailable');
    }

    // Retrieve payment intent from Stripe to verify it succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new HttpError(400, 'Payment has not succeeded');
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
 * Get payment information by client secret
 */
router.get('/info/:clientSecret', async (req, res, next) => {
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