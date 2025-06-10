// Test script to verify that new invoices are created with 'draft' status
import { storage } from './server/storage';

async function testDraftInvoiceCreation() {
  console.log('Testing draft invoice creation...\n');

  try {
    // Get a project to test with
    const projects = await storage.projects.getAllProjects();
    const testProject = projects[0];
    
    if (!testProject) {
      console.log('❌ No projects found to test with');
      return;
    }

    console.log(`✅ Using test project: ${testProject.name} (ID: ${testProject.id})`);

    // Create a test invoice
    const testInvoiceData = {
      projectId: testProject.id,
      quoteId: testProject.originQuoteId,
      invoiceNumber: `TEST-${Date.now()}`,
      amount: '1000.00',
      description: 'Test invoice for draft status verification',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      invoiceType: 'regular' as const,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
    };

    console.log('🔄 Creating test invoice...');
    const createdInvoice = await storage.invoices.createInvoice(testInvoiceData);

    if (!createdInvoice) {
      console.log('❌ Failed to create test invoice');
      return;
    }

    console.log(`✅ Invoice created successfully: ${createdInvoice.invoiceNumber}`);
    console.log(`📊 Invoice status: ${createdInvoice.status}`);
    
    if (createdInvoice.status === 'draft') {
      console.log('🎉 SUCCESS: Invoice was created with draft status!');
      console.log('   The Send Invoice button will now appear for this invoice.');
    } else {
      console.log('❌ ISSUE: Invoice was created with status:', createdInvoice.status);
      console.log('   Expected: draft');
    }

    // Clean up test invoice
    console.log('\n🧹 Cleaning up test invoice...');
    const deleted = await storage.invoices.deleteInvoice(createdInvoice.id);
    if (deleted) {
      console.log('✅ Test invoice cleaned up successfully');
    } else {
      console.log('⚠️ Could not clean up test invoice - please delete manually');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDraftInvoiceCreation();