/**
 * Debug script to test different Expensify API request formats
 */
import * as fs from 'fs';
import * as path from 'path';

async function debugExpensifyRequestFormat() {
  console.log('=== Expensify Request Format Test ===\n');
  
  const partnerUserID = process.env.EXPENSIFY_PARTNER_USER_ID || '';
  const partnerUserSecret = process.env.EXPENSIFY_PARTNER_USER_SECRET || '';
  const baseURL = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';
  
  console.log('Credentials preview:');
  console.log(`  Partner ID: ${partnerUserID.substring(0, 10)}...`);
  console.log(`  Secret: ${partnerUserSecret.substring(0, 10)}...\n`);
  
  // Test 1: Simple authentication test with minimal payload
  console.log('1. Testing minimal authentication payload...');
  
  const simpleJobDescription = {
    type: 'file',
    credentials: {
      partnerUserID: partnerUserID,
      partnerUserSecret: partnerUserSecret
    },
    onReceive: {
      immediateResponse: ['returnRandomFileName']
    },
    inputSettings: {
      type: 'combinedReportData',
      filters: {
        reportState: 'APPROVED',
        startDate: '2025-01-01',
        endDate: '2025-06-18'
      }
    },
    outputSettings: {
      fileExtension: 'json'
    }
  };
  
  const simpleParams = new URLSearchParams();
  simpleParams.append('requestJobDescription', JSON.stringify(simpleJobDescription));
  
  try {
    const response = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: simpleParams.toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);
    
    if (responseText.includes('Authentication error')) {
      console.log('   ❌ Authentication still failing with minimal payload');
    } else {
      console.log('   ✅ Authentication working with minimal payload');
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error);
  }
  
  // Test 2: Check if template is causing issues
  console.log('\n2. Testing without template...');
  
  try {
    const response = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: simpleParams.toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);
  } catch (error) {
    console.log('   ❌ Request failed:', error);
  }
  
  // Test 3: Test different credential formats
  console.log('\n3. Testing credential validation...');
  
  if (!partnerUserID || !partnerUserSecret) {
    console.log('   ❌ Credentials missing from environment');
  } else if (partnerUserID.length < 10 || partnerUserSecret.length < 10) {
    console.log('   ⚠️  Credentials seem too short');
  } else {
    console.log('   ✅ Credentials appear to be properly formatted');
  }
  
  // Test 4: Try alternative API endpoint or method
  console.log('\n4. Testing alternative request structure...');
  
  const alternativePayload = {
    requestJobDescription: JSON.stringify({
      type: 'file',
      credentials: {
        partnerUserID,
        partnerUserSecret
      },
      onReceive: {
        immediateResponse: ['returnRandomFileName']
      },
      inputSettings: {
        type: 'combinedReportData'
      },
      outputSettings: {
        fileExtension: 'json'
      }
    })
  };
  
  try {
    const response = await fetch(baseURL, {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: Object.entries(alternativePayload).map(([key, value]) => 
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      ).join('&')
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);
  } catch (error) {
    console.log('   ❌ Alternative request failed:', error);
  }
  
  console.log('\n=== Debug Complete ===');
}

// Run the debug
debugExpensifyRequestFormat().catch(console.error);