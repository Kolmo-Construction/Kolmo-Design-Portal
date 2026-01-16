// Direct test of Agent Service
import { agentService } from './server/services/agent.service';

async function testAgentLeads() {
  console.log('\n=== Testing AI Agent Sales Lead System (Direct) ===\n');

  // Test 1: Check if agent is initialized
  console.log('1. Checking Agent Initialization...');
  const isInitialized = agentService.isInitialized();
  const initError = agentService.getInitError();

  if (!isInitialized) {
    console.error('❌ Agent not initialized:', initError);
    return;
  }
  console.log('✅ Agent is initialized\n');

  // Test 2: Get agent tools
  console.log('2. Getting Registered Tools...');
  try {
    const tools = agentService.getRegisteredTools();
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.description.substring(0, 80)}...`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Error getting tools:', error);
  }

  // Test 3: Query about leads (should route to leads agent)
  console.log('3. Testing Leads Agent - Query about finding leads...');
  try {
    const result = await agentService.consult({
      userPrompt: 'What leads do we have in the database? Show me recent leads.',
      sessionId: 'test-session-' + Date.now(),
      userId: 1,
    });

    console.log('✅ Leads query successful!');
    console.log('Response:', result.answer.substring(0, 200) + '...');

    if (result.actions && result.actions.length > 0) {
      console.log('\nSuggested Actions:');
      result.actions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action.action} - ${action.reasoning}`);
      });
    }
    console.log('');
  } catch (error: any) {
    console.error('❌ Leads query failed:', error.message);
  }

  // Test 4: Ask about searching for new leads
  console.log('4. Testing Leads Agent - Ask about searching for leads...');
  try {
    const result = await agentService.consult({
      userPrompt: 'I want to find leads for kitchen remodeling projects in Seattle area. Can you help me search for them?',
      sessionId: 'test-session-' + Date.now(),
      userId: 1,
    });

    console.log('✅ Search query successful!');
    console.log('Response:', result.answer.substring(0, 300) + '...');
    console.log('');
  } catch (error: any) {
    console.error('❌ Search query failed:', error.message);
  }

  // Test 5: Test saving a lead
  console.log('5. Testing Leads Agent - Save a new lead...');
  try {
    const result = await agentService.consult({
      userPrompt: 'Save a new lead: Jane Doe, contact info: jane.doe@example.com, interested in bathroom remodel in Bellevue, found on Reddit',
      sessionId: 'test-session-' + Date.now(),
      userId: 1,
    });

    console.log('✅ Save lead query successful!');
    console.log('Response:', result.answer);

    if (result.actions && result.actions.length > 0) {
      console.log('\nSuggested Actions:');
      result.actions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action.action}`);
        console.log(`      Payload:`, JSON.stringify(action.payload, null, 2));
      });
    }
    console.log('');
  } catch (error: any) {
    console.error('❌ Save lead failed:', error.message);
  }

  // Test 6: Test project query (should route to project agent)
  console.log('6. Testing Project Agent - Query about projects...');
  try {
    const result = await agentService.consult({
      userPrompt: 'Show me all active projects',
      projectId: 1,
      sessionId: 'test-session-' + Date.now(),
      userId: 1,
    });

    console.log('✅ Project query successful!');
    console.log('Response:', result.answer.substring(0, 200) + '...');
    console.log('');
  } catch (error: any) {
    console.error('❌ Project query failed:', error.message);
  }

  console.log('\n=== Test Complete ===\n');
}

// Run the test
testAgentLeads().catch(console.error);
