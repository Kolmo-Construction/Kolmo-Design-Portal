/**
 * Debug script to test message sending/receiving for client 9
 * This will help identify why messages aren't working
 */

import { StreamChat } from 'stream-chat';
import { streamServerClient, generateStreamToken, createStreamUser } from './server/stream-chat';
import { db } from './server/db';
import { users, projects } from './shared/schema';
import { eq } from 'drizzle-orm';

async function debugClient9Messages() {
  try {
    console.log('\n🔍 Debugging message issues for client 9...\n');

    // 1. Get client 9 data
    const client9 = await db.select().from(users).where(eq(users.id, 9)).limit(1);
    if (!client9.length) {
      console.error('❌ Client 9 not found in database');
      return;
    }
    
    const clientUser = client9[0];
    console.log('✓ Found client 9:', clientUser.email);

    // 2. Get client's projects
    const clientProjects = await db.select().from(projects).where(eq(projects.clientId, 9));
    console.log(`✓ Client has ${clientProjects.length} projects:`, clientProjects.map(p => p.name));

    if (!clientProjects.length) {
      console.log('⚠️ Client 9 has no projects - no chat channels will be available');
      return;
    }

    // 3. Check Stream Chat server client
    if (!streamServerClient) {
      console.error('❌ Stream server client not initialized');
      return;
    }
    console.log('✓ Stream server client available');

    // 4. Create client Stream user
    const clientStreamId = `client-${clientUser.id}`;
    console.log(`\n4. Creating/updating Stream user: ${clientStreamId}`);
    
    await createStreamUser({
      id: clientStreamId,
      name: `${clientUser.firstName} ${clientUser.lastName}`,
      email: clientUser.email,
      role: 'client',
    });
    console.log('✓ Client Stream user created/updated');

    // 5. Generate token for client
    const clientToken = generateStreamToken(clientStreamId);
    console.log('✓ Client token generated');

    // 6. Create admin user
    const adminStreamId = 'admin-1';
    await createStreamUser({
      id: adminStreamId,
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    });
    console.log('✓ Admin Stream user created/updated');

    // 7. Test each project channel
    for (const project of clientProjects) {
      console.log(`\n--- Testing project ${project.id}: ${project.name} ---`);
      
      const channelId = `project-${project.id}`;
      console.log(`Channel ID: ${channelId}`);
      
      try {
        // Get/create channel
        const channel = streamServerClient.channel('messaging', channelId);
        
        // Try to query channel first
        let channelExists = false;
        try {
          await channel.query();
          channelExists = true;
          console.log('✓ Channel exists');
        } catch (error: any) {
          if (error.code === 4 || error.message?.includes('does not exist')) {
            console.log('Channel does not exist, creating...');
            await channel.create({
              created_by_id: adminStreamId,
              name: `${project.name} - Project Chat`
            });
            channelExists = true;
            console.log('✓ Channel created');
          } else {
            throw error;
          }
        }

        if (channelExists) {
          // Add members
          console.log('Adding members to channel...');
          await channel.addMembers([clientStreamId, adminStreamId]);
          console.log('✓ Members added');

          // Check channel state
          const channelState = await channel.query();
          console.log('Channel members:', Object.keys(channelState.members || {}));
          console.log('Channel config:', channelState.channel?.config);

          // Test sending a message from admin
          console.log('Sending test message from admin...');
          const messageResponse = await channel.sendMessage({
            text: `Hello ${clientUser.firstName}! This is a test message for debugging. Project: ${project.name}`,
            user_id: adminStreamId
          });
          console.log('✓ Test message sent:', messageResponse.message?.id);

          // Check message history
          const messages = await channel.query({ messages: { limit: 5 } });
          console.log(`✓ Channel has ${messages.messages?.length || 0} messages`);

          // Test client connection
          console.log('Testing client connection...');
          const clientChatClient = StreamChat.getInstance(process.env.STREAM_API_KEY!);
          
          await clientChatClient.connectUser(
            {
              id: clientStreamId,
              name: `${clientUser.firstName} ${clientUser.lastName}`,
              role: 'client'
            },
            clientToken
          );
          console.log('✓ Client connected to Stream Chat');

          // Get client's channels
          const clientChannels = await clientChatClient.queryChannels({
            type: 'messaging',
            members: { $in: [clientStreamId] }
          });
          console.log(`✓ Client can see ${clientChannels.length} channels`);

          // Try sending message as client
          const clientChannel = clientChannels.find(ch => ch.id === channelId);
          if (clientChannel) {
            console.log('Sending message as client...');
            const clientMessage = await clientChannel.sendMessage({
              text: 'Test message from client - debugging message issues'
            });
            console.log('✓ Client message sent:', clientMessage.message?.id);
          } else {
            console.log('⚠️ Client cannot access the channel');
          }

          // Disconnect client
          await clientChatClient.disconnectUser();
          console.log('✓ Client disconnected');
        }

      } catch (error) {
        console.error(`❌ Error with channel ${channelId}:`, error);
      }
    }

    console.log('\n🎉 Debug completed!');
    console.log('\nNext steps:');
    console.log('1. Check if channels appear in the client UI');
    console.log('2. Try sending messages through the UI');
    console.log('3. Check browser console for any JavaScript errors');
    
  } catch (error) {
    console.error('\n❌ Debug failed:', error);
  }
}

// Run the debug
debugClient9Messages().catch(console.error);