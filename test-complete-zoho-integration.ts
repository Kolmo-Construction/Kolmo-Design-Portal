/**
 * Comprehensive test of Zoho Expense integration
 * This will test all major functionality including auth, data fetching, and project sync
 */
import { zohoExpenseService } from './server/services/zoho-expense.service';
import { storage } from './server/storage';

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: string;
}

class ZohoIntegrationTester {
  private results: TestResult[] = [];
  private baseUrl = 'http://localhost:5000';

  async runAllTests(): Promise<void> {
    console.log('🔍 Starting Comprehensive Zoho Integration Test Suite');
    console.log('=' .repeat(60));

    const startTime = Date.now();

    // Test 1: Environment Configuration
    await this.testEnvironmentConfiguration();

    // Test 2: Service Configuration
    await this.testServiceConfiguration();

    // Test 3: Authorization Status
    await this.testAuthorizationStatus();

    // Test 4: API Connection
    await this.testAPIConnection();

    // Test 5: Organization Access
    await this.testOrganizationAccess();

    // Test 6: Project Creation
    await this.testProjectCreation();

    // Test 7: Expense Data Fetching
    await this.testExpenseDataFetching();

    // Test 8: Budget Tracking
    await this.testBudgetTracking();

    // Test 9: Frontend Integration
    await this.testFrontendIntegration();

    // Test 10: Error Handling
    await this.testErrorHandling();

    const totalTime = Date.now() - startTime;
    this.printResults(totalTime);
  }

  private async testEnvironmentConfiguration(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      const requiredEnvVars = [
        'ZOHO_CLIENT_ID',
        'ZOHO_CLIENT_SECRET',
        'ZOHO_REDIRECT_URI'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        passed = false;
        details = `Missing environment variables: ${missingVars.join(', ')}`;
      } else {
        const clientId = process.env.ZOHO_CLIENT_ID!;
        const clientSecret = process.env.ZOHO_CLIENT_SECRET!;
        const redirectUri = process.env.ZOHO_REDIRECT_URI!;

        details = `✅ All required environment variables present\n`;
        details += `   Client ID: ${clientId.substring(0, 10)}... (${clientId.length} chars)\n`;
        details += `   Client Secret: ${clientSecret.substring(0, 10)}... (${clientSecret.length} chars)\n`;
        details += `   Redirect URI: ${redirectUri}`;
      }
    } catch (error) {
      passed = false;
      details = `Error checking environment: ${error}`;
    }

    this.results.push({
      testName: 'Environment Configuration',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testServiceConfiguration(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      const isConfigured = zohoExpenseService.isConfigured();
      
      if (isConfigured) {
        details = '✅ ZohoExpenseService is properly configured';
      } else {
        passed = false;
        details = '❌ ZohoExpenseService configuration failed';
      }
    } catch (error) {
      passed = false;
      details = `Error testing service configuration: ${error}`;
    }

    this.results.push({
      testName: 'Service Configuration',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testAuthorizationStatus(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test authorization URL generation
      const authUrl = zohoExpenseService.getAuthorizationUrl();
      
      if (authUrl && authUrl.includes('accounts.zoho.com')) {
        details = `✅ Authorization URL generated successfully\n`;
        details += `   URL: ${authUrl.substring(0, 80)}...`;
      } else {
        passed = false;
        details = '❌ Invalid authorization URL generated';
      }
    } catch (error) {
      passed = false;
      details = `Error testing authorization: ${error}`;
    }

    this.results.push({
      testName: 'Authorization Status',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testAPIConnection(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      const connectionTest = await zohoExpenseService.testConnection();
      
      if (connectionTest.connected) {
        passed = true;
        details = `✅ API connection successful\n   Message: ${connectionTest.message}`;
      } else {
        // This might be expected if not authorized yet
        passed = false;
        details = `⚠️ API connection failed (may need authorization)\n   Message: ${connectionTest.message}`;
      }
    } catch (error) {
      passed = false;
      details = `Error testing API connection: ${error}`;
    }

    this.results.push({
      testName: 'API Connection',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testOrganizationAccess(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test organization access via API endpoint
      const response = await fetch(`${this.baseUrl}/api/zoho-expense/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const configData = await response.json();
      
      if (response.ok) {
        passed = configData.connected;
        details = `Configuration Status: ${configData.configured ? 'Configured' : 'Not Configured'}\n`;
        details += `Connection Status: ${configData.connected ? 'Connected' : 'Disconnected'}\n`;
        details += `Message: ${configData.message}`;
      } else {
        passed = false;
        details = `API request failed: ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      passed = false;
      details = `Error testing organization access: ${error}`;
    }

    this.results.push({
      testName: 'Organization Access',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testProjectCreation(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Get a sample project from database
      const projects = await storage.projects.getAllProjects();
      
      if (projects.length === 0) {
        passed = false;
        details = 'No projects found in database to test with';
        this.results.push({
          testName: 'Project Creation',
          passed,
          duration: Date.now() - startTime,
          details
        });
        return;
      }

      const testProject = projects[0];
      
      // Test project creation/sync
      const result = await zohoExpenseService.createProject(
        testProject.id,
        testProject.name,
        testProject.customerName,
        new Date(testProject.createdAt)
      );

      if (result.success) {
        passed = true;
        details = `✅ Project creation successful\n   Project Tag: ${result.tag}`;
      } else {
        passed = false;
        details = '❌ Project creation failed';
      }
    } catch (error) {
      passed = false;
      details = `Error testing project creation: ${error}`;
    }

    this.results.push({
      testName: 'Project Creation',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testExpenseDataFetching(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test expense data fetching via API
      const response = await fetch(`${this.baseUrl}/api/zoho-expense/budget-tracking`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const budgetData = await response.json();
        passed = true;
        details = `✅ Expense data fetched successfully\n`;
        details += `   Projects with budget data: ${budgetData.length || 0}`;
        
        if (budgetData.length > 0) {
          const firstProject = budgetData[0];
          details += `\n   Sample project: ${firstProject.projectName}`;
          details += `\n   Total expenses: $${firstProject.totalExpenses || 0}`;
        }
      } else {
        const errorData = await response.json();
        passed = false;
        details = `❌ Expense data fetch failed: ${errorData.message || 'Unknown error'}`;
      }
    } catch (error) {
      passed = false;
      details = `Error testing expense data fetching: ${error}`;
    }

    this.results.push({
      testName: 'Expense Data Fetching',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testBudgetTracking(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test budget tracking calculation
      const projects = await storage.projects.getAllProjects();
      
      if (projects.length === 0) {
        passed = false;
        details = 'No projects available for budget tracking test';
        this.results.push({
          testName: 'Budget Tracking',
          passed,
          duration: Date.now() - startTime,
          details
        });
        return;
      }

      const testProject = projects[0];
      const projectExpenses = await zohoExpenseService.getProjectExpenses(testProject.id);
      
      passed = true;
      details = `✅ Budget tracking data retrieved\n`;
      details += `   Test project: ${testProject.name}\n`;
      details += `   Project ID: ${testProject.id}\n`;
      details += `   Expenses found: ${projectExpenses.length}`;
      
      if (projectExpenses.length > 0) {
        const totalAmount = projectExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        details += `\n   Total expense amount: $${totalAmount.toFixed(2)}`;
      }
    } catch (error) {
      // This might be expected if not authorized
      passed = false;
      details = `Budget tracking test failed (may need authorization): ${error}`;
    }

    this.results.push({
      testName: 'Budget Tracking',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testFrontendIntegration(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test API endpoints that frontend uses
      const endpoints = [
        '/api/zoho-expense/auth/url',
        '/api/zoho-expense/config'
      ];

      let successCount = 0;
      let endpointDetails = '';

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`);
          if (response.ok) {
            successCount++;
            endpointDetails += `   ✅ ${endpoint} - OK\n`;
          } else {
            endpointDetails += `   ❌ ${endpoint} - ${response.status}\n`;
          }
        } catch (error) {
          endpointDetails += `   ❌ ${endpoint} - Error: ${error}\n`;
        }
      }

      passed = successCount === endpoints.length;
      details = `Frontend API endpoints test:\n${endpointDetails}`;
      details += `Success rate: ${successCount}/${endpoints.length}`;
    } catch (error) {
      passed = false;
      details = `Error testing frontend integration: ${error}`;
    }

    this.results.push({
      testName: 'Frontend Integration',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private async testErrorHandling(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test error handling with invalid requests
      const response = await fetch(`${this.baseUrl}/api/zoho-expense/expenses/invalid-project`, {
        method: 'GET',
      });

      // Should return proper error response
      if (response.status === 404 || response.status === 400) {
        passed = true;
        details = `✅ Error handling working correctly\n   Status: ${response.status}`;
      } else {
        passed = false;
        details = `❌ Unexpected response to invalid request: ${response.status}`;
      }
    } catch (error) {
      passed = false;
      details = `Error testing error handling: ${error}`;
    }

    this.results.push({
      testName: 'Error Handling',
      passed,
      duration: Date.now() - startTime,
      details
    });
  }

  private printResults(totalTime: number): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ZOHO INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));

    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log(`\n🎯 Overall Results: ${passedTests}/${totalTests} tests passed (${successRate}%)`);
    console.log(`⏱️ Total execution time: ${totalTime}ms`);

    console.log('\n📋 Detailed Results:');
    console.log('-'.repeat(60));

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      
      console.log(`\n${index + 1}. ${result.testName} ${status} (${duration})`);
      console.log(`   ${result.details.split('\n').join('\n   ')}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('🔍 RECOMMENDATIONS:');
    console.log('='.repeat(60));

    const failedTests = this.results.filter(r => !r.passed);
    
    if (failedTests.length === 0) {
      console.log('🎉 All tests passed! Zoho integration is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Review the following:');
      
      failedTests.forEach(test => {
        console.log(`\n• ${test.testName}:`);
        if (test.details.includes('No tokens available')) {
          console.log('  → Complete OAuth authorization by visiting the auth URL');
        } else if (test.details.includes('environment')) {
          console.log('  → Verify all required environment variables are set');
        } else if (test.details.includes('API')) {
          console.log('  → Check API credentials and network connectivity');
        } else {
          console.log(`  → ${test.details.split('\n')[0]}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run the comprehensive test
async function runCompleteZohoTest() {
  const tester = new ZohoIntegrationTester();
  await tester.runAllTests();
}

runCompleteZohoTest().catch(console.error);