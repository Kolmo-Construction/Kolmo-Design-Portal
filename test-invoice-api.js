// Test invoice API endpoints directly
async function testInvoiceAPI() {
  console.log('Testing invoice API endpoints...');
  
  try {
    // Test view endpoint
    const viewResponse = await fetch('/api/projects/33/invoices/52/view', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('View response status:', viewResponse.status);
    console.log('View response headers:', [...viewResponse.headers.entries()]);
    
    if (viewResponse.ok) {
      const viewData = await viewResponse.json();
      console.log('View data:', viewData);
    } else {
      const viewError = await viewResponse.text();
      console.log('View error:', viewError);
    }
    
    // Test download endpoint
    const downloadResponse = await fetch('/api/projects/33/invoices/52/download', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Download response status:', downloadResponse.status);
    console.log('Download response headers:', [...downloadResponse.headers.entries()]);
    
    if (!downloadResponse.ok) {
      const downloadError = await downloadResponse.text();
      console.log('Download error:', downloadError);
    }
    
  } catch (error) {
    console.error('API test error:', error);
  }
}

// Run the test
testInvoiceAPI();