import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware';
import { agentService } from '../services/agent.service';

const router = Router();

/**
 * Agent consultation endpoint
 * Accepts a user prompt and returns AI-generated insights with suggested actions
 */
router.post('/consult', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { userPrompt, projectId, context, messageId } = req.body;

    // Validate required fields
    if (!userPrompt || typeof userPrompt !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid userPrompt field',
        success: false
      });
    }

    // Log the request for debugging
    console.log('[Agent API] Consultation request:', {
      userPrompt: userPrompt.substring(0, 100) + '...',
      projectId,
      hasContext: !!context,
      messageId: messageId || 'none'
    });

    // Call the agent service
    const result = await agentService.consult({
      userPrompt,
      projectId: projectId ? Number(projectId) : undefined,
      context: context || {},
      messageId: messageId
    });

    // Return structured response
    res.json({
      success: true,
      answer: result.answer,
      actions: result.actions || [],
      rawOutput: result.rawOutput
    });

  } catch (error) {
    console.error('[Agent API] Consultation error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      return res.status(500).json({
        error: 'Agent consultation failed',
        message: error.message,
        success: false
      });
    }

    res.status(500).json({
      error: 'Unknown error during agent consultation',
      success: false
    });
  }
});

/**
 * Get database schema information (for debugging/admin use)
 */
router.get('/schema', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const schema = await agentService.getSchema();
    res.json({
      success: true,
      schema
    });
  } catch (error) {
    console.error('[Agent API] Schema fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch database schema',
      success: false
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if agent service is initialized
    const isInitialized = agentService.isInitialized();
    const initError = agentService.getInitError();

    if (!isInitialized) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: initError || 'Agent service not initialized',
        message: 'Please configure DEEPSEEK_API_KEY or OPENAI_API_KEY environment variable'
      });
    }

    res.json({
      success: true,
      status: 'healthy',
      message: 'Agent service is operational'
    });
  } catch (error) {
    console.error('[Agent API] Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get agent workflow visualization and debug information
 * Returns:
 * - Mermaid diagram of the workflow graph
 * - List of available tools
 * - Database schema
 *
 * Useful for debugging and understanding the agent's capabilities
 */
router.get('/graph', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Check if agent service is initialized
    if (!agentService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Agent service not initialized',
        message: agentService.getInitError() || 'Please configure API keys'
      });
    }

    console.log('[Agent API] Graph visualization requested');

    // Fetch all three components in parallel
    const [mermaidDiagram, tools, schema] = await Promise.all([
      agentService.getGraphDiagram(),
      Promise.resolve(agentService.getRegisteredTools()),
      agentService.getSchema()
    ]);

    // Format as plain text for easy viewing and copying
    const textOutput = `
# Kolmo AI Agent - Workflow Visualization & Debug Info
Generated: ${new Date().toISOString()}

## 1. WORKFLOW GRAPH (Mermaid)
${'```'}mermaid
${mermaidDiagram}
${'```'}

## 2. AVAILABLE TOOLS (${tools.length} total)
${tools.map((tool, index) => `
### ${index + 1}. ${tool.name}
**Description:** ${tool.description}
**Parameters:** ${JSON.stringify(tool.parameters, null, 2)}
`).join('\n')}

## 3. DATABASE SCHEMA
${schema}

---
End of Agent Debug Information
`.trim();

    // Return as plain text with proper content type
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(textOutput);

  } catch (error) {
    console.error('[Agent API] Graph visualization error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to generate agent visualization',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
