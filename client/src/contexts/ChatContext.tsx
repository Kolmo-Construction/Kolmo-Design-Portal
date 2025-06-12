import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
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
    enabled: !isCustomer && !client,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Initialize admin chat
  useEffect(() => {
    if (!isCustomer && adminChatData && !client) {
      initializeAdminChat(adminChatData);
    }
  }, [isCustomer, adminChatData, client]);

  const initializationPromiseRef = useRef<Promise<void> | null>(null);
  
  const initializeAdminChat = async (chatData: any) => {
    // Prevent multiple concurrent initializations by using a shared promise
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }
    
    // Prevent multiple initializations
    if (isLoading) {
      return;
    }
    
    if (client && isConnected) {
      return;
    }
    
    const initPromise = (async () => {
      // Disconnect existing client if any
      if (client) {
        try {
          await client.disconnectUser();
        } catch (err) {
          console.warn('Error disconnecting existing client:', err);
        }
        setClient(null);
        setIsConnected(false);
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Initializing Stream Chat with API key:', chatData.apiKey?.substring(0, 8) + '...');
        
        if (!chatData.apiKey || !chatData.token || !chatData.userId) {
          throw new Error('Missing required chat configuration: apiKey, token, or userId');
        }
        
        const chatClient = StreamChat.getInstance(chatData.apiKey);
        
        // Add connection event listeners for better debugging
        chatClient.on('connection.changed', (event) => {
          console.log('Stream Chat connection changed:', event);
          if (event.online) {
            setIsConnected(true);
            setError(null);
          } else {
            setIsConnected(false);
            setError('Connection lost');
          }
        });
        
        chatClient.on('connection.error', (event) => {
          console.error('Stream Chat connection error:', event);
          setError('Connection error occurred');
          setIsConnected(false);
        });
        
        await chatClient.connectUser(
          { 
            id: chatData.userId,
            name: 'KOLMO Admin',
          },
          chatData.token
        );
        
        setClient(chatClient);
        setIsConnected(true);
        console.log('Stream Chat connected successfully for user:', chatData.userId);
      } catch (err) {
        console.error('Error initializing admin chat:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize admin chat';
        setError(errorMessage);
        throw err; // Re-throw to prevent setting success state
      } finally {
        setIsLoading(false);
        initializationPromiseRef.current = null;
      }
    })();
    
    initializationPromiseRef.current = initPromise;
    return initPromise;
  };

  const initializeCustomerChat = async (token: string, name: string, email: string) => {
    if (isLoading || client) {
      console.log('Skipping customer chat init - already loading or client exists');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Requesting customer chat token for:', name, email);
      
      const response = await apiRequest('POST', '/api/chat/customer-token', {
        quoteToken: token,
        customerName: name,
        customerEmail: email,
      });

      console.log('Received customer chat response:', { 
        userId: response.userId, 
        channelId: response.channelId,
        apiKey: response.apiKey?.substring(0, 8) + '...'
      });

      if (!response.apiKey || !response.token || !response.userId) {
        throw new Error('Invalid response from chat token endpoint');
      }

      // Get existing instance or create new one, but avoid multiple connections
      const chatClient = StreamChat.getInstance(response.apiKey);
      
      // Add connection event listeners
      chatClient.on('connection.changed', (event) => {
        console.log('Customer Stream Chat connection changed:', event);
        if (event.online) {
          setIsConnected(true);
          setError(null);
        } else {
          setIsConnected(false);
          setError('Connection lost');
        }
      });
      
      chatClient.on('connection.error', (event) => {
        console.error('Customer Stream Chat connection error:', event);
        setError('Connection error occurred');
        setIsConnected(false);
      });
      
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
      console.log('Customer chat connected successfully for user:', response.userId);

      // Join the quote channel
      const channel = chatClient.channel('messaging', response.channelId);
      await channel.watch();
      setCurrentChannel(channel);
      console.log('Joined quote channel:', response.channelId);
    } catch (err) {
      console.error('Error initializing customer chat:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize customer chat';
      setError(errorMessage);
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