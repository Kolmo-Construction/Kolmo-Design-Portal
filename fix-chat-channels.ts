/**
 * Script to fix existing chat channels and ensure proper membership
 * This addresses the issue where channels have numeric user IDs instead of Stream Chat user IDs
 */
import { streamServerClient, createStreamUser, generateStreamToken } from './server/stream-chat';
import { storage } from './server/storage';

async function fixChatChannels() {
  console.log('🔧 Fixing Stream Chat channels and membership...');
  
  try {
    if (!streamServerClient) {
      throw new Error('Stream Chat server client not initialized');
    }

    // Get all users from database
    const users = await storage.users.getAllUsers();
    console.log(`Found ${users.length} users in database`);

    const clientUsers = users.filter(u => u.role === 'client');
    const adminUsers = users.filter(u => u.role === 'admin');

    console.log(`Client users: ${clientUsers.length}, Admin users: ${adminUsers.length}`);

    // Create proper Stream Chat users for all users
    for (const user of users) {
      try {
        let streamUserId: string;
        let role: 'admin' | 'user';
        
        if (user.role === 'client') {
          streamUserId = `client-${user.id}`;
          role = 'user';
        } else {
          streamUserId = `admin-${user.id}`;
          role = 'admin';
        }

        await createStreamUser({
          id: streamUserId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: role
        });
        
        console.log(`✅ Created/updated Stream user: ${streamUserId}`);
      } catch (error) {
        console.error(`Failed to create Stream user for ${user.id}:`, error);
      }
    }

    // Fix project channels
    for (const clientUser of clientUsers) {
      try {
        const projects = await storage.projects.getProjectsForUser(clientUser.id.toString());
        console.log(`\nFixing channels for client ${clientUser.firstName} ${clientUser.lastName} (${projects.length} projects)`);

        for (const project of projects) {
          const channelId = `project-${project.id}`;
          const clientStreamId = `client-${clientUser.id}`;
          
          // Determine admin user for this project
          let adminStreamId = 'admin-1'; // fallback
          if (project.projectManagerId) {
            adminStreamId = `admin-${project.projectManagerId}`;
          } else {
            const adminUser = adminUsers[0]; // Use first admin as fallback
            if (adminUser) {
              adminStreamId = `admin-${adminUser.id}`;
            }
          }

          try {
            // Get the channel
            const channel = streamServerClient.channel('messaging', channelId);
            
            // Query channel info
            const channelData = await channel.query();
            console.log(`Channel ${channelId} - Current members:`, Object.keys(channelData.members || {}));

            // Remove any incorrect numeric members and add correct ones
            const currentMembers = Object.keys(channelData.members || {});
            const incorrectMembers = currentMembers.filter(m => /^\d+$/.test(m)); // Only numeric IDs
            
            if (incorrectMembers.length > 0) {
              console.log(`Removing incorrect members: ${incorrectMembers.join(', ')}`);
              await channel.removeMembers(incorrectMembers);
            }

            // Add correct members
            const correctMembers = [clientStreamId, adminStreamId];
            await channel.addMembers(correctMembers);
            
            // Update channel name
            await channel.update({
              name: `${project.name} - Project Chat`,
            });

            console.log(`✅ Fixed channel ${channelId} - Members: ${correctMembers.join(', ')}`);

            // Send a system message to confirm the fix
            await channel.sendMessage({
              text: `Chat channel has been updated. Both project manager and client can now communicate here.`,
              user_id: adminStreamId
            });

          } catch (channelError: any) {
            if (channelError.code === 4) {
              // Channel doesn't exist, create it
              console.log(`Creating new channel: ${channelId}`);
              const channel = streamServerClient.channel('messaging', channelId);
              await channel.create({
                members: [clientStreamId, adminStreamId],
                created_by_id: adminStreamId,
                name: `${project.name} - Project Chat`,
              });
              
              console.log(`✅ Created channel ${channelId} - Members: ${clientStreamId}, ${adminStreamId}`);
            } else {
              throw channelError;
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fix channels for client ${clientUser.id}:`, error);
      }
    }

    console.log('\n🎉 Channel fix completed!');
    console.log('\nTo test the fix:');
    console.log('1. Login as an admin user and go to /messages');
    console.log('2. Login as a client user and go to /client/messages');
    console.log('3. Both should see project channels with proper names');
    console.log('4. Messages sent from either side should appear in real-time');

  } catch (error) {
    console.error('❌ Channel fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
fixChatChannels().then(() => {
  console.log('✅ Fix script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fix script failed:', error);
  process.exit(1);
});