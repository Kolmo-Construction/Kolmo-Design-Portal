import { stripeService } from './stripe.service';
import { storage } from '../storage';
import { HttpError } from '../errors';
import { sendEmail } from '../email';
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

      // Send confirmation email with payment link
      await this.sendPaymentInstructions(customerInfo.email, {
        customerName: customerInfo.name,
        projectName: quote.title,
        amount: paymentSchedule.downPayment.amount,
        paymentLink: `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${paymentIntent.client_secret}`,
        dueDate: paymentSchedule.downPayment.dueDate,
      });

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
   * Handle successful payment webhook
   */
  async handlePaymentSuccess(paymentIntentId: string): Promise<void> {
    try {
      // Get payment intent from Stripe
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);
      
      if (paymentIntent.status === 'succeeded') {
        const metadata = paymentIntent.metadata;
        const invoiceId = parseInt(metadata.invoiceId);
        
        if (invoiceId) {
          // TODO: Record payment and update invoice status when repositories are implemented
          console.log(`Payment successful for invoice ${invoiceId}, amount: ${paymentIntent.amount / 100}`);
          
          // If this was a down payment, send project welcome email
          if (metadata.paymentType === 'down_payment' && metadata.projectId) {
            await this.sendProjectWelcomeEmail(parseInt(metadata.projectId));
          }
        }
      }
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  /**
   * Send project welcome email after down payment
   */
  private async sendProjectWelcomeEmail(projectId: number): Promise<void> {
    const project = await storage.projects.getProjectById(projectId);
    if (!project || !project.customerEmail) return;

    const subject = `Welcome to Your Project - ${project.name}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3d4552;">Welcome to Your Project!</h2>
        
        <p>Dear ${project.customerName},</p>
        
        <p>Thank you for your payment! Your project <strong>${project.name}</strong> is now officially underway.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #3d4552;">Next Steps</h3>
          <ul>
            <li>Project planning and scheduling will begin within 2 business days</li>
            <li>You'll receive regular progress updates via email</li>
            <li>Access your project dashboard at any time to view progress</li>
            <li>Your project manager will contact you to schedule the kick-off meeting</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.BASE_URL || 'http://localhost:5000'}/projects/${project.id}" 
             style="background: #db973c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            View Project Dashboard
          </a>
        </div>
        
        <p>We're excited to work with you and bring your vision to life!</p>
        
        <p>Best regards,<br>The Kolmo Construction Team</p>
      </div>
    `;

    await sendEmail({
      to: project.customerEmail,
      subject,
      html,
      fromName: 'Kolmo Construction',
    });
  }
}

export const paymentService = new PaymentService();