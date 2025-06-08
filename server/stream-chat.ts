import { StreamChat } from 'stream-chat';

// Initialize Stream Chat server client
export const streamServerClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

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
  try {
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
  try {
    const channelId = `quote-${quoteId}`;
    const channel = streamServerClient.channel('messaging', channelId);
    
    await channel.addMembers([userId]);
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
  try {
    const channelId = `quote-${quoteId}`;
    const channel = streamServerClient.channel('messaging', channelId);
    
    await channel.removeMembers([userId]);
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