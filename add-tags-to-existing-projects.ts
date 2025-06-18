/**
 * Script to add Expensify tags to all existing projects
 */
import { storage } from './server/storage/index';
import { expensifyService } from './server/services/expensify.service';

async function addTagsToExistingProjects() {
  console.log('Adding Expensify tags to existing projects...\n');
  
  try {
    // Get all existing projects
    const projects = await storage.projects.getAllProjects();
    console.log(`Found ${projects.length} existing projects`);
    
    if (projects.length === 0) {
      console.log('No projects to process');
      return;
    }
    
    // Check if Expensify is configured
    if (!expensifyService.isConfigured()) {
      console.log('❌ Expensify not configured - cannot create tags');
      return;
    }
    
    console.log('\nProcessing projects:');
    
    for (const project of projects) {
      try {
        // Skip if no customer name
        if (!project.customerName) {
          console.log(`⚠️  Project ${project.id}: "${project.name}" - No customer name, skipping`);
          continue;
        }
        
        // Create Expensify tag using project owner and creation date
        const result = await expensifyService.createProject(
          project.id,
          project.name,
          project.customerName,
          project.createdAt
        );
        
        if (result.success) {
          console.log(`✅ Project ${project.id}: "${project.name}"`);
          console.log(`   Owner: ${project.customerName}`);
          console.log(`   Created: ${project.createdAt.toISOString().split('T')[0]}`);
          console.log(`   Expensify Tag: ${result.tag}`);
        } else {
          console.log(`❌ Project ${project.id}: Failed to create tag`);
        }
        
      } catch (error) {
        console.log(`❌ Project ${project.id}: Error creating tag - ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('✅ Finished processing all existing projects');
    console.log('\nNext steps:');
    console.log('1. Team members can now use the generated tags when submitting expenses');
    console.log('2. Expenses will automatically appear in budget tracking dashboard');
    console.log('3. Real-time budget monitoring is now active for all projects');
    
  } catch (error) {
    console.error('❌ Error processing projects:', error);
  }
}

addTagsToExistingProjects().catch(console.error);