/**
 * Debug script to test the complete quote-to-payment flow
 */

import { storage } from './server/storage';
import { paymentService } from './server/services/payment.service';

async function debugQuoteToPaymentFlow() {
  console.log('Testing complete quote-to-payment flow...\n');

  try {
    // 1. Find an existing quote to test with
    console.log('1. Finding existing quotes...');
    const quotes = await storage.quotes.getAllQuotes();
    console.log(`Found ${quotes.length} quotes in system`);
    
    if (quotes.length === 0) {
      console.log('❌ No quotes found to test with');
      return;
    }

    // Get the most recent quote
    const testQuote = quotes[quotes.length - 1];
    console.log(`\nTesting with quote: ${testQuote.quoteNumber}`);
    console.log(`   Title: ${testQuote.title}`);
    console.log(`   Customer: ${testQuote.customerName} (${testQuote.customerEmail})`);
    console.log(`   Total: $${testQuote.total}`);
    console.log(`   Status: ${testQuote.status}`);

    // 2. Check if this quote has already been accepted
    const existingProjects = await storage.projects.getAllProjects();
    const relatedProject = existingProjects.find(p => p.originQuoteId === testQuote.id);
    
    if (relatedProject) {
      console.log(`\n2. Quote already has associated project: ${relatedProject.name}`);
      console.log(`   Project Status: ${relatedProject.status}`);
      
      // Check for existing invoices
      const projectInvoices = await storage.invoices.getInvoicesForProject(relatedProject.id);
      console.log(`   Associated invoices: ${projectInvoices.length}`);
      
      for (const invoice of projectInvoices) {
        console.log(`   - ${invoice.invoiceNumber}: $${invoice.amount} (${invoice.status}) - ${invoice.invoiceType}`);
      }
      
      if (projectInvoices.length > 0) {
        console.log('\n   Testing with existing project and invoices...');
        const downpaymentInvoice = projectInvoices.find(inv => inv.invoiceType === 'down_payment');
        
        if (downpaymentInvoice) {
          console.log(`   Found downpayment invoice: ${downpaymentInvoice.invoiceNumber}`);
          console.log(`   Status: ${downpaymentInvoice.status}`);
          console.log(`   Stripe Payment Intent: ${downpaymentInvoice.stripePaymentIntentId}`);
          
          // Test payment link generation
          if (downpaymentInvoice.stripePaymentIntentId) {
            console.log(`   Payment link should be: ${process.env.BASE_URL || 'http://localhost:5000'}/payment/${downpaymentInvoice.stripePaymentIntentId.split('_secret_')[1]}`);
          }
        } else {
          console.log('   ❌ No downpayment invoice found for existing project');
        }
      }
      
      return;
    }

    // 3. Test quote acceptance process
    console.log(`\n2. Testing quote acceptance process...`);
    
    const customerInfo = {
      name: testQuote.customerName || 'Test Customer',
      email: testQuote.customerEmail || 'test@example.com',
      phone: testQuote.customerPhone || '555-0123',
      address: testQuote.customerAddress || '123 Test St',
      city: testQuote.customerCity || 'Test City',
      state: testQuote.customerState || 'CA',
      zipCode: testQuote.customerZipCode || '90210'
    };

    console.log('   Customer info:', customerInfo);

    // Test the quote acceptance service
    try {
      console.log('   Calling paymentService.processQuoteAcceptance...');
      const result = await paymentService.processQuoteAcceptance(testQuote.id, customerInfo);
      
      console.log('   ✅ Quote acceptance processed successfully!');
      console.log(`   Created project: ${result.project.name} (ID: ${result.project.id})`);
      console.log(`   Created invoice: ${result.downPaymentInvoice.invoiceNumber}`);
      console.log(`   Payment intent: ${result.paymentIntent.id}`);
      console.log(`   Client secret: ${result.paymentIntent.client_secret}`);
      
      // Construct payment URL
      const clientSecret = result.paymentIntent.client_secret;
      const paymentUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/payment/${clientSecret}`;
      console.log(`   Payment URL: ${paymentUrl}`);
      
      // 4. Test payment flow components
      console.log(`\n3. Testing payment components...`);
      
      // Check if invoice was created properly
      const createdInvoice = await storage.invoices.getInvoiceById(result.downPaymentInvoice.id);
      if (createdInvoice) {
        console.log('   ✅ Invoice created and retrievable');
        console.log(`   Amount: $${createdInvoice.amount}`);
        console.log(`   Type: ${createdInvoice.invoiceType}`);
        console.log(`   Status: ${createdInvoice.status}`);
        console.log(`   Stripe Payment Intent ID: ${createdInvoice.stripePaymentIntentId}`);
      } else {
        console.log('   ❌ Invoice not found after creation');
      }
      
      // Check if project was created properly
      const createdProject = await storage.projects.getProjectById(result.project.id);
      if (createdProject) {
        console.log('   ✅ Project created and retrievable');
        console.log(`   Name: ${createdProject.name}`);
        console.log(`   Status: ${createdProject.status}`);
        console.log(`   Customer: ${createdProject.customerName}`);
      } else {
        console.log('   ❌ Project not found after creation');
      }
      
    } catch (acceptanceError) {
      console.error('   ❌ Quote acceptance failed:', acceptanceError.message);
      console.error('   Full error:', acceptanceError);
    }

  } catch (error) {
    console.error('Debug script error:', error);
  }
}

debugQuoteToPaymentFlow().catch(console.error);