import Stripe from 'stripe';
import { HttpError } from '../errors';
import { generatePaymentSuccessUrl } from '../domain.config';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-05-28.basil',
});

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
  /**
   * Create a payment intent for one-time payments
   */
  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(options.amount), // Ensure it's an integer
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

  /**
   * Create or retrieve a Stripe customer
   */
  async createCustomer(options: CreateCustomerOptions): Promise<Stripe.Customer> {
    try {
      // First check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email: options.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      const customer = await stripe.customers.create({
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

  /**
   * Create a payment link for invoice payments
   */
  async createPaymentLink(options: {
    amount: number;
    description: string;
    invoiceId: number;
    customerEmail?: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<Stripe.PaymentLink> {
    try {
      // First create a price object
      const price = await stripe.prices.create({
        currency: 'usd',
        product_data: {
          name: options.description,
        },
        unit_amount: Math.round(options.amount),
      });

      const paymentLink = await stripe.paymentLinks.create({
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        metadata: {
          invoiceId: options.invoiceId.toString(),
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: options.successUrl || generatePaymentSuccessUrl(),
          },
        },
      });

      return paymentLink;
    } catch (error: any) {
      console.error('Error creating payment link:', error);
      throw new HttpError(400, `Payment link creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve payment intent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      console.error('Error retrieving payment intent:', error);
      throw new HttpError(404, `Payment intent not found: ${error.message}`);
    }
  }

  /**
   * Confirm payment intent (for server-side confirmation)
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const confirmation: Stripe.PaymentIntentConfirmParams = {};
      
      if (paymentMethodId) {
        confirmation.payment_method = paymentMethodId;
      }

      return await stripe.paymentIntents.confirm(paymentIntentId, confirmation);
    } catch (error: any) {
      console.error('Error confirming payment intent:', error);
      throw new HttpError(400, `Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(chargeId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        charge: chargeId,
      };

      if (amount) {
        refundData.amount = Math.round(amount);
      }

      return await stripe.refunds.create(refundData);
    } catch (error: any) {
      console.error('Error creating refund:', error);
      throw new HttpError(400, `Refund creation failed: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async constructEvent(body: string | Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new HttpError(500, 'Stripe webhook secret not configured');
    }

    try {
      return stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error: any) {
      console.error('Error constructing webhook event:', error);
      throw new HttpError(400, `Webhook signature verification failed: ${error.message}`);
    }
  }
}

export const stripeService = new StripeService();