/**
 * Explain Zoho Project-Expense Mapping System
 * This script demonstrates how expenses are linked to projects
 */
import { storage } from './server/storage';
import { zohoExpenseService } from './server/services/zoho-expense.service';

async function explainProjectMapping() {
  console.log('🎯 Zoho Project-Expense Mapping System');
  console.log('=' .repeat(50));

  // Get sample projects from database
  const projects = await storage.projects.getAllProjects();
  
  if (projects.length === 0) {
    console.log('No projects found in database.');
    return;
  }

  console.log('\n📋 How Project Tags Work:');
  console.log('-'.repeat(30));
  
  projects.slice(0, 3).forEach((project, index) => {
    const projectTag = generateProjectTag(project.customerName, new Date(project.createdAt));
    console.log(`\n${index + 1}. Project: ${project.name}`);
    console.log(`   Customer: ${project.customerName}`);
    console.log(`   Created: ${new Date(project.createdAt).toLocaleDateString()}`);
    console.log(`   Zoho Tag: "${projectTag}"`);
    console.log(`   → Expenses in Zoho with project_name="${projectTag}" map to this project`);
  });

  console.log('\n\n🔍 Tag Format Explanation:');
  console.log('-'.repeat(30));
  console.log('Tag Format: {CustomerName}_{YYYY-MM-DD}');
  console.log('Examples:');
  console.log('• Customer "John Smith" + created 2025-06-15 → Tag: "JohnSmith_2025-06-15"');
  console.log('• Customer "ABC Corp Inc." + created 2025-03-10 → Tag: "ABCCorpInc_2025-03-10"');
  console.log('• Customer "Mary & Bob Johnson" + created 2025-01-20 → Tag: "MaryBobJohnson_2025-01-20"');

  console.log('\n\n📊 Expense Mapping Process:');
  console.log('-'.repeat(30));
  console.log('1. When a project is created, system generates a unique tag');
  console.log('2. Tag is created in Zoho Expense as a "project"');
  console.log('3. Team members assign expenses to the Zoho project');
  console.log('4. System fetches expenses and matches by project tag');
  console.log('5. Budget tracking shows expenses per project');

  console.log('\n\n💡 For Team Members Using Zoho:');
  console.log('-'.repeat(30));
  console.log('When adding expenses in Zoho Expense:');
  console.log('1. Select the correct project from the dropdown');
  console.log('2. Project names will appear as customer tags (e.g., "JohnSmith_2025-06-15")');
  console.log('3. This ensures expenses are properly attributed to the right construction project');

  console.log('\n\n🔧 Technical Details:');
  console.log('-'.repeat(30));
  console.log('• Project ID mapping: Zoho project_name → Internal project ID');
  console.log('• Expense filtering: Only expenses with matching project tags are included');
  console.log('• Budget calculation: Total project budget vs. sum of tagged expenses');
  console.log('• Status mapping: Zoho expense statuses → pending/approved/reimbursed');

  // Show actual project-tag examples
  if (projects.length > 0) {
    console.log('\n\n📝 Current Project Tags in Your System:');
    console.log('-'.repeat(30));
    
    for (let i = 0; i < Math.min(5, projects.length); i++) {
      const project = projects[i];
      const tag = generateProjectTag(project.customerName, new Date(project.createdAt));
      console.log(`${i + 1}. "${tag}" → Project "${project.name}" (ID: ${project.id})`);
    }
  }
}

// Helper function to generate project tags (same as in service)
function generateProjectTag(ownerName: string, creationDate: Date): string {
  const dateStr = creationDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  const cleanOwnerName = ownerName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, ''); // Remove spaces and special chars
  return `${cleanOwnerName}_${dateStr}`;
}

// Run the explanation
explainProjectMapping().catch(console.error);