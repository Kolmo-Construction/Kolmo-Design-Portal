import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import { StreamChat } from 'stream-chat';
import { Chat, Channel, ChannelList, MessageList, MessageInput, Window, Thread } from 'stream-chat-react';
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import 'stream-chat-react/dist/css/v2/index.css';

interface StreamChatData {
  apiKey: string;
  token: string;
  userId: string;
}

export default function AdminMessages() {
  const { user } = useAuth();
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch Stream Chat configuration for the admin
  const { data: chatData, isLoading: isChatDataLoading } = useQuery<StreamChatData>({
    queryKey: ['/api/chat/token'],
    enabled: !!user && (user.role === 'admin' || user.role === 'project_manager')
  });

  // Initialize Stream Chat client
  useEffect(() => {
    const initializeChat = async () => {
      if (!chatData || !user || chatClient) return;
      
      setIsConnecting(true);
      setChatError(null);
      
      try {
        console.log('Initializing Stream Chat for admin:', user.id);
        
        const client = StreamChat.getInstance(chatData.apiKey);
        
        await client.connectUser(
          {
            id: chatData.userId,
            name: `${user.firstName} ${user.lastName}`,
            role: 'admin'
          },
          chatData.token
        );
        
        setChatClient(client);
        console.log('Stream Chat connected successfully');
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
        chatClient.disconnectUser();
      }
    };
  }, [chatData, user, chatClient]);

  if (!user || (user.role !== 'admin' && user.role !== 'project_manager')) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6 text-center">
              <MessageSquare className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">This page is for admin users only.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Loading states
  if (isChatDataLoading || isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connecting to Chat</h2>
              <p className="text-muted-foreground">
                Setting up your messaging interface...
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Error state
  if (chatError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6 text-center">
              <MessageSquare className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Chat Connection Error</h2>
              <p className="text-muted-foreground mb-4">{chatError}</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-primary hover:bg-primary/90"
              >
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Chat interface
  if (chatClient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        
        <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Project Messages</h1>
            <p className="text-slate-600">
              Communicate with your clients in real-time.
            </p>
          </div>

          {/* Stream Chat Interface */}
          <div className="h-[600px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
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
                      <MessageInput />
                    </Window>
                    <Thread />
                  </Channel>
                </div>
              </div>
            </Chat>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Select a project channel on the left to start messaging your clients.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return null;
}