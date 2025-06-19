/**
 * Test script to verify Zoho Expense integration setup
 */
import { zohoExpenseService } from './server/services/zoho-expense.service';

async function testZohoIntegration() {
  console.log('=== Testing Zoho Expense Integration ===\n');

  // Test 1: Check configuration
  console.log('1. Checking Zoho configuration...');
  const isConfigured = zohoExpenseService.isConfigured();
  console.log(`   Configuration status: ${isConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  
  if (!isConfigured) {
    console.log('   ❌ Zoho credentials not found in environment variables');
    console.log('   Please ensure ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET are set');
    return;
  }

  // Test 2: Check credential format (without exposing actual values)
  console.log('\n2. Checking credential format...');
  const clientId = process.env.ZOHO_CLIENT_ID || '';
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
  const orgId = process.env.ZOHO_ORGANIZATION_ID || '';
  const redirectUri = process.env.ZOHO_REDIRECT_URI || '';
  
  console.log(`   Client ID length: ${clientId.length} chars`);
  console.log(`   Client ID starts with: ${clientId.substring(0, 10)}...`);
  console.log(`   Client Secret length: ${clientSecret.length} chars`);
  console.log(`   Organization ID: ${orgId || 'Not set (will auto-detect)'}`);
  console.log(`   Redirect URI: ${redirectUri}`);

  // Test 3: Generate authorization URL
  console.log('\n3. Testing authorization URL generation...');
  try {
    const authUrl = zohoExpenseService.getAuthorizationUrl();
    console.log(`   ✅ Authorization URL generated successfully`);
    console.log(`   URL starts with: ${authUrl.substring(0, 50)}...`);
    console.log(`   Full URL: ${authUrl}`);
  } catch (error) {
    console.log(`   ❌ Failed to generate authorization URL: ${error}`);
    return;
  }

  // Test 4: Test connection without tokens (expected to fail)
  console.log('\n4. Testing connection without authorization...');
  try {
    const connectionTest = await zohoExpenseService.testConnection();
    console.log(`   Connection status: ${connectionTest.connected ? 'SUCCESS' : 'EXPECTED FAILURE'}`);
    console.log(`   Message: ${connectionTest.message}`);
  } catch (error) {
    console.log(`   ❌ Connection test error: ${error}`);
  }

  // Test 5: Display next steps
  console.log('\n5. Next Steps:');
  console.log('   • Visit the authorization URL above to connect your Zoho account');
  console.log('   • After authorization, the system will have access tokens');
  console.log('   • Then you can fetch expense data and sync project budgets');
  console.log('   • Use the Financial page in the admin dashboard to complete setup');

  console.log('\n=== Zoho Integration Test Complete ===');
}

// Run the test
testZohoIntegration().catch(console.error);