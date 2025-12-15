import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware';
import { storage } from '../storage';
import { emailParserService } from '../services/email-parser.service';

const router = Router();

/**
 * Get all leads with optional filtering
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { status, source, limit } = req.query;

    let leads;
    if (status) {
      leads = await storage.leads.getLeadsByStatus(status as string);
    } else if (source) {
      leads = await storage.leads.getLeadsBySource(source as string);
    } else {
      leads = await storage.leads.getRecentLeads(parseInt(limit as string) || 50);
    }

    res.json({ success: true, leads });
  } catch (error: any) {
    console.error('[Leads API] Error fetching leads:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single lead by ID
 */
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const lead = await storage.leads.getLeadById(parseInt(req.params.id));

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create new lead manually
 */
router.post('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const lead = await storage.leads.createLead(req.body);
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Update lead
 */
router.patch('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const lead = await storage.leads.updateLead(parseInt(req.params.id), req.body);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark lead as contacted
 */
router.post('/:id/contacted', isAuthenticated, async (req: Request, res: Response) => {
  try {
    await storage.leads.markAsContacted(parseInt(req.params.id));
    res.json({ success: true, message: 'Lead marked as contacted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Convert lead to quote
 */
router.post('/:id/convert', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.body;

    if (!quoteId) {
      return res.status(400).json({ error: 'quoteId is required' });
    }

    await storage.leads.markAsConverted(parseInt(req.params.id), quoteId);
    res.json({ success: true, message: 'Lead converted to quote' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Parse email and create lead
 * POST /api/leads/parse-email
 * Body: { from, subject, body }
 */
router.post('/parse-email', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { from, subject, body } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Email body is required' });
    }

    // Parse the email
    const parsedLead = emailParserService.parseEmail({
      from: from || '',
      subject: subject || '',
      body,
      receivedAt: new Date()
    });

    if (!parsedLead) {
      return res.status(400).json({
        error: 'Could not parse email. Email source not recognized.',
        suggestion: 'Make sure the email is from Thumbtack, Home Depot, or Nextdoor'
      });
    }

    // Create lead in database
    const lead = await storage.leads.createLead({
      name: parsedLead.name,
      contactInfo: parsedLead.contactInfo,
      source: parsedLead.source,
      sourceUrl: parsedLead.sourceUrl,
      contentSnippet: parsedLead.contentSnippet,
      location: parsedLead.location,
      confidenceScore: parsedLead.confidenceScore,
      interestTags: parsedLead.interestTags,
      status: 'new'
    });

    res.json({
      success: true,
      message: `Lead created successfully from ${parsedLead.source}`,
      lead
    });
  } catch (error: any) {
    console.error('[Leads API] Error parsing email:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
