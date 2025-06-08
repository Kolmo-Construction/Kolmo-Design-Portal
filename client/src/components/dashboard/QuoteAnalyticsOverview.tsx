import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  Users, 
  Clock, 
  Mouse, 
  TrendingUp,
  Activity,
  BarChart3
} from "lucide-react";

interface DashboardAnalytics {
  summary: {
    totalViews: number;
    uniqueSessions: number;
    avgTimeOnPage: number;
    avgScrollDepth: number;
    recentViews24h: number;
  };
  topQuotes: Array<{
    quoteId: number;
    views: number;
  }>;
}

export default function QuoteAnalyticsOverview() {
  const { data: analytics, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#db973c]" />
            Quote Analytics Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-32 bg-gray-200 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#db973c]" />
            Quote Analytics Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">No analytics data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#db973c]" />
          Quote Analytics Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-center mb-2">
              <Eye className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{analytics.summary.totalViews}</p>
            <p className="text-sm text-gray-600">Total Views</p>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{analytics.summary.uniqueSessions}</p>
            <p className="text-sm text-gray-600">Unique Visitors</p>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-100">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatDuration(analytics.summary.avgTimeOnPage)}
            </p>
            <p className="text-sm text-gray-600">Avg. Time on Page</p>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-orange-50 border border-orange-100">
            <div className="flex items-center justify-center mb-2">
              <Mouse className="h-6 w-6 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{analytics.summary.avgScrollDepth}%</p>
            <p className="text-sm text-gray-600">Avg. Scroll Depth</p>
          </div>

          <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-100">
            <div className="flex items-center justify-center mb-2">
              <Activity className="h-6 w-6 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{analytics.summary.recentViews24h}</p>
            <p className="text-sm text-gray-600">Views (24h)</p>
          </div>
        </div>

        {/* Top Performing Quotes */}
        {analytics.topQuotes.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#db973c]" />
              Top Performing Quotes
            </h4>
            <div className="space-y-2">
              {analytics.topQuotes.map((quote, index) => (
                <div key={quote.quoteId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-white">
                      #{index + 1}
                    </Badge>
                    <span className="font-medium">Quote #{quote.quoteId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-500" />
                    <span className="font-semibold text-[#db973c]">{quote.views} views</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}