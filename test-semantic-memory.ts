/**
 * Test script for semantic memory system
 * Tests: fact extraction, embedding generation, and semantic search
 */

// IMPORTANT: Load environment variables FIRST before any imports
import { config } from 'dotenv';
config({ path: '.env.local' });

// Verify Voyage key is loaded
console.log('VOYAGE_API_KEY loaded:', process.env.VOYAGE_API_KEY ? 'Yes' : 'No');
console.log('DEEPSEEK_API_KEY loaded:', process.env.DEEPSEEK_API_KEY ? 'Yes' : 'No');

async function runTests() {
  // Use dynamic imports to ensure env vars are loaded first
  const { agentService } = await import('./server/services/agent.service');
  const { factExtractionService } = await import('./server/services/fact-extraction.service');
  const { semanticSearchService } = await import('./server/services/semantic-search.service');
  const { embeddingService } = await import('./server/services/embedding.service');
  console.log('='.repeat(60));
  console.log('SEMANTIC MEMORY SYSTEM TEST');
  console.log('='.repeat(60));

  // Test 1: Check service initialization
  console.log('\n[Test 1] Service Initialization');
  console.log('-----------------------------------');
  console.log('Agent Service:', agentService.isInitialized() ? '✅ Ready' : '❌ Not ready');
  console.log('Embedding Service:', embeddingService.isInitialized() ? '✅ Ready' : '❌ Not ready');
  console.log('Embedding Model:', embeddingService.getModelInfo().model);

  // Test 2: Generate embeddings
  console.log('\n[Test 2] Embedding Generation');
  console.log('-----------------------------------');
  const testText = "Concrete quote for 50 cubic yards at $150 per cy";
  const embedding = await embeddingService.generateEmbedding(testText);

  if (embedding) {
    console.log(`✅ Generated ${embedding.length}-dimensional embedding`);
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
  } else {
    console.log('❌ Failed to generate embedding');
  }

  // Test 3: Manual fact extraction
  console.log('\n[Test 3] Fact Extraction');
  console.log('-----------------------------------');
  const userMsg = "I need a quote for 50 cubic yards of concrete";
  const agentMsg = "Based on current market rates, 50 cubic yards of concrete at $150/cy would be approximately $7,500. I can create a task to get formal quotes from vendors.";

  const factsExtracted = await factExtractionService.extractFacts(
    userMsg,
    agentMsg,
    {
      sessionId: 'test-session-001',
      projectId: 1,
      userId: 1,
      sourceMessageId: 'test-msg-001',
    }
  );

  console.log(`✅ Extracted ${factsExtracted} facts`);

  // Give embeddings time to generate
  console.log('   Waiting for embeddings to generate...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: Semantic search
  console.log('\n[Test 4] Semantic Search');
  console.log('-----------------------------------');
  const searchQuery = "concrete pricing information";
  const searchResults = await semanticSearchService.search(
    searchQuery,
    {
      sessionId: 'test-session-001',
      activeOnly: true,
    },
    5
  );

  console.log(`✅ Found ${searchResults.length} relevant facts for: "${searchQuery}"`);
  searchResults.forEach((result, index) => {
    console.log(`\n   ${index + 1}. [${result.fact.factType}] ${result.fact.factSummary}`);
    console.log(`      Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    console.log(`      Confidence: ${(parseFloat(result.fact.confidenceScore?.toString() || '0') * 100).toFixed(0)}%`);
    if (result.fact.financialAmount) {
      console.log(`      Amount: $${parseFloat(result.fact.financialAmount.toString()).toLocaleString()}`);
    }
  });

  // Test 5: Agent consultation with context
  console.log('\n[Test 5] Agent with Semantic Context');
  console.log('-----------------------------------');

  if (agentService.isInitialized()) {
    try {
      const response = await agentService.consult({
        userPrompt: "What was that concrete pricing we discussed?",
        projectId: 1,
        userId: 1,
        sessionId: 'test-session-001',
      });

      console.log('✅ Agent Response:');
      console.log(`   ${response.answer.substring(0, 200)}...`);
      console.log(`\n   Facts extracted: Will be processed in background`);
    } catch (error) {
      console.log('❌ Agent consultation failed:', error);
    }
  } else {
    console.log('⚠️  Agent not initialized - skipping test');
  }

  // Test 6: Financial facts
  console.log('\n[Test 6] High-Value Financial Facts');
  console.log('-----------------------------------');
  const financialFacts = await semanticSearchService.getUnverifiedFinancialFacts(1, 5000, 5);
  console.log(`✅ Found ${financialFacts.length} unverified financial facts over $5,000`);

  financialFacts.forEach((fact, index) => {
    console.log(`\n   ${index + 1}. ${fact.factSummary}`);
    console.log(`      Amount: $${parseFloat(fact.financialAmount?.toString() || '0').toLocaleString()}`);
    console.log(`      Status: ${fact.verificationStatus}`);
  });

  // Test 7: Regenerate embeddings (for facts without embeddings)
  console.log('\n[Test 7] Embedding Backfill');
  console.log('-----------------------------------');
  const backfilled = await factExtractionService.regenerateEmbeddings(10);
  console.log(`✅ Backfilled ${backfilled} facts with embeddings`);

  console.log('\n' + '='.repeat(60));
  console.log('ALL TESTS COMPLETE');
  console.log('='.repeat(60));

  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ TEST SUITE FAILED:', error);
  process.exit(1);
});
