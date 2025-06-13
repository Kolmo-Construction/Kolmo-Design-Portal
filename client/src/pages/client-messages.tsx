import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Users,
  Calendar,
  Loader2,
  RefreshCw
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
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const clientRef = useRef<StreamChat | null>(null);
  const isInitializingRef = useRef(false);

  // Fetch Stream Chat configuration for the client
  const { data: chatData, isLoading: isChatDataLoading } = useQuery<StreamChatData>({
    queryKey: ['/api/client/chat-token'],
    enabled: !!user && user.role === 'client'
  });

  // Reconnection function
  const attemptReconnection = useCallback(async () => {
    if (!chatData || !user || isInitializingRef.current) return;
    
    console.log(`Attempting reconnection (attempt ${reconnectAttempts + 1})`);
    setReconnectAttempts(prev => prev + 1);
    setIsConnecting(true);
    setChatError(null);
    
    try {
      // Clean up existing client
      if (clientRef.current) {
        try {
          await clientRef.current.disconnectUser();
        } catch (error) {
          console.warn('Error disconnecting during reconnection:', error);
        }
        clientRef.current = null;
        setChatClient(null);
      }
      
      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const client = StreamChat.getInstance(chatData.apiKey);
      
      await client.connectUser(
        {
          id: chatData.userId,
          name: `${user.firstName} ${user.lastName}`,
          role: 'client'
        },
        chatData.token
      );
      
      clientRef.current = client;
      setChatClient(client);
      setReconnectAttempts(0);
      console.log('Stream Chat reconnected successfully');
      
    } catch (error) {
      console.error('Reconnection failed:', error);
      setChatError('Connection failed. Click to retry.');
    } finally {
      setIsConnecting(false);
    }
  }, [chatData, user, reconnectAttempts]);

  // Initialize Stream Chat client
  useEffect(() => {
    const initializeChat = async () => {
      if (!chatData || !user || isInitializingRef.current) return;
      
      // If we already have a connected client with the same user, don't reinitialize
      if (clientRef.current && clientRef.current.user?.id === chatData.userId && clientRef.current.wsConnection?.isHealthy) {
        setChatClient(clientRef.current);
        return;
      }
      
      isInitializingRef.current = true;
      setIsConnecting(true);
      setChatError(null);
      
      try {
        // Clean up existing client if it exists
        if (clientRef.current) {
          try {
            await clientRef.current.disconnectUser();
          } catch (error) {
            console.warn('Error disconnecting existing client:', error);
          }
          clientRef.current = null;
        }
        
        console.log('Initializing Stream Chat for client:', user.id);
        
        const client = StreamChat.getInstance(chatData.apiKey);
        
        // Add connection event listeners for better error handling
        client.on('connection.recovered', () => {
          console.log('Stream Chat connection recovered');
          setChatError(null);
          setReconnectAttempts(0);
        });
        
        client.on('connection.failed', (error) => {
          console.error('Stream Chat connection failed:', error);
          setChatError('Connection lost. Attempting to reconnect...');
          setTimeout(attemptReconnection, 3000);
        });
        
        await client.connectUser(
          {
            id: chatData.userId,
            name: `${user.firstName} ${user.lastName}`,
            role: 'client'
          },
          chatData.token
        );
        
        clientRef.current = client;
        setChatClient(client);
        setReconnectAttempts(0);
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
        setChatError('Failed to connect to chat. Please try reconnecting.');
      } finally {
        setIsConnecting(false);
        isInitializingRef.current = false;
      }
    };

    initializeChat();
  }, [chatData?.apiKey, chatData?.token, chatData?.userId, user?.id, attemptReconnection]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnectUser().catch(console.error);
        clientRef.current = null;
      }
    };
  }, []);

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
              {reconnectAttempts > 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Reconnection attempts: {reconnectAttempts}
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={attemptReconnection}
                  disabled={isConnecting}
                  className="bg-accent hover:bg-accent/90"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Connection
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Refresh Page
                </Button>
              </div>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">Project Messages</h1>
                <p className="text-muted-foreground">
                  Communicate with your project team in real-time.
                </p>
              </div>
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${chatClient && chatClient.wsConnection?.isHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-muted-foreground">
                  {chatClient && chatClient.wsConnection?.isHealthy ? 'Connected' : 'Disconnected'}
                </span>
                {chatError && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={attemptReconnection}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
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
                      <MessageInput focus={true} />
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