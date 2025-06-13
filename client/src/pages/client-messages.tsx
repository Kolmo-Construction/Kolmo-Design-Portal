import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Users,
  Calendar,
  Loader2
} from 'lucide-react';
import { ClientNavigation } from '@/components/ClientNavigation';
import { StreamChat } from 'stream-chat';
import { Chat, Channel, ChannelList, MessageList, MessageInput, Window, Thread } from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import '@/styles/chat-theme.css';

interface StreamChatData {
  apiKey: string;
  token: string;
  userId: string;
}

export default function ClientMessages() {
  const { user } = useAuth();
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Fetch Stream Chat configuration for the client
  const { data: chatData, isLoading: isChatDataLoading } = useQuery<StreamChatData>({
    queryKey: ['/api/client/chat-token'],
    enabled: !!user && user.role === 'client'
  });

  // Initialize Stream Chat client
  useEffect(() => {
    const initializeChat = async () => {
      if (!chatData || !user || chatClient) return;
      
      setIsConnecting(true);
      setChatError(null);
      
      try {
        console.log('Initializing Stream Chat for client:', user.id);
        
        const client = StreamChat.getInstance(chatData.apiKey);
        
        await client.connectUser(
          {
            id: chatData.userId,
            name: `${user.firstName} ${user.lastName}`,
            role: 'client'
          },
          chatData.token
        );
        
        setChatClient(client);
        console.log('Stream Chat connected successfully');
        
        // Debug: Check available channels
        setTimeout(async () => {
          try {
            const channels = await client.queryChannels({
              type: 'messaging',
              members: { $in: [chatData.userId] }
            });
            console.log('Available channels for client:', channels.length);
            channels.forEach(channel => {
              console.log('Channel:', channel.id, 'Members:', Object.keys(channel.state.members));
            });
          } catch (error) {
            console.error('Error querying channels:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('Error connecting to Stream Chat:', error);
        setChatError('Failed to connect to chat. Please refresh the page and try again.');
      } finally {
        setIsConnecting(false);
      }
    };

    initializeChat();

    // Cleanup on unmount
    return () => {
      if (chatClient) {
        chatClient.disconnectUser().catch(console.error);
      }
    };
  }, [chatData, user]); // Remove chatClient from dependencies to prevent re-initialization

  if (!user || user.role !== 'client') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6 text-center">
              <MessageSquare className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">This page is for client users only.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Loading states
  if (isChatDataLoading || isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connecting to Chat</h3>
            <p className="text-muted-foreground">Setting up your project communication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (chatError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6 text-center">
              <MessageSquare className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Chat Connection Error</h2>
              <p className="text-muted-foreground mb-4">{chatError}</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-accent hover:bg-accent/90"
              >
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Chat interface
  if (chatClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <ClientNavigation />
        
        <div className="container mx-auto px-6 pt-24 pb-12">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary mb-2">Project Messages</h1>
            <p className="text-muted-foreground">
              Communicate with your project team in real-time.
            </p>
          </div>

          {/* Stream Chat Interface */}
          <div className="h-[600px] bg-white rounded-lg shadow-lg border border-accent/20 overflow-hidden">
            <Chat client={chatClient} theme="kolmo-chat-theme">
              <div className="flex h-full">
                {/* Channel List */}
                <div className="w-1/3 border-r border-gray-200">
                  <ChannelList
                    filters={{ 
                      type: 'messaging',
                      members: { $in: [chatData?.userId || ''] }
                    }}
                    sort={{ last_message_at: -1 }}
                    options={{ limit: 20 }}
                  />
                </div>
                
                {/* Chat Area */}
                <div className="flex-1">
                  <Channel>
                    <Window>
                      <MessageList />
                      <MessageInput 
                        focus={true}
                        overrideSubmitHandler={(params) => {
                          console.log('Attempting to send message:', params.message);
                          // Return void to allow default submit handler
                        }}
                      />
                    </Window>
                    <Thread />
                  </Channel>
                </div>
              </div>
            </Chat>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Select a project channel on the left to start messaging your team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback loading state
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <ClientNavigation />
      <div className="container mx-auto px-6 pt-24 pb-12">
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Loading Chat</h3>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    </div>
  );
}