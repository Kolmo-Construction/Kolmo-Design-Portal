import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware';
import { 
  generateStreamToken, 
  createStreamUser, 
  initializeQuoteChat,
  addUserToQuoteChannel,
  connectionMonitor
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
    
    // Create/update Stream user (no role specified for customers)
    await createStreamUser({
      id: customerId,
      name: customerName,
      email: customerEmail,
      role: 'customer', // This will be omitted by createStreamUser for non-admin users
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

/**
 * Get Stream Chat connection statistics
 */
router.get('/connections/stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const stats = connectionMonitor.getConnectionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting connection stats:', error);
    res.status(500).json({ error: 'Failed to get connection stats' });
  }
});

/**
 * Set maximum concurrent connections limit
 */
router.post('/connections/limit', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { maxConnections } = req.body;
    if (typeof maxConnections !== 'number' || maxConnections < 1) {
      return res.status(400).json({ error: 'Invalid max connections value' });
    }
    
    connectionMonitor.setMaxConnections(maxConnections);
    res.json({ success: true, maxConnections });
  } catch (error) {
    console.error('Error setting connection limit:', error);
    res.status(500).json({ error: 'Failed to set connection limit' });
  }
});

/**
 * Manually cleanup stale connections
 */
router.post('/connections/cleanup', isAuthenticated, async (req: Request, res: Response) => {
  try {
    connectionMonitor.cleanupStaleConnections();
    const stats = connectionMonitor.getConnectionStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error cleaning up connections:', error);
    res.status(500).json({ error: 'Failed to cleanup connections' });
  }
});

/**
 * Get Stream Chat app usage statistics
 */
router.get('/usage', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { StreamChat } = await import('stream-chat');
    const client = StreamChat.getInstance(process.env.STREAM_API_KEY!, process.env.STREAM_API_SECRET!);
    
    // Query channels to get active usage
    const channels = await client.queryChannels({});
    const stats = connectionMonitor.getConnectionStats();
    
    res.json({
      totalChannels: channels.length,
      activeConnections: stats.current,
      maxConnections: stats.max,
      utilizationPercent: stats.utilizationPercent,
      nearLimit: connectionMonitor.isNearLimit(),
      channels: channels.map(ch => ({
        id: ch.id,
        type: ch.type,
        memberCount: Object.keys(ch.state.members).length,
        lastActivity: ch.state.last_message_at
      }))
    });
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

/**
 * Get all active conversations for admin dashboard
 */
router.get('/conversations', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { StreamChat } = await import('stream-chat');
    const client = StreamChat.getInstance(process.env.STREAM_API_KEY!, process.env.STREAM_API_SECRET!);
    const user = req.user as any;
    const adminUserId = `admin-${user.id}`;
    
    // Query channels where the admin is a member
    const channels = await client.queryChannels({
      members: { $in: [adminUserId] },
      type: 'messaging'
    }, { last_message_at: -1 }, { limit: 50 });
    
    // Get quote information for each channel
    const conversations = await Promise.all(
      channels.map(async (channel) => {
        const quoteIdStr = channel.id?.replace('quote-', '');
        let quoteInfo = null;
        
        if (quoteIdStr) {
          const quoteId = parseInt(quoteIdStr);
          
          // Only proceed if we have a valid numeric quote ID
          if (!isNaN(quoteId) && quoteId > 0) {
            try {
              const [quote] = await db
                .select({ 
                  id: quotes.id, 
                  quoteNumber: quotes.quoteNumber, 
                  title: quotes.title,
                  customerName: quotes.customerName,
                  customerEmail: quotes.customerEmail
              })
              .from(quotes)
              .where(eq(quotes.id, quoteId))
              .limit(1);
            
              quoteInfo = quote;
            } catch (error) {
              console.error('Error fetching quote info:', error);
            }
          }
        }
        
        // Get unread count for admin user (simplified approach)
        const unreadCount = 0; // Stream Chat unread count requires more complex setup
        
        return {
          channelId: channel.id,
          quoteId: quoteIdStr && !isNaN(parseInt(quoteIdStr)) ? parseInt(quoteIdStr) : null,
          quoteInfo,
          lastMessage: channel.state.last_message_at ? {
            text: channel.state.messages[channel.state.messages.length - 1]?.text || '',
            createdAt: new Date(channel.state.last_message_at).toISOString(),
            user: channel.state.messages[channel.state.messages.length - 1]?.user
          } : null,
          unreadCount,
          memberCount: Object.keys(channel.state.members).length,
          isActive: channel.state.last_message_at ? 
            (new Date().getTime() - new Date(channel.state.last_message_at).getTime()) < 7 * 24 * 60 * 60 * 1000 : false
        };
      })
    );
    
    // Filter out conversations without quote info and sort by last activity
    const validConversations = conversations
      .filter(conv => conv.quoteInfo)
      .sort((a, b) => {
        if (!a.lastMessage?.createdAt) return 1;
        if (!b.lastMessage?.createdAt) return -1;
        return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
      });
    
    res.json(validConversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

export default router;