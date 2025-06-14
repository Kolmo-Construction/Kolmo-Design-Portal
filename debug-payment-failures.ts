/**
 * Debug script to identify payment failure issues in the downpayment flow
 */

import { storage } from './server/storage';
import { paymentService } from './server/services/payment.service';
import { stripeService } from './server/services/stripe.service';

async function debugPaymentFailures() {
  console.log('Debugging payment failures for downpayment flow...\n');

  try {
    // 1. Check for recent downpayment invoices
    console.log('1. Checking recent downpayment invoices...');
    const allInvoices = await storage.invoices.getAllInvoices();
    const downpaymentInvoices = allInvoices.filter(inv => inv.invoiceType === 'down_payment');
    
    console.log(`Found ${downpaymentInvoices.length} downpayment invoices`);
    
    if (downpaymentInvoices.length === 0) {
      console.log('❌ No downpayment invoices found to debug');
      return;
    }

    // 2. Check the most recent downpayment invoice
    const recentInvoice = downpaymentInvoices.sort((a, b) => 
      new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    )[0];

    console.log(`\n2. Most recent downpayment invoice: ${recentInvoice.invoiceNumber}`);
    console.log(`   Status: ${recentInvoice.status}`);
    console.log(`   Amount: $${recentInvoice.amount}`);
    console.log(`   Customer: ${recentInvoice.customerName} (${recentInvoice.customerEmail})`);
    console.log(`   Stripe Payment Intent: ${recentInvoice.stripePaymentIntentId}`);
    console.log(`   Project ID: ${recentInvoice.projectId}`);

    // 3. Check Stripe payment intent status if available
    if (recentInvoice.stripePaymentIntentId) {
      console.log(`\n3. Checking Stripe payment intent status...`);
      try {
        const paymentIntent = await stripeService.getPaymentIntent(recentInvoice.stripePaymentIntentId);
        console.log(`   Payment Intent Status: ${paymentIntent.status}`);
        console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
        console.log(`   Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
        console.log(`   Metadata:`, paymentIntent.metadata);
        
        // Check for common failure reasons
        if (paymentIntent.status === 'requires_payment_method') {
          console.log('   ⚠️  Payment requires payment method - customer hasn\'t completed payment');
        } else if (paymentIntent.status === 'requires_confirmation') {
          console.log('   ⚠️  Payment requires confirmation - payment flow interrupted');
        } else if (paymentIntent.status === 'requires_action') {
          console.log('   ⚠️  Payment requires action - 3D Secure or other authentication needed');
        } else if (paymentIntent.status === 'canceled') {
          console.log('   ❌ Payment was canceled');
        } else if (paymentIntent.status === 'processing') {
          console.log('   ⏳ Payment is still processing');
        } else if (paymentIntent.status === 'succeeded') {
          console.log('   ✅ Payment succeeded - checking if webhook processed correctly');
          
          // Check if our system processed the payment
          if (recentInvoice.status !== 'paid') {
            console.log('   ❌ Payment succeeded in Stripe but invoice still not marked as paid');
            console.log('   This suggests a webhook processing issue');
          }
        }
        
      } catch (stripeError) {
        console.error('   ❌ Error retrieving payment intent from Stripe:', stripeError.message);
      }
    } else {
      console.log('   ⚠️  No Stripe payment intent ID found');
    }

    // 4. Check project status if available
    if (recentInvoice.projectId) {
      console.log(`\n4. Checking associated project...`);
      const project = await storage.projects.getProjectById(recentInvoice.projectId);
      if (project) {
        console.log(`   Project: ${project.name}`);
        console.log(`   Status: ${project.status}`);
        console.log(`   Customer: ${project.customerName} (${project.customerEmail})`);
      } else {
        console.log('   ❌ Associated project not found');
      }
    }

    // 5. Check for payment records
    console.log(`\n5. Checking payment records...`);
    const paymentRecords = await storage.invoices.getPaymentsForInvoice(recentInvoice.id);
    console.log(`   Found ${paymentRecords.length} payment records`);
    
    for (const payment of paymentRecords) {
      console.log(`   Payment: $${payment.amount} on ${payment.paymentDate}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Reference: ${payment.reference}`);
    }

    // 6. Test webhook processing manually if payment succeeded but wasn't processed
    if (recentInvoice.stripePaymentIntentId && recentInvoice.status !== 'paid') {
      console.log(`\n6. Testing manual webhook processing...`);
      try {
        const paymentIntent = await stripeService.getPaymentIntent(recentInvoice.stripePaymentIntentId);
        if (paymentIntent.status === 'succeeded') {
          console.log('   Payment succeeded in Stripe, attempting to process manually...');
          await paymentService.handlePaymentSuccess(recentInvoice.stripePaymentIntentId);
          console.log('   ✅ Manual processing completed');
          
          // Check updated status
          const updatedInvoice = await storage.invoices.getInvoiceById(recentInvoice.id);
          console.log(`   Updated invoice status: ${updatedInvoice?.status}`);
        }
      } catch (webhookError) {
        console.error('   ❌ Manual webhook processing failed:', webhookError.message);
      }
    }

    // 7. Check for common configuration issues
    console.log(`\n7. Checking configuration...`);
    const hasStripeKeys = !!(process.env.STRIPE_SECRET_KEY && process.env.VITE_STRIPE_PUBLIC_KEY);
    const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
    const hasBaseUrl = !!process.env.BASE_URL;
    
    console.log(`   Stripe keys configured: ${hasStripeKeys}`);
    console.log(`   Webhook secret configured: ${hasWebhookSecret}`);
    console.log(`   Base URL configured: ${hasBaseUrl}`);
    console.log(`   Base URL: ${process.env.BASE_URL || 'Not set'}`);

  } catch (error) {
    console.error('Debug script error:', error);
  }
}

debugPaymentFailures().catch(console.error);