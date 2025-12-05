import Stripe from 'stripe';
import { HttpError } from '../errors';

let stripe: Stripe | null = null;

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('WARNING: STRIPE_SECRET_KEY not set. Stripe functionality will be disabled.');
} else {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil',
  });
}

export interface CreatePaymentIntentOptions {
  amount: number; // in cents
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerOptions {
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, string>;
}

export class StripeService {
  private checkStripeAvailable() {
    if (!stripe) {
      throw new HttpError(503, 'Stripe is not configured. Payment functionality is unavailable.');
    }
  }

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<Stripe.PaymentIntent> {
    this.checkStripeAvailable();
    
    try {
      const paymentIntent = await stripe!.paymentIntents.create({
        amount: Math.round(options.amount),
        currency: options.currency || 'usd',
        description: options.description,
        metadata: options.metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      throw new HttpError(400, `Payment intent creation failed: ${error.message}`);
    }
  }

  async createCustomer(options: CreateCustomerOptions): Promise<Stripe.Customer> {
    this.checkStripeAvailable();
    
    try {
      const existingCustomers = await stripe!.customers.list({
        email: options.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      const customer = await stripe!.customers.create({
        email: options.email,
        name: options.name,
        phone: options.phone,
        address: options.address,
        metadata: options.metadata || {},
      });

      return customer;
    } catch (error: any) {
      console.error('Error creating customer:', error);
      throw new HttpError(400, `Customer creation failed: ${error.message}`);
    }
  }

  async createPaymentLink(options: {
    amount: number;
    description: string;
    invoiceId: number;
    customerEmail?: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<Stripe.PaymentLink> {
    this.checkStripeAvailable();
    
    try {
      const paymentLink = await stripe!.paymentLinks.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: options.description,
              },
              unit_amount: Math.round(options.amount),
            },
            quantity: 1,
          },
        ],
        metadata: {
          invoiceId: options.invoiceId.toString(),
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: options.successUrl || `${process.env.BASE_URL || 'http://localhost:5000'}/payment-success`,
          },
        },
      });

      return paymentLink;
    } catch (error: any) {
      console.error('Error creating payment link:', error);
      throw new HttpError(400, `Payment link creation failed: ${error.message}`);
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    this.checkStripeAvailable();
    
    try {
      return await stripe!.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      console.error('Error retrieving payment intent:', error);
      throw new HttpError(404, `Payment intent not found: ${error.message}`);
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent> {
    this.checkStripeAvailable();
    
    try {
      const confirmation: Stripe.PaymentIntentConfirmParams = {};
      
      if (paymentMethodId) {
        confirmation.payment_method = paymentMethodId;
      }

      return await stripe!.paymentIntents.confirm(paymentIntentId, confirmation);
    } catch (error: any) {
      console.error('Error confirming payment intent:', error);
      throw new HttpError(400, `Payment confirmation failed: ${error.message}`);
    }
  }

  async createRefund(chargeId: string, amount?: number): Promise<Stripe.Refund> {
    this.checkStripeAvailable();
    
    try {
      const refundData: Stripe.RefundCreateParams = {
        charge: chargeId,
      };

      if (amount) {
        refundData.amount = Math.round(amount);
      }

      return await stripe!.refunds.create(refundData);
    } catch (error: any) {
      console.error('Error creating refund:', error);
      throw new HttpError(400, `Refund creation failed: ${error.message}`);
    }
  }

  async constructEvent(body: string | Buffer, signature: string): Promise<Stripe.Event> {
    this.checkStripeAvailable();
    
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new HttpError(500, 'Stripe webhook secret not configured');
    }

    try {
      return stripe!.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error: any) {
      console.error('Error constructing webhook event:', error);
      throw new HttpError(400, `Webhook signature verification failed: ${error.message}`);
    }
  }
}

export const stripeService = new StripeService();
