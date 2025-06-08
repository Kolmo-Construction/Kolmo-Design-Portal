import React, { useState, useEffect } from 'react';
import { Chat, Channel, MessageList, MessageInput } from 'stream-chat-react';
import { Channel as StreamChannel } from 'stream-chat';
import { useChatContext } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Minimize2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import 'stream-chat-react/dist/css/v2/index.css';
import '@/styles/chat-theme.css';

interface QuoteChatWidgetProps {
  quoteId: string;
  quoteNumber: string;
  isCustomer?: boolean;
  customerName?: string;
  customerEmail?: string;
}

export const QuoteChatWidget: React.FC<QuoteChatWidgetProps> = ({
  quoteId,
  quoteNumber,
  isCustomer = false,
  customerName,
  customerEmail
}) => {
  console.log('QuoteChatWidget rendering with props:', { quoteId, quoteNumber, isCustomer });
  
  const { client, isConnected, joinQuoteChannel, error, isLoading } = useChatContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  
  console.log('Chat context state:', { client: !!client, isConnected, error, isLoading });

  // Initialize or get the quote channel - only after client is fully connected
  useEffect(() => {
    if (client && isConnected && !channel && client.user) {
      console.log('Attempting to join quote channel:', quoteId);
      joinQuoteChannel(quoteId).then(channel => {
        if (channel) {
          console.log('Successfully joined quote channel');
          setChannel(channel);
        }
      }).catch(error => {
        console.error('Failed to join quote channel:', error);
      });
    }
  }, [client, isConnected, quoteId, channel, joinQuoteChannel]);

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Alert className="w-80">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Chat unavailable: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading || !client || !isConnected) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          disabled
          className="flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          {isLoading ? 'Connecting...' : 'Chat Loading...'}
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile floating chat button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-50 kolmo-chat-button rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Desktop floating chat button */}
      {!isOpen && (
        <div className="hidden md:block fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="kolmo-chat-button flex items-center gap-2 shadow-lg border-none"
          >
            <MessageCircle className="h-4 w-4" />
            Chat About Quote
          </Button>
        </div>
      )}

      {/* Desktop chat widget */}
      {isOpen && (
        <div className="hidden md:block fixed bottom-4 right-4 z-50">
          <Card className={`w-96 shadow-xl border-2 ${isMinimized ? 'h-16' : 'h-96'} transition-all duration-200`}>
            <CardHeader className="p-3 kolmo-chat-header rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-white">
                  Quote #{quoteNumber} Chat
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="h-6 w-6 p-0 text-white hover:bg-opacity-20 hover:bg-white"
                  >
                    <Minimize2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-6 w-6 p-0 text-white hover:bg-opacity-20 hover:bg-white"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {!isMinimized && (
              <CardContent className="p-0 h-full">
                {channel && (
                  <div className="kolmo-chat-theme h-80">
                    <Chat client={client} theme="str-chat__theme-light">
                      <Channel channel={channel}>
                        <div className="flex flex-col h-full">
                          <div className="flex-1 overflow-hidden">
                            <MessageList />
                          </div>
                          <div className="border-t">
                            <MessageInput />
                          </div>
                        </div>
                      </Channel>
                    </Chat>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Mobile full-screen chat overlay */}
      {isOpen && (
        <div className="md:hidden kolmo-chat-widget">
          <div className="kolmo-chat-header flex items-center justify-between">
            <span>Quote #{quoteNumber} Chat</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="kolmo-chat-theme kolmo-chat-content">
            {channel && (
              <Chat client={client} theme="str-chat__theme-light">
                <Channel channel={channel}>
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-hidden">
                      <MessageList />
                    </div>
                    <div className="border-t bg-white">
                      <MessageInput />
                    </div>
                  </div>
                </Channel>
              </Chat>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Admin version for the quote management interface
export const AdminQuoteChatWidget: React.FC<{ quoteId: string; quoteNumber: string }> = ({
  quoteId,
  quoteNumber
}) => {
  console.log('🚀 AdminQuoteChatWidget RENDERING with props:', { quoteId, quoteNumber });
  
  const { client, isConnected, error, isLoading } = useChatContext();
  const [channel, setChannel] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  console.log('📱 Admin chat context state:', { 
    hasClient: !!client, 
    isConnected, 
    error, 
    isLoading,
    channelExists: !!channel
  });

  useEffect(() => {
    if (client && isConnected && client.user) {
      console.log('Admin attempting to join quote channel:', quoteId);
      const channelId = `quote-${quoteId}`;
      const quoteChannel = client.channel('messaging', channelId);
      
      quoteChannel.watch().then(() => {
        console.log('Admin successfully joined quote channel');
        setChannel(quoteChannel);
      }).catch(error => {
        console.error('Error watching admin channel:', error);
      });
    }
  }, [client, isConnected, quoteId]);

  if (error) {
    return (
      <div className="w-full">
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-600 text-sm">Chat unavailable: {error}</p>
        </div>
      </div>
    );
  }

  if (!client || !isConnected) {
    return (
      <>
        {/* Mobile floating loading button */}
        <button
          disabled
          className="md:hidden kolmo-floating-chat-button opacity-60 cursor-not-allowed"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
        
        {/* Desktop loading state */}
        <div className="hidden md:block w-full">
          <button
            disabled
            className="kolmo-chat-button mb-4 flex items-center gap-2 w-full justify-center opacity-60 cursor-not-allowed"
          >
            <MessageCircle className="h-4 w-4" />
            {isLoading ? 'Connecting to Chat...' : 'Chat Loading...'}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="w-full">
      {/* Admin chat toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="kolmo-chat-button mb-4 flex items-center gap-2 w-full justify-center"
      >
        <MessageCircle className="h-4 w-4" />
        {isOpen ? 'Hide Chat' : 'Show Quote Chat'}
      </button>
      
      {/* Admin inline chat */}
      {isOpen && channel && (
        <div className="bg-white border rounded-lg shadow-lg overflow-hidden h-96" style={{ borderColor: '#4a6670' }}>
          <div className="kolmo-chat-header">
            Quote #{quoteNumber} Discussion
          </div>
          <div className="kolmo-chat-theme h-80">
            <Chat client={client} theme="str-chat__theme-light">
              <Channel channel={channel}>
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-hidden">
                    <MessageList />
                  </div>
                  <div className="border-t">
                    <MessageInput />
                  </div>
                </div>
              </Channel>
            </Chat>
          </div>
        </div>
      )}
    </div>
  );
};