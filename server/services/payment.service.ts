import { stripeService } from './stripe.service';
import { storage } from '../storage';
import { HttpError } from '../errors';
import { sendEmail } from '../email';
import { insertInvoiceSchema } from '@shared/schema';
import type { Quote, Invoice, Project } from '@shared/schema';

export interface PaymentSchedule {
  downPayment: {
    amount: number;
    percentage: number;
    dueDate: Date;
  };
  milestonePayment: {
    amount: number;
    percentage: number;
    description: string;
  };
  finalPayment: {
    amount: number;
    percentage: number;
  };
}

export class PaymentService {
  /**
   * Calculate payment schedule from quote
   */
  calculatePaymentSchedule(quote: Quote): PaymentSchedule {
    const total = parseFloat(quote.total?.toString() || '0');
    const downPercent = Number(quote.downPaymentPercentage) || 30;
    const milestonePercent = Number(quote.milestonePaymentPercentage) || 40;
    const finalPercent = Number(quote.finalPaymentPercentage) || 30;

    return {
      downPayment: {
        amount: (total * downPercent) / 100,
        percentage: downPercent,
        dueDate: new Date(), // Due immediately upon acceptance
      },
      milestonePayment: {
        amount: (total * milestonePercent) / 100,
        percentage: milestonePercent,
        description: quote.milestoneDescription || 'Project milestone completion',
      },
      finalPayment: {
        amount: (total * finalPercent) / 100,
        percentage: finalPercent,
      },
    };
  }

  /**
   * Process quote acceptance and create payment workflow
   */
  async processQuoteAcceptance(quoteId: number, customerInfo: {
    name: string;
    email: string;
    phone?: string;
  }): Promise<{
    project: Project;
    downPaymentInvoice: Invoice;
    paymentIntent: any;
  }> {
    try {
      // Get quote details
      const quote = await storage.quotes.getQuoteById(quoteId);
      if (!quote) {
        throw new HttpError(404, 'Quote not found');
      }

      // Calculate payment schedule
      const paymentSchedule = this.calculatePaymentSchedule(quote);

      // Create project from quote
      const project = await this.createProjectFromQuote(quote, customerInfo);

      // Create down payment invoice
      const downPaymentInvoice = await this.createDownPaymentInvoice(
        quote,
        project,
        paymentSchedule.downPayment,
        customerInfo
      );

      // Create Stripe payment intent for down payment
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: Math.round(paymentSchedule.downPayment.amount * 100), // Convert to cents
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        description: `Down payment for ${quote.title} - Quote #${quote.quoteNumber}`,
        metadata: {
          quoteId: quote.id.toString(),
          invoiceId: downPaymentInvoice.id.toString(),
          projectId: project.id.toString(),
          paymentType: 'down_payment',
        },
      });

      // Update invoice with Stripe payment intent ID
      await storage.invoices.updateInvoice(downPaymentInvoice.id, {
        stripePaymentIntentId: paymentIntent.id,
        paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
      });

      // Note: For down payments, we don't send payment instructions immediately.
      // The customer will complete payment through the UI, and the webhook will
      // send the project welcome email upon successful payment.

      return {
        project,
        downPaymentInvoice,
        paymentIntent,
      };
    } catch (error) {
      console.error('Error processing quote acceptance:', error);
      throw error;
    }
  }

  /**
   * Create project from accepted quote
   */
  private async createProjectFromQuote(quote: Quote, customerInfo: {
    name: string;
    email: string;
    phone?: string;
  }): Promise<Project> {
    const projectData = {
      name: quote.title,
      description: quote.description || `Project created from Quote #${quote.quoteNumber}`,
      address: quote.customerAddress || 'Address from quote',
      city: 'City', // Default value, will be enhanced with proper quote fields
      state: 'State', // Default value, will be enhanced with proper quote fields  
      zipCode: '00000', // Default value, will be enhanced with proper quote fields
      totalBudget: quote.total?.toString() || '0',
      status: 'planning' as const,
      estimatedCompletionDate: quote.estimatedCompletionDate,
      originQuoteId: quote.id,
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      customerPhone: customerInfo.phone || null,
    };

    return await storage.projects.createProject(projectData);
  }

  /**
   * Create down payment invoice
   */
  private async createDownPaymentInvoice(
    quote: Quote,
    project: Project,
    downPayment: { amount: number; percentage: number; dueDate: Date },
    customerInfo: { name: string; email: string }
  ): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();
    
    const invoiceData = {
      projectId: project.id,
      quoteId: quote.id,
      invoiceNumber,
      amount: downPayment.amount.toString(),
      description: `Down payment (${downPayment.percentage}%) for ${quote.title}`,
      issueDate: new Date(),
      dueDate: downPayment.dueDate,
      invoiceType: 'down_payment' as const,
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
    };

    const invoice = await storage.invoices.createInvoice(invoiceData);
    if (!invoice) {
      throw new Error('Failed to create down payment invoice');
    }
    return invoice;
  }

  /**
   * Creates a draft invoice for a completed billable milestone.
   * This does NOT trigger payment intents or emails.
   */
  async createDraftInvoiceForMilestone(projectId: number, milestoneId: number): Promise<Invoice | null> {
    const project = await storage.projects.getProjectById(projectId);
    if (!project) {
      throw new HttpError(404, 'Project not found for billing.');
    }

    const milestone = await storage.milestones.getMilestoneById(milestoneId);
    if (!milestone || !milestone.isBillable || !milestone.billingPercentage) {
      throw new HttpError(400, 'Milestone is not billable or is missing billing details.');
    }

    // Check if an invoice has already been created for this milestone
    if (milestone.invoiceId) {
      console.log(`Invoice already exists for milestone ${milestoneId}. Skipping creation.`);
      return null;
    }

    // Try to get total amount from quote first, then fall back to project budget
    let totalAmount = 0;
    if (project.originQuoteId) {
      const quote = await storage.quotes.getQuoteById(project.originQuoteId);
      if (quote) {
        totalAmount = parseFloat(quote.total?.toString() || '0');
      }
    }
    
    // If totalAmount is still 0 (e.g., quote not found or no originQuoteId),
    // fall back to the project's own budget.
    if (totalAmount === 0) {
      totalAmount = parseFloat(project.totalBudget?.toString() || '0');
    }

    if (totalAmount <= 0) {
      throw new HttpError(400, 'Project total budget must be greater than zero to create a billable invoice.');
    }

    // Corrected logic in payment.service (1).ts
    const unroundedAmount = (totalAmount * parseFloat(milestone.billingPercentage)) / 100;
    const milestoneAmount = parseFloat(unroundedAmount.toFixed(2));
    const invoiceNumber = await this.generateInvoiceNumber();
    
  

    const invoiceData = {
      projectId: project.id,
      quoteId: project.originQuoteId || null, // Pass it if it exists
      milestoneId: milestone.id, // Link the invoice to the milestone
      invoiceNumber,
      amount: milestoneAmount.toString(),
      description: `Payment for completed milestone: ${milestone.title}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Due 14 days from now
      // status will default to 'draft' - remove explicit pending status
      invoiceType: 'milestone' as const,
      customerName: project.customerName || '',
      customerEmail: project.customerEmail || '',
    };

    const invoice = await storage.invoices.createInvoice(invoiceData);
    if (!invoice) {
      throw new Error('Failed to create draft milestone invoice in database.');
    }

    // Update the milestone to link it to the newly created invoice ID
    await storage.milestones.updateMilestone(milestoneId, {
        invoiceId: invoice.id,
        // Mark milestone as billed // Set the billing timestamp here
    });

    return invoice;
  }

  /**
   * Finalizes a draft invoice, generates a payment link, and sends it.
   */
  async sendDraftInvoice(invoiceId: number): Promise<Invoice | null> {
    const invoice = await storage.invoices.getInvoiceById(invoiceId);

    if (!invoice) {
      throw new HttpError(404, 'Invoice not found.');
    }
    if (invoice.status !== 'draft') {
      throw new HttpError(400, 'Invoice is not in draft status and cannot be sent.');
    }

    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(parseFloat(invoice.amount) * 100),
      customerEmail: invoice.customerEmail || undefined,
      customerName: invoice.customerName || undefined,
      description: invoice.description || `Payment for Invoice #${invoice.invoiceNumber}`,
      metadata: {
        invoiceId: invoice.id.toString(),
        projectId: invoice.projectId?.toString() || '',
        paymentType: 'milestone',
      },
    });

    const paymentLink = `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`;

    // Update the invoice to 'pending' and add the Stripe details
    const updatedInvoice = await storage.invoices.updateInvoice(invoice.id, {
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      paymentLink: paymentLink,
      issueDate: new Date(), // Update issue date to when it was sent
    });

    if (!updatedInvoice) {
      throw new HttpError(500, 'Failed to update invoice before sending.');
    }

    // Send the payment instruction email
    if (updatedInvoice.customerEmail) {
      await this.sendPaymentInstructions(updatedInvoice.customerEmail, {
        customerName: updatedInvoice.customerName || 'Customer',
        projectName: updatedInvoice.description || 'Your Project',
        amount: parseFloat(updatedInvoice.amount),
        paymentLink: paymentLink,
        dueDate: new Date(updatedInvoice.dueDate),
        paymentType: 'milestone',
      });
    }

    return updatedInvoice;
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `INV-${year}${month}-${randomSuffix}`;
  }

  /**
   * Create milestone payment invoice
   */
  async createMilestonePayment(projectId: number, milestoneDescription?: string): Promise<Invoice> {
    const project = await storage.projects.getProjectById(projectId);
    if (!project || !project.originQuoteId) {
      throw new HttpError(404, 'Project or originating quote not found');
    }

    const quote = await storage.quotes.getQuoteById(project.originQuoteId);
    if (!quote) {
      throw new HttpError(404, 'Originating quote not found');
    }

    const paymentSchedule = this.calculatePaymentSchedule(quote);
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoiceData = {
      projectId: project.id,
      quoteId: quote.id,
      invoiceNumber,
      amount: paymentSchedule.milestonePayment.amount.toString(),
      description: milestoneDescription || paymentSchedule.milestonePayment.description,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      invoiceType: 'milestone' as const,
      customerName: project.customerName || '',
      customerEmail: project.customerEmail || '',
    };

    const invoice = await storage.invoices.createInvoice(invoiceData);
    if (!invoice) {
      throw new Error('Failed to create milestone invoice');
    }

    // Create payment intent for milestone payment
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(paymentSchedule.milestonePayment.amount * 100),
      customerEmail: project.customerEmail || undefined,
      customerName: project.customerName || undefined,
      description: `Milestone payment for ${project.name}`,
      metadata: {
        projectId: project.id.toString(),
        invoiceId: invoice.id.toString(),
        paymentType: 'milestone',
      },
    });

    // Update invoice with payment intent
    await storage.invoices.updateInvoice(invoice.id, {
      stripePaymentIntentId: paymentIntent.id,
      paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
    });

    // Send milestone payment email
    if (project.customerEmail) {
      await this.sendPaymentInstructions(project.customerEmail, {
        customerName: project.customerName || 'Customer',
        projectName: project.name,
        amount: paymentSchedule.milestonePayment.amount,
        paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        paymentType: 'milestone',
      });
    }

    return invoice;
  }

  /**
   * Create milestone-based payment for specific milestone
   */
  async createMilestoneBasedPayment(projectId: number, milestoneId: number, milestoneTitle: string): Promise<Invoice> {
    const project = await storage.projects.getProjectById(projectId);
    if (!project || !project.originQuoteId) {
      throw new HttpError(404, 'Project or originating quote not found');
    }

    const milestone = await storage.milestones.getMilestoneById(milestoneId);
    if (!milestone || !milestone.isBillable || !milestone.billingPercentage) {
      throw new HttpError(400, 'Invalid billable milestone');
    }

    const quote = await storage.quotes.getQuoteById(project.originQuoteId);
    if (!quote) {
      throw new HttpError(404, 'Originating quote not found');
    }

    // Calculate milestone amount based on percentage
    const totalAmount = parseFloat(quote.total?.toString() || '0');
    const milestoneAmount = (totalAmount * parseFloat(milestone.billingPercentage)) / 100;
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoiceData = {
      projectId: project.id,
      quoteId: quote.id,
      invoiceNumber,
      amount: milestoneAmount.toString(),
      description: `Milestone Payment: ${milestoneTitle}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      invoiceType: 'milestone' as const,
      customerName: project.customerName || '',
      customerEmail: project.customerEmail || '',
    };

    const invoice = await storage.invoices.createInvoice(invoiceData);
    if (!invoice) {
      throw new Error('Failed to create milestone invoice');
    }

    // Create payment intent for milestone payment
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(milestoneAmount * 100),
      customerEmail: project.customerEmail || undefined,
      customerName: project.customerName || undefined,
      description: `Milestone payment: ${milestoneTitle} for ${project.name}`,
      metadata: {
        projectId: project.id.toString(),
        invoiceId: invoice.id.toString(),
        milestoneId: milestone.id.toString(),
        paymentType: 'milestone',
      },
    });

    // Update invoice with payment intent
    await storage.invoices.updateInvoice(invoice.id, {
      stripePaymentIntentId: paymentIntent.id,
      paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
    });

    // Send milestone payment email
    if (project.customerEmail) {
      await this.sendPaymentInstructions(project.customerEmail, {
        customerName: project.customerName || 'Customer',
        projectName: project.name,
        amount: milestoneAmount,
        paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        paymentType: 'milestone',
      });
    }

    return invoice;
  }

  /**
   * Create final payment invoice
   */
  async createFinalPayment(projectId: number): Promise<Invoice> {
    const project = await storage.projects.getProjectById(projectId);
    if (!project || !project.originQuoteId) {
      throw new HttpError(404, 'Project or originating quote not found');
    }

    const quote = await storage.quotes.getQuoteById(project.originQuoteId);
    if (!quote) {
      throw new HttpError(404, 'Originating quote not found');
    }

    const paymentSchedule = this.calculatePaymentSchedule(quote);
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoiceData = {
      projectId: project.id,
      quoteId: quote.id,
      invoiceNumber,
      amount: paymentSchedule.finalPayment.amount.toString(),
      description: `Final payment (${paymentSchedule.finalPayment.percentage}%) for ${project.name}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      invoiceType: 'final' as const,
      customerName: project.customerName || '',
      customerEmail: project.customerEmail || '',
    };

    const invoice = await storage.invoices.createInvoice(invoiceData);
    if (!invoice) {
      throw new Error('Failed to create final invoice');
    }

    // Create payment intent for final payment
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(paymentSchedule.finalPayment.amount * 100),
      customerEmail: project.customerEmail || undefined,
      customerName: project.customerName || undefined,
      description: `Final payment for ${project.name}`,
      metadata: {
        projectId: project.id.toString(),
        invoiceId: invoice.id.toString(),
        paymentType: 'final',
      },
    });

    // Update invoice with payment intent
    await storage.invoices.updateInvoice(invoice.id, {
      stripePaymentIntentId: paymentIntent.id,
      paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
    });

    // Send final payment email
    if (project.customerEmail) {
      await this.sendPaymentInstructions(project.customerEmail, {
        customerName: project.customerName || 'Customer',
        projectName: project.name,
        amount: paymentSchedule.finalPayment.amount,
        paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        paymentType: 'final',
      });
    }

    return invoice;
  }

  /**
   * Send payment instructions email
   */
  private async sendPaymentInstructions(
    customerEmail: string,
    details: {
      customerName: string;
      projectName: string;
      amount: number;
      paymentLink: string;
      dueDate: Date;
      paymentType?: 'down_payment' | 'milestone' | 'final';
    }
  ): Promise<void> {
    const paymentTypeText = {
      down_payment: 'Down Payment',
      milestone: 'Milestone Payment',
      final: 'Final Payment',
    }[details.paymentType || 'down_payment'];

    const subject = `${paymentTypeText} Required - ${details.projectName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3d4552;">Payment Request - ${details.projectName}</h2>
        
        <p>Dear ${details.customerName},</p>
        
        <p>Your ${paymentTypeText.toLowerCase()} is now due for your project: <strong>${details.projectName}</strong></p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #3d4552;">Payment Details</h3>
          <p><strong>Amount:</strong> $${details.amount.toFixed(2)}</p>
          <p><strong>Due Date:</strong> ${details.dueDate.toLocaleDateString()}</p>
          <p><strong>Payment Type:</strong> ${paymentTypeText}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${details.paymentLink}" 
             style="background: #db973c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Pay Now
          </a>
        </div>
        
        <p>This secure payment link will allow you to pay using credit card, debit card, or bank transfer.</p>
        
        <p>If you have any questions about this payment, please don't hesitate to contact us.</p>
        
        <p>Thank you for your business!</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </div>
    `;

    await sendEmail({
      to: customerEmail,
      subject,
      html,
      fromName: 'Kolmo Construction',
    });
  }

  /**
   * Handle successful payment webhook - This is the single source of truth for payment processing
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    try {
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        const metadata = paymentIntent.metadata;
        const invoiceId = metadata.invoiceId ? parseInt(metadata.invoiceId) : null;
        
        // Find the invoice using the ID from metadata, which should now reliably exist
        if (invoiceId) {
          const invoice = await storage.invoices.getInvoiceById(invoiceId);

          if (invoice && invoice.status !== 'paid') {
            // Update invoice status to paid
            await storage.invoices.updateInvoice(invoiceId, { status: 'paid' as const });

            // Record the payment
            const paymentAmount = paymentIntent.amount / 100; // Convert from cents
            const paymentData = {
              invoiceId: invoiceId,
              amount: paymentAmount.toFixed(2),
              paymentDate: new Date(),
              paymentMethod: 'stripe',
              reference: paymentIntent.id,
              stripePaymentIntentId: paymentIntent.id,
              stripeChargeId: paymentIntent.latest_charge as string,
              status: 'succeeded',
            };
            await storage.invoices.recordPayment(paymentData);
            
            console.log(`Payment successful for invoice ${invoiceId}, amount: $${paymentAmount}`);
            
            // Send appropriate confirmation email
            if (metadata.paymentType === 'down_payment' && invoice.projectId) {
              await this.sendProjectWelcomeEmail(invoice.projectId);
              console.log(`Project welcome email sent for project ${invoice.projectId}`);
            } else {
              await this.sendPaymentConfirmationEmail(invoice, paymentAmount);
              console.log(`Payment confirmation email sent for invoice ${invoice.invoiceNumber}`);
            }
          } else {
            console.log(`[Webhook] Invoice ${invoiceId} already marked as paid or not found. Skipping.`);
          }
        }
      }
    } catch (error) {
      console.error('Error handling payment success webhook:', error);
      throw error;
    }
  }

  /**
   * Send project welcome email after successful down payment
   */
  async sendProjectWelcomeEmail(projectId: number): Promise<void> {
    try {
      const project = await storage.projects.getProjectById(projectId);
      if (!project) {
        console.error(`Project ${projectId} not found for welcome email`);
        return;
      }

      if (!project.customerEmail || !project.customerName) {
        console.error('Customer email or name missing for project welcome email');
        return;
      }

      const subject = `Welcome to Your Kolmo Project - ${project.name}`;
      
      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
          <!-- Header with Logo -->
          <div style="background: #3d4552; padding: 30px 40px; text-align: center;">
            <div style="background: #ffffff; display: inline-block; padding: 12px 24px; border-radius: 8px;">
              <h1 style="margin: 0; color: #3d4552; font-size: 28px; font-weight: bold; letter-spacing: 2px;">KOLMO</h1>
              <p style="margin: 0; color: #db973c; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">CONSTRUCTION</p>
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 40px; background: #ffffff;">
            <h2 style="color: #3d4552; font-size: 24px; margin: 0 0 24px 0; font-weight: 600;">Welcome to Your Project!</h2>
            
            <p style="color: #3d4552; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Dear ${project.customerName},</p>
            
            <p style="color: #3d4552; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Thank you for choosing Kolmo Construction! Your down payment has been received and your project 
              <strong style="color: #db973c;">${project.name}</strong> is now officially underway.
            </p>
            
            <!-- Payment Confirmation Card -->
            <div style="background: #f5f5f5; padding: 24px; border-radius: 12px; margin: 30px 0; border-left: 6px solid #db973c;">
              <h3 style="margin: 0 0 16px 0; color: #3d4552; font-size: 18px; font-weight: 600;">Payment Confirmed ✓</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #4a6670; font-weight: 500;">Project Name:</td>
                  <td style="padding: 6px 0; color: #3d4552; font-weight: 600;">${project.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4a6670; font-weight: 500;">Down Payment:</td>
                  <td style="padding: 6px 0; color: #db973c; font-weight: 600;">Received Successfully</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4a6670; font-weight: 500;">Project Status:</td>
                  <td style="padding: 6px 0; color: #3d4552; font-weight: 600;">Planning Phase</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4a6670; font-weight: 500;">Total Budget:</td>
                  <td style="padding: 6px 0; color: #3d4552; font-weight: 600;">$${parseFloat(project.totalBudget || '0').toFixed(2)}</td>
                </tr>
              </table>
            </div>
            
            <!-- Next Steps Card -->
            <div style="background: #f5f5f5; padding: 24px; border-radius: 12px; margin: 30px 0; border-left: 6px solid #4a6670;">
              <h3 style="margin: 0 0 16px 0; color: #3d4552; font-size: 18px; font-weight: 600;">What Happens Next</h3>
              <ul style="margin: 0; padding-left: 0; list-style: none; color: #3d4552; line-height: 1.8;">
                <li style="margin: 8px 0; padding-left: 20px; position: relative;">
                  <span style="position: absolute; left: 0; color: #db973c; font-weight: bold;">•</span>
                  Project planning and scheduling begins within 2 business days
                </li>
                <li style="margin: 8px 0; padding-left: 20px; position: relative;">
                  <span style="position: absolute; left: 0; color: #db973c; font-weight: bold;">•</span>
                  Regular progress updates delivered to your inbox
                </li>
                <li style="margin: 8px 0; padding-left: 20px; position: relative;">
                  <span style="position: absolute; left: 0; color: #db973c; font-weight: bold;">•</span>
                  Your dedicated project manager will schedule a kick-off meeting
                </li>
                <li style="margin: 8px 0; padding-left: 20px; position: relative;">
                  <span style="position: absolute; left: 0; color: #db973c; font-weight: bold;">•</span>
                  Milestone payment requests as work progresses
                </li>
              </ul>
            </div>
            
            <!-- Project Dashboard Card -->
            <div style="background: linear-gradient(135deg, #db973c 0%, #e6a347 100%); padding: 24px; border-radius: 12px; margin: 30px 0; text-align: center;">
              <h3 style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px; font-weight: 600;">Project Dashboard Access</h3>
              <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 14px; opacity: 0.95;">
                Monitor progress, view updates, and communicate with our team through your dedicated project portal.
              </p>
              <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">
                Login credentials will be sent to you within 24 hours.
              </p>
            </div>
            
            <p style="color: #3d4552; font-size: 16px; line-height: 1.6; margin: 30px 0 20px 0;">
              We're excited to work with you and bring your vision to life. Our team is committed to delivering 
              exceptional results that exceed your expectations.
            </p>
            
            <p style="color: #3d4552; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              If you have any questions or concerns, please don't hesitate to reach out to us at any time.
            </p>
            
            <p style="color: #3d4552; font-size: 16px; margin: 0;">
              <strong>Best regards,</strong><br>
              <span style="color: #db973c; font-weight: 600;">The Kolmo Construction Team</span>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f5f5f5; padding: 30px 40px; text-align: center; border-top: 3px solid #db973c;">
            <div style="margin-bottom: 16px;">
              <h3 style="margin: 0; color: #3d4552; font-size: 20px; font-weight: bold; letter-spacing: 1px;">KOLMO</h3>
              <p style="margin: 0; color: #4a6670; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">CONSTRUCTION</p>
            </div>
            <p style="margin: 0; color: #4a6670; font-size: 13px; line-height: 1.5;">
              This email confirms your payment and project initiation.<br>
              Please keep this confirmation for your records.
            </p>
          </div>
        </div>`;

      await sendEmail({
        to: project.customerEmail,
        subject,
        html,
        fromName: 'Kolmo Construction',
      });
      
      console.log(`Project welcome email sent to ${project.customerEmail} for project ${project.name}`);
    } catch (error) {
      console.error('Error sending project welcome email:', error);
      throw error;
    }
  }

  /**
   * Send payment confirmation email for milestone/final payments
   */
  private async sendPaymentConfirmationEmail(invoice: Invoice, paymentAmount: number): Promise<void> {
    if (!invoice.customerEmail || !invoice.customerName) {
      console.error('Customer email or name missing for payment confirmation');
      return;
    }

    const paymentTypeText = invoice.invoiceType === 'down_payment' ? 'Down Payment' :
                            invoice.invoiceType === 'milestone' ? 'Milestone Payment' :
                            invoice.invoiceType === 'final' ? 'Final Payment' : 'Payment';

    const subject = `Payment Confirmation - ${paymentTypeText} Received`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3d4552;">Payment Confirmation</h2>
        
        <p>Dear ${invoice.customerName},</p>
        
        <p>Thank you! We've successfully received your ${paymentTypeText.toLowerCase()} payment.</p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 10px 0; color: #1e40af;">Payment Details</h3>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Amount Paid:</strong> $${paymentAmount.toFixed(2)}</p>
          <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Payment Type:</strong> ${paymentTypeText}</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Description:</strong> ${invoice.description}</p>
        </div>
        
        ${invoice.invoiceType === 'milestone' ? `
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin: 0 0 10px 0; color: #047857;">Project Progress</h3>
            <p>Your project is progressing well! This milestone payment allows us to continue with the next phase of work.</p>
            <p>You'll receive updates as we complete each stage of your project.</p>
          </div>
        ` : invoice.invoiceType === 'final' ? `
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">Project Completion</h3>
            <p>Congratulations! This final payment completes your project. We're excited to have worked with you.</p>
            <p>Our team will be in touch regarding any final details and project handover.</p>
          </div>
        ` : ''}
        
        <p>If you have any questions about this payment or your project, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>The Kolmo Construction Team</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          This is an automated payment confirmation. Please keep this email for your records.
        </p>
      </div>
    `;

    await sendEmail({
      to: invoice.customerEmail,
      subject,
      html,
      fromName: 'Kolmo Construction',
    });
  }


}

export const paymentService = new PaymentService();