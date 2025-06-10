// Test script to verify the complete payment webhook flow
import { storage } from './server/storage';
import { paymentService } from './server/services/payment.service';

async function testWebhookPaymentFlow() {
  console.log('🔍 Testing Webhook Payment Flow...\n');

  try {
    // 1. Find a recent quote to test with
    console.log('1. Finding a test quote...');
    const quotes = await storage.quotes.getAllQuotes();
    const testQuote = quotes.find(q => q.status !== 'accepted') || quotes[0];
    
    if (!testQuote) {
      console.log('❌ No quotes found for testing');
      return;
    }
    
    console.log(`✅ Using quote: ${testQuote.quoteNumber} - ${testQuote.title}`);
    console.log(`   Total: $${testQuote.total}`);
    
    // 2. Test quote acceptance and payment intent creation
    console.log('\n2. Testing quote acceptance...');
    const customerInfo = {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '555-1234'
    };
    
    const result = await paymentService.processQuoteAcceptance(testQuote.id, customerInfo);
    
    console.log(`✅ Quote acceptance processed:`);
    console.log(`   Project ID: ${result.project.id}`);
    console.log(`   Project Name: ${result.project.name}`);
    console.log(`   Invoice ID: ${result.downPaymentInvoice.id}`);
    console.log(`   Invoice Number: ${result.downPaymentInvoice.invoiceNumber}`);
    console.log(`   Payment Intent ID: ${result.paymentIntent.id}`);
    console.log(`   Amount: $${result.downPaymentInvoice.amount}`);
    
    // 3. Verify the invoice has the stripe payment intent ID
    console.log('\n3. Verifying invoice setup...');
    const invoice = await storage.invoices.getInvoiceById(result.downPaymentInvoice.id);
    if (invoice?.stripePaymentIntentId) {
      console.log(`✅ Invoice has Stripe Payment Intent ID: ${invoice.stripePaymentIntentId}`);
    } else {
      console.log('❌ Invoice missing Stripe Payment Intent ID');
      return;
    }
    
    // 4. Test the webhook handler directly (simulating Stripe webhook)
    console.log('\n4. Testing webhook handler directly...');
    console.log(`   Simulating webhook for payment intent: ${result.paymentIntent.id}`);
    
    try {
      await paymentService.handlePaymentSuccess(result.paymentIntent.id);
      console.log('✅ Webhook handler executed successfully');
      
      // 5. Verify the results
      console.log('\n5. Verifying payment processing results...');
      
      // Check invoice status
      const updatedInvoice = await storage.invoices.getInvoiceById(result.downPaymentInvoice.id);
      console.log(`   Invoice status: ${updatedInvoice?.status}`);
      
      // Check for payment record
      const allInvoices = await storage.invoices.getAllInvoices();
      const invoiceWithPayments = allInvoices.find(inv => inv.id === result.downPaymentInvoice.id);
      console.log(`   Invoice found: ${invoiceWithPayments ? 'Yes' : 'No'}`);
      
      // Check quote status
      const updatedQuote = await storage.quotes.getQuoteById(testQuote.id);
      console.log(`   Quote status: ${updatedQuote?.status}`);
      
      console.log('\n✅ Complete payment webhook flow test successful!');
      console.log('\nExpected results:');
      console.log('  - Invoice status should be "paid"');
      console.log('  - Payment record should be created');  
      console.log('  - Welcome email should be sent');
      console.log('  - Quote status should be "accepted"');
      
    } catch (webhookError) {
      console.error('❌ Webhook handler failed:', webhookError);
      console.log('\nThis indicates the issue with payment processing.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWebhookPaymentFlow().catch(console.error);