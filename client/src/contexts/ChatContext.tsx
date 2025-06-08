import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { StreamChat, Channel as StreamChannel } from 'stream-chat';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatContextType {
  client: StreamChat | null;
  isConnected: boolean;
  currentChannel: StreamChannel | null;
  setCurrentChannel: (channel: StreamChannel | null) => void;
  initializeCustomerChat: (quoteToken: string, customerName: string, customerEmail: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  joinQuoteChannel: (quoteId: string) => Promise<StreamChannel | null>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
  isCustomer?: boolean;
  quoteToken?: string;
  customerName?: string;
  customerEmail?: string;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ 
  children, 
  isCustomer = false,
  quoteToken,
  customerName,
  customerEmail
}) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<StreamChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Query for admin chat token
  const { data: adminChatData, error: adminError } = useQuery({
    queryKey: ['/api/chat/token'],
    enabled: !isCustomer,
    retry: 2,
  });

  // Initialize admin chat
  useEffect(() => {
    if (!isCustomer && adminChatData && !client) {
      initializeAdminChat(adminChatData);
    }
  }, [isCustomer, adminChatData, client]);

  const initializeAdminChat = async (chatData: any) => {
    console.log('initializeAdminChat called with:', chatData);
    if (isLoading || client) {
      console.log('Skipping admin chat init - already loading or client exists');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Creating Stream client with API key:', chatData.apiKey);
      const chatClient = StreamChat.getInstance(chatData.apiKey);
      console.log('Connecting user:', { id: chatData.userId, name: 'Admin User' });
      await chatClient.connectUser(
        { 
          id: chatData.userId,
          name: 'Admin User',
        },
        chatData.token
      );
      console.log('Stream client connected successfully');
      setClient(chatClient);
      setIsConnected(true);
    } catch (err) {
      console.error('Error initializing admin chat:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize admin chat';
      setError(errorMessage);
      console.error('Error initializing admin chat:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCustomerChat = async (token: string, name: string, email: string) => {
    if (isLoading || client) {
      console.log('Skipping customer chat init - already loading or client exists');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await apiRequest('POST', '/api/chat/customer-token', {
        quoteToken: token,
        customerName: name,
        customerEmail: email,
      });
      const response = await res.json();

      // Get existing instance or create new one, but avoid multiple connections
      const chatClient = StreamChat.getInstance(response.apiKey);
      
      // Disconnect existing connection if any
      if (chatClient.user) {
        await chatClient.disconnectUser();
      }
      
      await chatClient.connectUser(
        { 
          id: response.userId,
          name: name,
        },
        response.token
      );

      setClient(chatClient);
      setIsConnected(true);

      // Join the quote channel
      const channel = chatClient.channel('messaging', response.channelId);
      await channel.watch();
      setCurrentChannel(channel);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize customer chat';
      setError(errorMessage);
      console.error('Error initializing customer chat:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const joinQuoteChannel = async (quoteId: string): Promise<StreamChannel | null> => {
    if (!client) return null;
    
    try {
      const channelId = `quote-${quoteId}`;
      const channel = client.channel('messaging', channelId);
      await channel.watch();
      return channel;
    } catch (err) {
      console.error('Error joining quote channel:', err);
      return null;
    }
  };

  // Auto-initialize customer chat if props are provided
  useEffect(() => {
    if (isCustomer && quoteToken && customerName && customerEmail && !client) {
      initializeCustomerChat(quoteToken, customerName, customerEmail);
    }
  }, [isCustomer, quoteToken, customerName, customerEmail, client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        client.disconnectUser().catch(console.error);
      }
    };
  }, [client]);

  const value: ChatContextType = {
    client,
    isConnected,
    currentChannel,
    setCurrentChannel,
    initializeCustomerChat,
    error,
    isLoading,
    joinQuoteChannel,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};