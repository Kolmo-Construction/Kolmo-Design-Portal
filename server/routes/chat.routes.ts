import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware';
import { 
  generateStreamToken, 
  createStreamUser, 
  initializeQuoteChat,
  addUserToQuoteChannel 
} from '../stream-chat';
import { db } from '../db';
import { quotes } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Generate Stream Chat token for authenticated user
 */
router.get('/token', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = `admin-${user.id}`;
    
    // Create/update Stream user
    await createStreamUser({
      id: userId,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: 'admin',
    });
    
    // Generate token
    const token = generateStreamToken(userId);
    
    res.json({ 
      token,
      userId,
      apiKey: process.env.STREAM_API_KEY 
    });
  } catch (error) {
    console.error('Error generating Stream token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

/**
 * Generate Stream Chat token for customer (public route)
 */
router.post('/customer-token', async (req: Request, res: Response) => {
  try {
    const { quoteToken, customerName, customerEmail } = req.body;
    
    if (!quoteToken || !customerName || !customerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify quote exists and get quote ID
    const [quote] = await db
      .select({ id: quotes.id, quoteNumber: quotes.quoteNumber })
      .from(quotes)
      .where(eq(quotes.accessToken, quoteToken))
      .limit(1);
      
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const customerId = `customer-${quote.id}`;
    
    // Create/update Stream user
    await createStreamUser({
      id: customerId,
      name: customerName,
      email: customerEmail,
      role: 'user', // Use 'user' instead of 'customer' as it's a default role
    });
    
    // Generate token
    const token = generateStreamToken(customerId);
    
    // Ensure customer is added to quote channel
    try {
      await addUserToQuoteChannel(quote.id.toString(), customerId);
    } catch (error) {
      // Channel might not exist yet, that's ok
      console.log('Channel not found, will be created when needed');
    }
    
    res.json({ 
      token,
      userId: customerId,
      channelId: `quote-${quote.id}`,
      apiKey: process.env.STREAM_API_KEY 
    });
  } catch (error) {
    console.error('Error generating customer Stream token:', error);
    res.status(500).json({ error: 'Failed to generate chat token' });
  }
});

/**
 * Initialize chat for a quote (called when quote is sent)
 */
router.post('/initialize-quote-chat/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const quoteId = req.params.id;
    const { customerName, customerEmail } = req.body;
    const user = req.user as any;
    const adminUserId = `admin-${user.id}`;
    
    if (!customerName || !customerEmail) {
      return res.status(400).json({ error: 'Customer name and email required' });
    }
    
    // Get quote details
    const [quote] = await db
      .select({ quoteNumber: quotes.quoteNumber })
      .from(quotes)
      .where(eq(quotes.id, parseInt(quoteId)))
      .limit(1);
      
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    const result = await initializeQuoteChat(
      quoteId,
      quote.quoteNumber,
      customerName,
      customerEmail,
      adminUserId
    );
    
    res.json({
      message: 'Quote chat initialized successfully',
      ...result
    });
  } catch (error) {
    console.error('Error initializing quote chat:', error);
    res.status(500).json({ error: 'Failed to initialize quote chat' });
  }
});

export default router;