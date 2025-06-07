import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, 
  Clock, 
  Mouse, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Globe, 
  MapPin, 
  Calendar,
  TrendingUp,
  Users,
  Activity
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface AnalyticsSummary {
  totalViews: number;
  uniqueSessions: number;
  totalTimeOnPage: number;
  avgScrollDepth: number;
}

interface ViewSession {
  id: number;
  sessionId: string;
  deviceFingerprint?: string;
  customerEmail?: string;
  customerName?: string;
  sectionsViewed?: string[];
  actionsPerformed?: any[];
  pageViews: number;
  totalDuration?: number;
  maxScrollDepth?: number;
  lastActivity: string;
  createdAt: string;
}

interface DeviceStats {
  deviceType: string;
  browser: string;
  operatingSystem: string;
  count: number;
}

interface GeoStats {
  country: string;
  city: string;
  count: number;
}

interface AnalyticsEvent {
  id: number;
  event: string;
  eventData?: any;
  sessionId: string;
  deviceType?: string;
  browser?: string;
  timeOnPage?: number;
  scrollDepth?: number;
  createdAt: string;
}

export default function QuoteAnalyticsDashboard({ quoteId }: { quoteId: number }) {
  const [selectedTab, setSelectedTab] = useState("overview");

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: [`/api/quotes/${quoteId}/analytics/summary`],
    enabled: !!quoteId,
  });

  const { data: events } = useQuery({
    queryKey: [`/api/quotes/${quoteId}/analytics/details`],
    enabled: !!quoteId && selectedTab === "events",
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Analytics...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No analytics data available for this quote.</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, sessions, deviceStats, geoStats } = analyticsData;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#db973c]" />
            Quote Analytics Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 rounded-lg bg-blue-50">
              <div className="flex items-center justify-center mb-2">
                <Eye className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{summary.totalViews}</p>
              <p className="text-sm text-gray-600">Total Views</p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-green-50">
              <div className="flex items-center justify-center mb-2">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">{summary.uniqueSessions}</p>
              <p className="text-sm text-gray-600">Unique Visitors</p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {formatDuration(Math.round(summary.totalTimeOnPage / summary.uniqueSessions) || 0)}
              </p>
              <p className="text-sm text-gray-600">Avg. Time</p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50">
              <div className="flex items-center justify-center mb-2">
                <Activity className="h-8 w-8 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {Math.round(summary.avgScrollDepth)}%
              </p>
              <p className="text-sm text-gray-600">Avg. Scroll</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Sessions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Viewing Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions?.map((session: ViewSession) => {
                  const DeviceIcon = getDeviceIcon(session.deviceFingerprint?.split('|')[0] || '');
                  return (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <DeviceIcon className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              {session.customerName || 'Anonymous'}
                            </span>
                            {session.customerEmail && (
                              <Badge variant="secondary">{session.customerEmail}</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {session.pageViews} views
                            </span>
                            {session.totalDuration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(session.totalDuration)}
                              </span>
                            )}
                            {session.maxScrollDepth && (
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {session.maxScrollDepth}% scrolled
                              </span>
                            )}
                          </div>
                          
                          {session.sectionsViewed && session.sectionsViewed.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {session.sectionsViewed.map((section, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {section}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right text-sm text-gray-500">
                          <p>{new Date(session.lastActivity).toLocaleDateString()}</p>
                          <p>{new Date(session.lastActivity).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device & Browser Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deviceStats?.map((stat: DeviceStats, index: number) => {
                  const DeviceIcon = getDeviceIcon(stat.deviceType);
                  const percentage = Math.round((stat.count / summary.totalViews) * 100);
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <DeviceIcon className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium">{stat.deviceType}</p>
                          <p className="text-sm text-gray-600">
                            {stat.browser} • {stat.operatingSystem}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{stat.count} views</p>
                        <p className="text-sm text-gray-600">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {geoStats?.map((stat: GeoStats, index: number) => {
                  const percentage = Math.round((stat.count / summary.totalViews) * 100);
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium">{stat.city || 'Unknown City'}</p>
                          <p className="text-sm text-gray-600">{stat.country || 'Unknown Country'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{stat.count} views</p>
                        <p className="text-sm text-gray-600">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events?.map((event: AnalyticsEvent) => (
                  <div key={event.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium capitalize">{event.event.replace('_', ' ')}</p>
                        {event.eventData && (
                          <p className="text-sm text-gray-600 mt-1">
                            {JSON.stringify(event.eventData)}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          {event.deviceType && <span>{event.deviceType}</span>}
                          {event.browser && <span>{event.browser}</span>}
                          {event.timeOnPage && <span>{formatDuration(event.timeOnPage)}</span>}
                          {event.scrollDepth && <span>{event.scrollDepth}% scrolled</span>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{new Date(event.createdAt).toLocaleDateString()}</p>
                        <p>{new Date(event.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}