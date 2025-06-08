import React, { useState, useEffect } from 'react';
import { Chat, Channel, MessageList, MessageInput } from 'stream-chat-react';
import { Channel as StreamChannel } from 'stream-chat';
import { useChatContext } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Minimize2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import 'stream-chat-react/dist/css/v2/index.css';

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
  const { client, isConnected, joinQuoteChannel, error, isLoading } = useChatContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [channel, setChannel] = useState<StreamChannel | null>(null);

  // Initialize or get the quote channel
  useEffect(() => {
    if (client && isConnected && !channel) {
      joinQuoteChannel(quoteId).then(setChannel);
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

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        >
          <MessageCircle className="h-4 w-4" />
          Chat About Quote
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className={`w-96 shadow-xl border-2 ${isMinimized ? 'h-16' : 'h-96'} transition-all duration-200`}>
        <CardHeader className="p-3 bg-blue-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Quote #{quoteNumber} Chat
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-6 w-6 p-0 text-white hover:bg-blue-700"
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 text-white hover:bg-blue-700"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0 h-full">
            {channel && (
              <Chat client={client} theme="str-chat__theme-light">
                <Channel channel={channel}>
                  <div className="flex flex-col h-80">
                    <div className="flex-1 overflow-hidden">
                      <MessageList />
                    </div>
                    <div className="border-t p-2">
                      <MessageInput />
                    </div>
                  </div>
                </Channel>
              </Chat>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

// Admin version for the quote management interface
export const AdminQuoteChatWidget: React.FC<{ quoteId: string; quoteNumber: string }> = ({
  quoteId,
  quoteNumber
}) => {
  const { client, isConnected } = useChatContext();
  const [channel, setChannel] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (client && isConnected) {
      const channelId = `quote-${quoteId}`;
      const quoteChannel = client.channel('messaging', channelId);
      
      quoteChannel.watch().then(() => {
        setChannel(quoteChannel);
      }).catch(error => {
        console.error('Error watching admin channel:', error);
      });
    }
  }, [client, isConnected, quoteId]);

  if (!client || !isConnected) {
    return null;
  }

  return (
    <div className="w-full">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="mb-4 flex items-center gap-2"
      >
        <MessageCircle className="h-4 w-4" />
        {isOpen ? 'Hide Chat' : 'Show Quote Chat'}
      </Button>
      
      {isOpen && channel && (
        <Card className="h-96">
          <CardHeader>
            <CardTitle className="text-lg">Quote #{quoteNumber} Discussion</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Chat client={client} theme="str-chat__theme-light">
              <Channel channel={channel}>
                <div className="flex flex-col h-80">
                  <div className="flex-1 overflow-hidden">
                    <MessageList />
                  </div>
                  <div className="border-t p-2">
                    <MessageInput />
                  </div>
                </div>
              </Channel>
            </Chat>
          </CardContent>
        </Card>
      )}
    </div>
  );
};