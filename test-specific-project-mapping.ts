/**
 * Test specific project tag mapping for SamarArny_2025-06-18
 * This demonstrates how expenses are matched to your specific project
 */
import { zohoExpenseService } from './server/services/zoho-expense.service';
import { storage } from './server/storage';

async function testSpecificProjectMapping() {
  console.log('🎯 Testing Project Tag: "SamarArny_2025-06-18"');
  console.log('=' .repeat(60));

  const targetTag = 'SamarArny_2025-06-18';
  
  // Find the project in your database
  const projects = await storage.projects.getAllProjects();
  const matchingProject = projects.find(p => 
    p.customerName === 'Samar Arny' && 
    new Date(p.createdAt).toISOString().split('T')[0] === '2025-06-18'
  );

  if (!matchingProject) {
    console.log('❌ No matching project found in database');
    return;
  }

  console.log('\n📋 Project Information:');
  console.log(`   Project ID: ${matchingProject.id}`);
  console.log(`   Project Name: ${matchingProject.name}`);
  console.log(`   Customer: ${matchingProject.customerName}`);
  console.log(`   Created: ${new Date(matchingProject.createdAt).toLocaleDateString()}`);
  console.log(`   Zoho Tag: "${targetTag}"`);

  console.log('\n🔍 How Zoho Expense Matching Works:');
  console.log('-'.repeat(40));
  console.log('1. When team members add expenses in Zoho:');
  console.log(`   → They select project: "${targetTag}"`);
  console.log('   → Zoho stores expense with project_name field');
  console.log('');
  console.log('2. System fetches expenses from Zoho API:');
  console.log('   → Calls GET /expenses endpoint');
  console.log('   → Filters expenses where project_name matches tag');
  console.log('');
  console.log('3. Expense matching logic:');
  console.log(`   expense.project_name === "${targetTag}"`);
  console.log(`   → Links to Project ID: ${matchingProject.id}`);

  console.log('\n📊 Testing Connection (if authorized):');
  console.log('-'.repeat(40));
  
  try {
    const connectionTest = await zohoExpenseService.testConnection();
    console.log(`   Connection Status: ${connectionTest.connected ? 'CONNECTED' : 'NOT AUTHORIZED'}`);
    console.log(`   Message: ${connectionTest.message}`);
    
    if (connectionTest.connected) {
      console.log('\n💰 Fetching Expenses for this Project:');
      try {
        const projectExpenses = await zohoExpenseService.getProjectExpenses(matchingProject.id);
        console.log(`   Found ${projectExpenses.length} expenses for "${targetTag}"`);
        
        if (projectExpenses.length > 0) {
          console.log('\n   📝 Expense Details:');
          projectExpenses.forEach((expense, index) => {
            console.log(`   ${index + 1}. $${expense.amount.toFixed(2)} - ${expense.description}`);
            console.log(`      Category: ${expense.category} | Status: ${expense.status}`);
            console.log(`      Date: ${expense.date} | Merchant: ${expense.merchant}`);
            if (expense.projectTag) {
              console.log(`      Zoho Tag: "${expense.projectTag}"`);
            }
            console.log('');
          });
          
          const totalExpenses = projectExpenses.reduce((sum, exp) => sum + exp.amount, 0);
          console.log(`   💵 Total Expenses: $${totalExpenses.toFixed(2)}`);
          
          // Show budget comparison if available
          const projectBudget = parseFloat(matchingProject.totalAmount?.toString() || '0');
          if (projectBudget > 0) {
            const budgetUsed = (totalExpenses / projectBudget) * 100;
            console.log(`   📊 Budget Used: ${budgetUsed.toFixed(1)}% of $${projectBudget.toFixed(2)}`);
          }
        } else {
          console.log('\n   📝 No expenses found with matching tag');
          console.log('   This means either:');
          console.log('   • No expenses have been added to this project in Zoho yet');
          console.log('   • Expenses were added with different project tags');
          console.log(`   • Team should select "${targetTag}" when adding expenses`);
        }
      } catch (error) {
        console.log(`   ❌ Error fetching expenses: ${error}`);
      }
    } else {
      console.log('\n   ⚠️  To test expense matching, complete OAuth authorization first');
    }
  } catch (error) {
    console.log(`   ❌ Connection test failed: ${error}`);
  }

  console.log('\n\n📋 Instructions for Team Members:');
  console.log('-'.repeat(40));
  console.log('To add expenses for this project in Zoho Expense:');
  console.log('');
  console.log('1. Log into Zoho Expense');
  console.log('2. Click "Add Expense" or upload receipt');
  console.log('3. Fill in expense details (amount, category, etc.)');
  console.log(`4. In the "Project" field, select: "${targetTag}"`);
  console.log('5. Save the expense');
  console.log('');
  console.log('The expense will then appear in budget tracking for this project!');

  console.log('\n\n🔧 API Endpoints for Testing:');
  console.log('-'.repeat(40));
  console.log(`GET /api/zoho-expense/expenses/${matchingProject.id}`);
  console.log('GET /api/zoho-expense/budget-tracking');
  console.log('GET /api/zoho-expense/config');
}

testSpecificProjectMapping().catch(console.error);