/**
 * Complete Zoho Integration Test - End to End Flow
 * This test covers the complete authorization and data flow
 */
import { zohoExpenseService } from './server/services/zoho-expense.service';
import { storage } from './server/storage';

async function testCompleteZohoFlow() {
  console.log('🔍 Testing Complete Zoho Integration Flow');
  console.log('=' .repeat(50));

  try {
    // Step 1: Check configuration
    console.log('\n1. Checking Zoho Configuration');
    const isConfigured = zohoExpenseService.isConfigured();
    console.log(`   Configuration: ${isConfigured ? 'OK' : 'FAILED'}`);
    
    if (!isConfigured) {
      console.log('   ❌ Missing required environment variables:');
      console.log('   - ZOHO_CLIENT_ID');
      console.log('   - ZOHO_CLIENT_SECRET');
      console.log('   - ZOHO_REDIRECT_URI');
      return;
    }

    // Step 2: Test authorization URL generation
    console.log('\n2. Testing Authorization URL Generation');
    try {
      const authUrl = zohoExpenseService.getAuthorizationUrl();
      console.log('   ✅ Authorization URL generated successfully');
      console.log(`   URL: ${authUrl}`);
      console.log('\n   📝 To complete authorization:');
      console.log('   1. Visit the URL above');
      console.log('   2. Authorize the application');
      console.log('   3. System will automatically store tokens');
    } catch (error) {
      console.log(`   ❌ Failed to generate auth URL: ${error}`);
      return;
    }

    // Step 3: Test connection (will show if authorized)
    console.log('\n3. Testing API Connection');
    try {
      const connectionTest = await zohoExpenseService.testConnection();
      console.log(`   Status: ${connectionTest.connected ? 'CONNECTED' : 'NOT AUTHORIZED'}`);
      console.log(`   Message: ${connectionTest.message}`);
      
      if (!connectionTest.connected) {
        console.log('\n   ⚠️  Authorization required to continue testing');
        console.log('   Please complete OAuth flow using the URL above');
        return;
      }
    } catch (error) {
      console.log(`   ❌ Connection test failed: ${error}`);
      return;
    }

    // Step 4: Test project data
    console.log('\n4. Testing Project Data Access');
    try {
      const projects = await storage.projects.getAllProjects();
      console.log(`   Found ${projects.length} projects in database`);
      
      if (projects.length === 0) {
        console.log('   ⚠️  No projects found for testing');
        return;
      }

      const testProject = projects[0];
      console.log(`   Test project: ${testProject.name} (ID: ${testProject.id})`);
      
      // Step 5: Test project creation in Zoho
      console.log('\n5. Testing Zoho Project Creation');
      try {
        const createResult = await zohoExpenseService.createProject(
          testProject.id,
          testProject.name,
          testProject.customerName,
          new Date(testProject.createdAt)
        );
        
        console.log(`   ✅ Project created/synced successfully`);
        console.log(`   Project tag: ${createResult.tag}`);
      } catch (error) {
        console.log(`   ❌ Project creation failed: ${error}`);
      }

      // Step 6: Test expense data fetching
      console.log('\n6. Testing Expense Data Fetching');
      try {
        const expenses = await zohoExpenseService.getProjectExpenses(testProject.id);
        console.log(`   ✅ Retrieved ${expenses.length} expenses for project`);
        
        if (expenses.length > 0) {
          const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
          console.log(`   Total expense amount: $${totalAmount.toFixed(2)}`);
          
          console.log('\n   Sample expenses:');
          expenses.slice(0, 3).forEach((expense, index) => {
            console.log(`   ${index + 1}. ${expense.description} - $${expense.amount} (${expense.status})`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Expense fetching failed: ${error}`);
      }

      // Step 7: Test budget tracking
      console.log('\n7. Testing Budget Tracking');
      try {
        const budgetData = await zohoExpenseService.getBudgetTrackingForProject(testProject.id);
        console.log(`   ✅ Budget tracking data retrieved`);
        console.log(`   Project: ${budgetData.projectName}`);
        console.log(`   Total Budget: $${budgetData.totalBudget}`);
        console.log(`   Total Expenses: $${budgetData.totalExpenses}`);
        console.log(`   Remaining Budget: $${budgetData.remainingBudget}`);
        console.log(`   Budget Utilization: ${budgetData.budgetUtilization.toFixed(1)}%`);
      } catch (error) {
        console.log(`   ❌ Budget tracking failed: ${error}`);
      }

    } catch (error) {
      console.log(`   ❌ Project data access failed: ${error}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Zoho Integration Test Complete');
    console.log('='.repeat(50));

  } catch (error) {
    console.log(`\n❌ Test failed with error: ${error}`);
  }
}

// Helper function to test API endpoints
async function testAPIEndpoints() {
  console.log('\n🔌 Testing API Endpoints');
  console.log('-'.repeat(30));

  const endpoints = [
    { path: '/api/zoho-expense/config', method: 'GET' },
    { path: '/api/zoho-expense/auth/url', method: 'GET' },
    { path: '/api/zoho-expense/budget-tracking', method: 'GET' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:5000${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`   ${endpoint.path}: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`   ${endpoint.path}: ERROR - ${error}`);
    }
  }
}

// Run the complete test
async function runCompleteTest() {
  await testCompleteZohoFlow();
  await testAPIEndpoints();
}

runCompleteTest().catch(console.error);