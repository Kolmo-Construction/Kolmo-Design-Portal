import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Users, 
  MessageCircle, 
  Settings, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionStats {
  current: number;
  max: number;
  utilizationPercent: number;
  connections: Array<{
    userId: string;
    channelId: string;
    duration: number;
  }>;
}

interface UsageStats {
  totalChannels: number;
  activeConnections: number;
  maxConnections: number;
  utilizationPercent: number;
  nearLimit: boolean;
  channels: Array<{
    id: string;
    type: string;
    memberCount: number;
    lastActivity: string;
  }>;
}

export const ChatMonitoring: React.FC = () => {
  const [maxConnectionsInput, setMaxConnectionsInput] = useState<string>('25');
  const queryClient = useQueryClient();

  // Query connection stats
  const { data: connectionStats, isLoading: statsLoading } = useQuery<ConnectionStats>({
    queryKey: ['/api/chat/connections/stats'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false, // Disable auto-refresh
  });

  // Query usage statistics
  const { data: usageStats, isLoading: usageLoading } = useQuery<UsageStats>({
    queryKey: ['/api/chat/usage'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false, // Disable auto-refresh
  });

  // Set connection limit mutation
  const setLimitMutation = useMutation({
    mutationFn: async (maxConnections: number) => {
      const response = await fetch('/api/chat/connections/limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxConnections })
      });
      if (!response.ok) throw new Error('Failed to update limit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/connections/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/usage'] });
    }
  });

  // Cleanup connections mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/chat/connections/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to cleanup connections');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/connections/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/usage'] });
    }
  });

  // Update input when stats change
  useEffect(() => {
    if (connectionStats) {
      setMaxConnectionsInput(connectionStats.max.toString());
    }
  }, [connectionStats]);

  const handleSetLimit = () => {
    const limit = parseInt(maxConnectionsInput);
    if (limit > 0) {
      setLimitMutation.mutate(limit);
    }
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (percent: number) => {
    if (percent >= 90) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (percent >= 80) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chat Connection Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor and manage your Stream Chat concurrent connections
          </p>
        </div>
        <Button 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/chat/connections/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/chat/usage'] });
          }}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectionStats ? connectionStats.current : '---'}
            </div>
            <p className="text-xs text-muted-foreground">
              of {connectionStats ? connectionStats.max : '---'} max
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats ? usageStats.totalChannels : '---'}
            </div>
            <p className="text-xs text-muted-foreground">
              Active chat channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">
                {connectionStats ? connectionStats.utilizationPercent : '---'}%
              </div>
              {connectionStats && getStatusIcon(connectionStats.utilizationPercent)}
            </div>
            <Progress 
              value={connectionStats ? connectionStats.utilizationPercent : 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge 
                variant={usageStats?.nearLimit ? "destructive" : "default"}
                className="text-xs"
              >
                {usageStats?.nearLimit ? "Near Limit" : "Normal"}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Connection status
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Settings</CardTitle>
          <CardDescription>
            Configure your concurrent connection limits and cleanup settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="maxConnections">Max Concurrent Connections</Label>
              <Input
                id="maxConnections"
                type="number"
                value={maxConnectionsInput}
                onChange={(e) => setMaxConnectionsInput(e.target.value)}
                min="1"
                max="1000"
              />
            </div>
            <Button 
              onClick={handleSetLimit}
              disabled={setLimitMutation.isPending}
            >
              {setLimitMutation.isPending ? 'Updating...' : 'Update Limit'}
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {cleanupMutation.isPending ? 'Cleaning...' : 'Cleanup Stale Connections'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Remove connections older than 30 minutes
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle>Active Connections</CardTitle>
          <CardDescription>
            Current users connected to chat channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="text-center py-4">Loading connections...</div>
          ) : connectionStats?.connections && connectionStats.connections.length > 0 ? (
            <div className="space-y-2">
              {connectionStats.connections.map((conn, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{conn.userId}</p>
                      <p className="text-sm text-muted-foreground">{conn.channelId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(Date.now() - conn.duration), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No active connections
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Information */}
      <Card>
        <CardHeader>
          <CardTitle>Chat Channels</CardTitle>
          <CardDescription>
            Overview of all chat channels in your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="text-center py-4">Loading channels...</div>
          ) : usageStats?.channels && usageStats.channels.length > 0 ? (
            <div className="space-y-2">
              {usageStats.channels.map((channel, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{channel.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {channel.memberCount} members • {channel.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {channel.lastActivity ? 
                      formatDistanceToNow(new Date(channel.lastActivity), { addSuffix: true }) : 
                      'No activity'
                    }
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No channels found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};