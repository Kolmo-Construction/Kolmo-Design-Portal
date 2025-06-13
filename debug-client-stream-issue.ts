/**
 * Debug script to test client-side Stream Chat connection issues
 */
import { StreamChat } from 'stream-chat';
import { storage } from './server/storage';

async function debugClientStreamIssue() {
  console.log('🔍 Debugging client-side Stream Chat connection...');
  
  try {
    // Get test client user
    const users = await storage.users.getAllUsers();
    const clientUser = users.find(u => u.role === 'client');
    
    if (!clientUser) {
      console.error('No client user found');
      return;
    }
    
    console.log(`Using client user: ${clientUser.firstName} ${clientUser.lastName} (ID: ${clientUser.id})`);
    
    // Create server client
    const apiKey = process.env.STREAM_API_KEY!;
    const apiSecret = process.env.STREAM_API_SECRET!;
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    
    // Create/update Stream user
    const streamUserId = `client-${clientUser.id}`;
    await serverClient.upsertUser({
      id: streamUserId,
      name: `${clientUser.firstName} ${clientUser.lastName}`,
      email: clientUser.email
    });
    console.log('✓ Stream user created/updated');
    
    // Generate token
    const token = serverClient.createToken(streamUserId);
    console.log('✓ Token generated');
    
    // Create client instance (simulating frontend)
    const clientInstance = StreamChat.getInstance(apiKey);
    
    // Connect user
    await clientInstance.connectUser({
      id: streamUserId,
      name: `${clientUser.firstName} ${clientUser.lastName}`
    }, token);
    console.log('✓ Client connected');
    
    // Test channel query with different approaches
    console.log('\n📋 Testing channel queries...');
    
    // Test 1: Query all messaging channels
    try {
      const allChannels = await clientInstance.queryChannels({ type: 'messaging' });
      console.log(`✓ All messaging channels: ${allChannels.length}`);
    } catch (error) {
      console.error('❌ Failed to query all channels:', error.message);
    }
    
    // Test 2: Query channels with member filter
    try {
      const memberChannels = await clientInstance.queryChannels({
        type: 'messaging',
        members: { $in: [streamUserId] }
      });
      console.log(`✓ Member channels: ${memberChannels.length}`);
      memberChannels.forEach(ch => {
        console.log(`  - Channel: ${ch.id}, Members: ${Object.keys(ch.state.members).join(', ')}`);
      });
    } catch (error) {
      console.error('❌ Failed to query member channels:', error.message);
    }
    
    // Test 3: Get project channels specifically
    try {
      const projects = await storage.projects.getProjectsForUser(clientUser.id.toString());
      console.log(`\n🏗️ Found ${projects.length} projects for client`);
      
      for (const project of projects) {
        const channelId = `project-${project.id}`;
        try {
          const channel = clientInstance.channel('messaging', channelId);
          await channel.query();
          console.log(`✓ Project channel ${channelId} exists and accessible`);
          
          // Try to get messages
          const messages = await channel.query({ messages: { limit: 10 } });
          console.log(`  - Messages in channel: ${messages.messages?.length || 0}`);
        } catch (channelError) {
          console.error(`❌ Cannot access channel ${channelId}:`, channelError.message);
        }
      }
    } catch (error) {
      console.error('❌ Failed to test project channels:', error.message);
    }
    
    // Test 4: Check user permissions
    try {
      const userInfo = await clientInstance.queryUsers({ id: streamUserId });
      console.log(`\n👤 User info: ${JSON.stringify(userInfo.users[0], null, 2)}`);
    } catch (error) {
      console.error('❌ Failed to query user info:', error.message);
    }
    
    // Cleanup
    await clientInstance.disconnectUser();
    console.log('\n✓ Disconnected successfully');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error(error.stack);
  }
}

debugClientStreamIssue().catch(console.error);