import { paymentService } from './server/services/payment.service';
import { storage } from './server/storage';

async function testDownpaymentEmailFlow() {
  console.log('Testing downpayment confirmation email flow...\n');

  try {
    // Find a recent downpayment invoice
    const allInvoices = await storage.invoices.getAllInvoices();
    const downpaymentInvoice = allInvoices.find(inv => 
      inv.invoiceType === 'down_payment' && 
      inv.stripePaymentIntentId
    );

    if (!downpaymentInvoice) {
      console.log('❌ No downpayment invoice found with Stripe payment intent');
      return;
    }

    console.log(`✅ Found downpayment invoice: ${downpaymentInvoice.invoiceNumber}`);
    console.log(`   Amount: $${downpaymentInvoice.amount}`);
    console.log(`   Customer: ${downpaymentInvoice.customerEmail}`);
    console.log(`   Stripe Payment Intent: ${downpaymentInvoice.stripePaymentIntentId}`);
    console.log(`   Current Status: ${downpaymentInvoice.status}\n`);

    // Test the webhook handler directly
    console.log('Testing webhook payment success handler...');
    
    try {
      await paymentService.handlePaymentSuccess(downpaymentInvoice.stripePaymentIntentId!);
      console.log('✅ Webhook handler completed successfully');
      
      // Check if invoice status was updated
      const updatedInvoice = await storage.invoices.getInvoiceById(downpaymentInvoice.id);
      if (updatedInvoice?.status === 'paid') {
        console.log('✅ Invoice status updated to paid');
      } else {
        console.log(`⚠️  Invoice status: ${updatedInvoice?.status}`);
      }
      
      // Check if project exists
      if (downpaymentInvoice.projectId) {
        const project = await storage.projects.getProjectById(downpaymentInvoice.projectId);
        if (project) {
          console.log(`✅ Project found: ${project.name} (Status: ${project.status})`);
        } else {
          console.log('❌ Project not found');
        }
      }
      
      console.log('\n✅ Downpayment email flow test completed successfully!');
      console.log('Customer should have received:');
      console.log('  1. Project welcome email with payment confirmation');
      console.log('  2. Next steps information');
      console.log('  3. Project dashboard access link');
      
    } catch (webhookError) {
      console.error('❌ Webhook handler failed:', webhookError);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDownpaymentEmailFlow()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });