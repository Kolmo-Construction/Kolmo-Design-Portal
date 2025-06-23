/**
 * Test Mailgun with authorized recipient (the customer email already in database)
 */

import { sendEmail } from "./server/email";

async function testWithAuthorizedRecipient() {
  console.log('=== Testing Mailgun with Authorized Recipient ===');
  
  try {
    // Test with the customer email that's already in the database (pascal.matta@gmail.com)
    // This email should be added to Mailgun's authorized recipients for free accounts
    console.log('Testing with authorized recipient email...');
    
    const testEmailResult = await sendEmail({
      to: 'pascal.matta@gmail.com', // This should be added to authorized recipients
      subject: 'Quote Email Test - Kolmo Construction',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3d4552;">Quote Ready for Review</h2>
          <p>Hello Samar,</p>
          <p>Your quote from Kolmo Construction is ready for review.</p>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #3d4552;">Quote Details</h3>
            <p><strong>Quote Number:</strong> KOL-2025-973394</p>
            <p><strong>Project:</strong> Residential Painting & Minor Repairs</p>
            <p><strong>Total:</strong> $9,799.16</p>
          </div>
          <p>This is a test of the Mailgun email integration.</p>
          <p>Best regards,<br>Kolmo Construction Team</p>
        </div>
      `,
      text: `Quote Ready for Review\n\nHello Samar,\n\nYour quote from Kolmo Construction is ready for review.\n\nQuote Details:\n- Quote Number: KOL-2025-973394\n- Project: Residential Painting & Minor Repairs\n- Total: $9,799.16\n\nThis is a test of the Mailgun email integration.\n\nBest regards,\nKolmo Construction Team`,
      from: 'projects@kolmo.io',
      fromName: 'Kolmo Construction'
    });
    
    if (testEmailResult) {
      console.log('✓ Email sent successfully to authorized recipient!');
      
      // Test the quote API endpoint
      console.log('\nTesting quote send API...');
      
      const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' })
      });

      if (loginResponse.ok) {
        const sessionCookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
        
        const sendQuoteResponse = await fetch('http://localhost:5000/api/quotes/12/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie!
          }
        });

        if (sendQuoteResponse.ok) {
          const result = await sendQuoteResponse.json();
          console.log('✓ Quote API email sent successfully!');
          console.log('Response:', result);
        } else {
          const errorText = await sendQuoteResponse.text();
          console.log('Quote API response:', sendQuoteResponse.status, errorText);
        }
      }
      
    } else {
      console.log('✗ Email failed - check authorized recipients in Mailgun');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testWithAuthorizedRecipient();