import fetch from 'node-fetch';

async function testQuoteSendAPI() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // Login first
    console.log('Logging in...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
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

    // Extract cookies from login
    const setCookieHeaders = loginResponse.headers.raw()['set-cookie'];
    if (!setCookieHeaders) {
      throw new Error('No cookies received from login');
    }
    
    // Parse the session cookie
    const sessionCookie = setCookieHeaders.find(cookie => cookie.startsWith('connect.sid='));
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }
    
    const cookieValue = sessionCookie.split(';')[0];
    console.log('Login successful, got session cookie');

    // Try to send quote #4
    console.log('Sending quote #4...');
    const sendResponse = await fetch(`${baseUrl}/api/quotes/4/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieValue
      }
    });

    const responseText = await sendResponse.text();
    console.log('Response status:', sendResponse.status);
    console.log('Response body:', responseText);

    if (sendResponse.ok) {
      console.log('✅ Quote sent successfully!');
      return true;
    } else {
      console.log('❌ Failed to send quote');
      return false;
    }

  } catch (error) {
    console.error('Error testing quote send:', error.message);
    return false;
  }
}

testQuoteSendAPI().then(success => {
  console.log(success ? '\n✅ Test completed!' : '\n❌ Test failed');
  process.exit(success ? 0 : 1);
});