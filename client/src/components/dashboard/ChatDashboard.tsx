import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageCircle, 
  Clock, 
  Users, 
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'wouter';
import { ChatMonitoring } from '@/components/admin/ChatMonitoring';

interface ConversationData {
  channelId: string;
  quoteId: number | null;
  quoteInfo: {
    id: number;
    quoteNumber: string;
    title: string;
    customerName: string;
    customerEmail: string;
  } | null;
  lastMessage: {
    text: string;
    createdAt: string;
    user: {
      id: string;
      name: string;
    };
  } | null;
  unreadCount: number;
  memberCount: number;
  isActive: boolean;
}

export const ChatDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'conversations' | 'monitoring'>('conversations');

  // Query conversations
  const { data: conversations = [], isLoading: conversationsLoading, refetch } = useQuery<ConversationData[]>({
    queryKey: ['/api/chat/conversations'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false, // Disable auto-refresh
  });

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  const activeConversations = conversations.filter(conv => conv.isActive);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const truncateMessage = (text: string, maxLength: number = 60) => {
    if (!text) return 'No messages yet';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chat Management</h2>
          <p className="text-muted-foreground">
            Centralized chat responses and monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={activeTab === 'conversations' ? 'default' : 'outline'}
            onClick={() => setActiveTab('conversations')}
            className="relative"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Conversations
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-2 text-xs">
                {totalUnread}
              </Badge>
            )}
          </Button>
          <Button 
            variant={activeTab === 'monitoring' ? 'default' : 'outline'}
            onClick={() => setActiveTab('monitoring')}
          >
            <Users className="h-4 w-4 mr-2" />
            Monitoring
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeTab === 'conversations' && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conversations.length}</div>
                <p className="text-xs text-muted-foreground">
                  {activeConversations.length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUnread}</div>
                <p className="text-xs text-muted-foreground">
                  Requiring response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">~15m</div>
                <p className="text-xs text-muted-foreground">
                  Average response time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Conversations List */}
          <Card>
            <CardHeader>
              <CardTitle>Active Conversations</CardTitle>
              <CardDescription>
                All quote-related chats sorted by latest activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conversationsLoading ? (
                <div className="text-center py-8">Loading conversations...</div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active conversations</p>
                  <p className="text-sm">Conversations will appear here when customers start chatting about quotes</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {conversations.map((conversation) => (
                      <div 
                        key={conversation.channelId} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {conversation.quoteInfo?.customerName ? 
                                getInitials(conversation.quoteInfo.customerName) : 'C'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium truncate">
                                {conversation.quoteInfo?.customerName || 'Unknown Customer'}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {conversation.quoteInfo?.quoteNumber}
                              </Badge>
                              {conversation.unreadCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {conversation.unreadCount} new
                                </Badge>
                              )}
                              {conversation.isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground truncate mb-1">
                              {conversation.quoteInfo?.title}
                            </p>
                            
                            {conversation.lastMessage && (
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-muted-foreground">
                                  {conversation.lastMessage.user?.name === 'KOLMO' ? 'You:' : 'Customer:'}
                                </span>
                                <span className="text-muted-foreground truncate">
                                  {truncateMessage(conversation.lastMessage.text)}
                                </span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {conversation.memberCount} members
                          </Badge>
                          <Link 
                            href={`/quotes/${conversation.quoteInfo?.id}`}
                            className="inline-flex"
                          >
                            <Button size="sm" variant="outline">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Chat
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'monitoring' && <ChatMonitoring />}
    </div>
  );
};