async function testQuoteEmail() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // First, login to get a valid session
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
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    // Extract session cookie
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('No session cookie received');
    }

    const sessionCookie = setCookieHeader.split(';')[0];
    console.log('Login successful, session cookie obtained');

    // Now try to send the quote email
    console.log('Attempting to send quote email for quote ID 4...');
    const sendResponse = await fetch(`${baseUrl}/api/quotes/4/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      }
    });

    const responseText = await sendResponse.text();
    
    if (sendResponse.ok) {
      console.log('✓ Quote email sent successfully!');
      console.log('Response:', responseText);
    } else {
      console.log(`✗ Failed to send quote email: ${sendResponse.status} ${sendResponse.statusText}`);
      console.log('Response:', responseText);
    }

    return sendResponse.ok;

  } catch (error) {
    console.error('Error testing quote email:', error.message);
    return false;
  }
}

testQuoteEmail().then(success => {
  if (success) {
    console.log('\n✅ Email test completed successfully!');
  } else {
    console.log('\n❌ Email test failed - check server logs for details');
  }
  process.exit(success ? 0 : 1);
});