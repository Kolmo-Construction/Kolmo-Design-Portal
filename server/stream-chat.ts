import { StreamChat } from 'stream-chat';

// Initialize Stream Chat server client with proper error handling
let streamServerClient: StreamChat | null = null;

try {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_SECRET || process.env.STREAM_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.warn('WARNING: Stream Chat credentials not configured. Chat functionality will be disabled.');
    console.warn('Required environment variables: STREAM_API_KEY, STREAM_SECRET');
  } else {
    streamServerClient = StreamChat.getInstance(apiKey, apiSecret);
    console.log('Stream Chat client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Stream Chat client:', error);
  console.warn('Chat functionality will be disabled.');
}

export { streamServerClient };

// Connection monitoring
class ConnectionMonitor {
  private activeConnections = new Map<string, { userId: string; channelId: string; timestamp: Date }>();
  private maxConnections: number = 25; // Default free tier limit
  
  addConnection(userId: string, channelId: string): void {
    const connectionId = `${userId}-${channelId}`;
    this.activeConnections.set(connectionId, {
      userId,
      channelId,
      timestamp: new Date()
    });
    console.log(`[Stream Monitor] Connection added: ${connectionId}. Total: ${this.activeConnections.size}`);
  }
  
  removeConnection(userId: string, channelId: string): void {
    const connectionId = `${userId}-${channelId}`;
    if (this.activeConnections.delete(connectionId)) {
      console.log(`[Stream Monitor] Connection removed: ${connectionId}. Total: ${this.activeConnections.size}`);
    }
  }
  
  getCurrentConnectionCount(): number {
    return this.activeConnections.size;
  }
  
  getConnectionStats(): {
    current: number;
    max: number;
    utilizationPercent: number;
    connections: Array<{ userId: string; channelId: string; duration: number }>;
  } {
    const now = new Date();
    const connections = Array.from(this.activeConnections.values()).map(conn => ({
      userId: conn.userId,
      channelId: conn.channelId,
      duration: now.getTime() - conn.timestamp.getTime()
    }));
    
    return {
      current: this.activeConnections.size,
      max: this.maxConnections,
      utilizationPercent: Math.round((this.activeConnections.size / this.maxConnections) * 100),
      connections
    };
  }
  
  isNearLimit(): boolean {
    return this.activeConnections.size >= this.maxConnections * 0.8; // 80% threshold
  }
  
  canAddConnection(): boolean {
    return this.activeConnections.size < this.maxConnections;
  }
  
  setMaxConnections(max: number): void {
    this.maxConnections = max;
    console.log(`[Stream Monitor] Max connections updated to: ${max}`);
  }
  
  // Clean up stale connections (older than 30 minutes)
  cleanupStaleConnections(): void {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let cleaned = 0;
    
    for (const [connectionId, connection] of this.activeConnections.entries()) {
      if (connection.timestamp < thirtyMinutesAgo) {
        this.activeConnections.delete(connectionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[Stream Monitor] Cleaned up ${cleaned} stale connections. Total: ${this.activeConnections.size}`);
    }
  }
}

export const connectionMonitor = new ConnectionMonitor();

// Clean up stale connections every 10 minutes
setInterval(() => {
  connectionMonitor.cleanupStaleConnections();
}, 10 * 60 * 1000);

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'customer' | 'sales_rep' | 'project_manager';
  image?: string;
}

/**
 * Create or update a Stream Chat user
 */
export async function createStreamUser(user: ChatUser): Promise<void> {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  
  try {
    const userData: any = {
      id: user.id,
      name: user.name,
    };
    
    // Only include role for admin users, omit role for others
    if (user.role === 'admin') {
      userData.role = user.role;
    }
    
    if (user.image) {
      userData.image = user.image;
    }
    
    await streamServerClient.upsertUser(userData);
  } catch (error) {
    console.error('Error creating Stream user:', error);
    throw error;
  }
}

/**
 * Generate a Stream Chat token for a user
 */
export function generateStreamToken(userId: string): string {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  return streamServerClient.createToken(userId);
}

/**
 * Create a quote chat channel
 */
export async function createQuoteChannel(
  quoteId: string,
  quoteNumber: string,
  customerInfo?: { name: string; email: string }
): Promise<void> {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  
  try {
    if (!connectionMonitor.canAddConnection()) {
      throw new Error('Maximum concurrent connections reached. Please try again later.');
    }

    const channelId = `quote-${quoteId}`;
    const channel = streamServerClient.channel('messaging', channelId);

    await channel.create();
    
    // Send initial welcome message
    await channel.sendMessage({
      text: `Welcome to the discussion for Quote #${quoteNumber}. Feel free to ask any questions about the project details, timeline, or specifications.`,
      user_id: 'system',
    });

  } catch (error) {
    console.error('Error creating quote channel:', error);
    throw error;
  }
}

/**
 * Add a user to a quote channel
 */
export async function addUserToQuoteChannel(
  quoteId: string,
  userId: string
): Promise<void> {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  
  try {
    if (!connectionMonitor.canAddConnection()) {
      throw new Error('Maximum concurrent connections reached. Please try again later.');
    }

    const channelId = `quote-${quoteId}`;
    const channel = streamServerClient.channel('messaging', channelId);
    
    await channel.addMembers([userId]);
    connectionMonitor.addConnection(userId, channelId);
  } catch (error) {
    console.error('Error adding user to quote channel:', error);
    throw error;
  }
}

/**
 * Remove a user from a quote channel
 */
export async function removeUserFromQuoteChannel(
  quoteId: string,
  userId: string
): Promise<void> {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  
  try {
    const channelId = `quote-${quoteId}`;
    const channel = streamServerClient.channel('messaging', channelId);
    
    await channel.removeMembers([userId]);
    connectionMonitor.removeConnection(userId, channelId);
  } catch (error) {
    console.error('Error removing user from quote channel:', error);
    throw error;
  }
}

/**
 * Get or create customer user for quote chat
 */
export async function getOrCreateCustomerUser(
  quoteId: string,
  customerName: string,
  customerEmail: string
): Promise<string> {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  
  const customerId = `customer-${quoteId}`;
  
  await createStreamUser({
    id: customerId,
    name: customerName,
    email: customerEmail,
    role: 'customer',
  });
  
  return customerId;
}

/**
 * Initialize quote chat when quote is sent to customer
 */
export async function initializeQuoteChat(
  quoteId: string,
  quoteNumber: string,
  customerName: string,
  customerEmail: string,
  adminUserId: string = 'admin-1'
): Promise<{ channelId: string; customerId: string }> {
  if (!streamServerClient) {
    throw new Error('Stream Chat not available. Please configure STREAM_API_KEY and STREAM_SECRET.');
  }
  
  try {
    // Create quote channel
    await createQuoteChannel(quoteId, quoteNumber, { name: customerName, email: customerEmail });
    
    // Create/get customer user
    const customerId = await getOrCreateCustomerUser(quoteId, customerName, customerEmail);
    
    // Add admin and customer to channel
    const channelId = `quote-${quoteId}`;
    await addUserToQuoteChannel(quoteId, adminUserId);
    await addUserToQuoteChannel(quoteId, customerId);
    
    return { channelId, customerId };
  } catch (error) {
    console.error('Error initializing quote chat:', error);
    throw error;
  }
}