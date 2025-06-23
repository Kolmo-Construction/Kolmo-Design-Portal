/**
 * Test script to identify issues with sending customer quotes via email
 */

import { QuoteRepository } from "./server/storage/repositories/quote.repository";
import { sendEmail } from "./server/email";

async function testQuoteEmailSending() {
  console.log('=== Testing Quote Email Sending ===');
  
  try {
    const quoteRepository = new QuoteRepository();
    
    // Get all quotes to see what's available
    console.log('Fetching all quotes...');
    const quotes = await quoteRepository.getAllQuotes();
    console.log(`Found ${quotes.length} quotes in database`);
    
    if (quotes.length === 0) {
      console.log('No quotes found in database. Creating a test quote...');
      
      // Create a test quote for testing
      const testQuote = await quoteRepository.createQuote({
        title: 'Test Quote for Email',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        lineItems: JSON.stringify([
          {
            description: 'Test Service',
            quantity: 1,
            unitPrice: '100.00',
            total: '100.00'
          }
        ]),
        total: '100.00',
        status: 'draft',
        notes: 'Test quote for email functionality'
      });
      
      console.log('Created test quote:', testQuote);
      return testQuote.id;
    }
    
    // Use the first quote for testing
    const testQuote = quotes[0];
    console.log('Testing with quote:', {
      id: testQuote.id,
      quoteNumber: testQuote.quoteNumber,
      customerName: testQuote.customerName,
      customerEmail: testQuote.customerEmail,
      title: testQuote.title,
      total: testQuote.total,
      status: testQuote.status
    });
    
    // Check if quote has required customer information
    if (!testQuote.customerEmail || !testQuote.customerName) {
      console.error('Quote missing required customer information:');
      console.error('- Customer Email:', testQuote.customerEmail || 'MISSING');
      console.error('- Customer Name:', testQuote.customerName || 'MISSING');
      
      if (!testQuote.customerEmail) {
        console.log('Updating quote with test email...');
        await quoteRepository.updateQuote(testQuote.id, {
          customerEmail: 'test@example.com'
        });
      }
      
      if (!testQuote.customerName) {
        console.log('Updating quote with test name...');
        await quoteRepository.updateQuote(testQuote.id, {
          customerName: 'Test Customer'
        });
      }
      
      // Refetch the updated quote
      const updatedQuote = await quoteRepository.getQuoteById(testQuote.id);
      console.log('Updated quote:', updatedQuote);
    }
    
    // Test the email sending functionality directly
    console.log('\n--- Testing Email Service ---');
    
    const testEmailResult = await sendEmail({
      to: testQuote.customerEmail || 'test@example.com',
      subject: `Test Quote Email - ${testQuote.quoteNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Test Quote Email</h2>
          <p>Hello ${testQuote.customerName || 'Test Customer'},</p>
          <p>This is a test email for quote ${testQuote.quoteNumber}.</p>
          <p>Quote Title: ${testQuote.title}</p>
          <p>Total: $${testQuote.total}</p>
        </div>
      `,
      text: `Test Quote Email\n\nHello ${testQuote.customerName || 'Test Customer'},\n\nThis is a test email for quote ${testQuote.quoteNumber}.\nQuote Title: ${testQuote.title}\nTotal: $${testQuote.total}`,
      from: 'projects@kolmo.io',
      fromName: 'Kolmo Construction'
    });
    
    console.log('Email sending result:', testEmailResult);
    
    // Test the actual quote sending API endpoint
    console.log('\n--- Testing Quote Send API ---');
    
    const response = await fetch('http://localhost:5000/api/quotes/' + testQuote.id + '/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real test, you'd need proper authentication
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Quote send API response:', result);
      console.log('✓ Quote send API working correctly');
    } else {
      const errorText = await response.text();
      console.error('✗ Quote send API failed:', response.status, response.statusText);
      console.error('Error response:', errorText);
    }
    
    return testQuote.id;
    
  } catch (error) {
    console.error('Error testing quote email sending:', error);
    throw error;
  }
}

// Run the test
testQuoteEmailSending()
  .then((quoteId) => {
    console.log(`\n=== Test Complete ===`);
    console.log(`Tested with quote ID: ${quoteId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });