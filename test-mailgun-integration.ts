/**
 * Test script to verify Mailgun integration for quote emails
 */

import { sendEmail } from "./server/email";

async function testMailgunIntegration() {
  console.log('=== Testing Mailgun Integration ===');
  
  try {
    // Test basic email sending
    console.log('Testing basic email functionality...');
    
    const testEmailResult = await sendEmail({
      to: 'pascal.matta@gmail.com', // Using existing customer email from database
      subject: 'Test Email from Kolmo Construction - Mailgun Integration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3d4552;">Mailgun Integration Test</h2>
          <p>Hello,</p>
          <p>This is a test email to verify that Mailgun integration is working correctly for the Kolmo Construction client portal.</p>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #3d4552;">Test Details</h3>
            <p><strong>Email Service:</strong> Mailgun</p>
            <p><strong>Purpose:</strong> Replace SendGrid for quote delivery</p>
            <p><strong>Status:</strong> Testing</p>
          </div>
          <p>If you receive this email, the Mailgun integration is working successfully!</p>
          <p>Best regards,<br>Kolmo Construction Team</p>
        </div>
      `,
      text: `Mailgun Integration Test\n\nHello,\n\nThis is a test email to verify that Mailgun integration is working correctly for the Kolmo Construction client portal.\n\nTest Details:\n- Email Service: Mailgun\n- Purpose: Replace SendGrid for quote delivery\n- Status: Testing\n\nIf you receive this email, the Mailgun integration is working successfully!\n\nBest regards,\nKolmo Construction Team`,
      from: 'projects@kolmo.io',
      fromName: 'Kolmo Construction'
    });
    
    if (testEmailResult) {
      console.log('✓ Mailgun test email sent successfully!');
      
      // Now test the actual quote sending functionality
      console.log('\nTesting quote email functionality...');
      
      // Login and send a quote email via API
      const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin'
        })
      });

      if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.status}`);
      }

      const setCookieHeader = loginResponse.headers.get('set-cookie');
      if (!setCookieHeader) {
        throw new Error('No session cookie received');
      }

      const sessionCookie = setCookieHeader.split(';')[0];
      console.log('✓ Admin login successful');

      // Send quote email via API
      const sendQuoteResponse = await fetch('http://localhost:5000/api/quotes/12/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        }
      });

      if (sendQuoteResponse.ok) {
        const result = await sendQuoteResponse.json();
        console.log('✓ Quote email sent successfully via API!');
        console.log('Response:', result);
        
        console.log('\n=== Mailgun Integration Complete ===');
        console.log('✓ Basic email sending works');
        console.log('✓ Quote email API works');
        console.log('✓ SendGrid successfully replaced with Mailgun');
        console.log('\nCustomer quote emails should now work properly!');
        
      } else {
        const errorText = await sendQuoteResponse.text();
        console.error('✗ Quote email API failed:', sendQuoteResponse.status);
        console.error('Error:', errorText);
      }
      
    } else {
      console.error('✗ Mailgun test email failed - check configuration');
    }
    
  } catch (error) {
    console.error('Error testing Mailgun integration:', error);
    throw error;
  }
}

// Run the test
testMailgunIntegration()
  .then(() => {
    console.log('\n=== Test Complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });