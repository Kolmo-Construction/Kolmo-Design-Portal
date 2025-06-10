import { Router } from 'express';
import { storage } from '../storage';
import { HttpError } from '../errors';

const router = Router();

/**
 * Secure payment link redirect endpoint
 * This protects against email click tracking corruption by using a secure token system
 */
router.get('/secure-payment/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      throw new HttpError(400, 'Payment token is required');
    }

    // Find invoice by payment token
    const invoice = await storage.invoices.getInvoiceByPaymentToken(token);
    
    if (!invoice) {
      throw new HttpError(404, 'Payment link not found or expired');
    }

    if (invoice.status === 'paid') {
      // Redirect to payment success page
      return res.redirect('/payment-success?invoice=' + invoice.invoiceNumber);
    }

    // Redirect to the actual Stripe payment page
    if (invoice.paymentLink) {
      return res.redirect(invoice.paymentLink);
    }

    throw new HttpError(404, 'Payment link not available');
    
  } catch (error) {
    next(error);
  }
});

/**
 * Public payment link for invoices (using invoice number)
 */
router.get('/invoice/:invoiceNumber', async (req, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    
    if (!invoiceNumber) {
      throw new HttpError(400, 'Invoice number is required');
    }

    // Find invoice by invoice number
    const invoice = await storage.invoices.getInvoiceByNumber(invoiceNumber);
    
    if (!invoice) {
      throw new HttpError(404, 'Invoice not found');
    }

    if (invoice.status === 'paid') {
      // Redirect to payment success page
      return res.redirect('/payment-success?invoice=' + invoice.invoiceNumber);
    }

    // Redirect to the actual Stripe payment page
    if (invoice.paymentLink) {
      return res.redirect(invoice.paymentLink);
    }

    throw new HttpError(404, 'Payment link not available');
    
  } catch (error) {
    next(error);
  }
});

export default router;