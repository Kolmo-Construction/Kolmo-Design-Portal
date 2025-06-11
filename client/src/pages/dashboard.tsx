import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { ChatDashboard } from "@/components/dashboard/ChatDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Users,
  Activity,
  ArrowRight,
  DollarSign,
  Calendar,
  BarChart3
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  
  // Fetch quotes data
  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ["/api/quotes"],
  });

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/messages"],
  });

  // Fetch analytics dashboard data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/analytics/dashboard"],
  });

  // Type-safe quote and message arrays
  const quotesArray = Array.isArray(quotes) ? quotes : [];
  const messagesArray = Array.isArray(messages) ? messages : [];

  // Calculate dashboard metrics
  const totalQuotes = quotesArray.length;
  const pendingQuotes = quotesArray.filter((q: any) => q.status === 'draft').length;
  const sentQuotes = quotesArray.filter((q: any) => q.status === 'sent').length;
  const unreadMessages = messagesArray.filter((m: any) => !m.isRead).length;

  return (
    <div className="flex h-screen bg-gray-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-6 pt-20 overflow-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#3d4552] mb-2">
            Welcome back, {user?.firstName || "User"}
          </h1>
          <p className="text-gray-600">
            Manage your quotes, track analytics, and respond to customer chats
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-[#db973c]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Quotes</CardTitle>
              <FileText className="h-4 w-4 text-[#4a6670]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#3d4552]">{totalQuotes}</div>
              <p className="text-xs text-gray-500">
                {pendingQuotes} pending • {sentQuotes} sent
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#4a6670]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-[#4a6670]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#3d4552]">{unreadMessages}</div>
              <p className="text-xs text-gray-500">
                Unread messages
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#db973c]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Quote Views</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#4a6670]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#3d4552]">
                {(analytics as any)?.summary?.totalViews || 0}
              </div>
              <p className="text-xs text-gray-500">
                Total views this month
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#4a6670]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Sessions</CardTitle>
              <Activity className="h-4 w-4 text-[#4a6670]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#3d4552]">
                {(analytics as any)?.summary?.uniqueSessions || 0}
              </div>
              <p className="text-xs text-gray-500">
                Unique sessions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-[#3d4552] flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/quotes/create">
                  <Button className="w-full bg-[#db973c] hover:bg-[#c8862b] text-white">
                    <FileText className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                </Link>
                <Link href="/quotes">
                  <Button variant="outline" className="w-full border-[#4a6670] text-[#4a6670] hover:bg-[#4a6670] hover:text-white">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View All Quotes
                  </Button>
                </Link>
                <Link href="/messages">
                  <Button variant="outline" className="w-full border-[#4a6670] text-[#4a6670] hover:bg-[#4a6670] hover:text-white">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Messages
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="outline" className="w-full border-[#4a6670] text-[#4a6670] hover:bg-[#4a6670] hover:text-white">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#3d4552] flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Recent Quotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : quotesArray.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No quotes yet</p>
                  <Link href="/quotes/create">
                    <Button size="sm" className="mt-2 bg-[#db973c] hover:bg-[#c8862b] text-white">
                      Create First Quote
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotesArray.slice(0, 3).map((quote: any) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#3d4552] truncate">{quote.quoteNumber}</p>
                        <p className="text-xs text-gray-500 truncate">{quote.title}</p>
                      </div>
                      <Badge 
                        variant={quote.status === 'sent' ? 'default' : 'secondary'}
                        className={quote.status === 'sent' ? 'bg-[#4a6670] text-white hover:bg-[#3d4552]' : 'bg-gray-100 text-gray-600'}
                      >
                        {quote.status}
                      </Badge>
                    </div>
                  ))}
                  <Link href="/quotes">
                    <Button variant="link" className="w-full text-[#4a6670] hover:text-[#3d4552] p-0">
                      View all quotes <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Messages Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#3d4552] flex items-center justify-between">
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Recent Messages
                </div>
                {unreadMessages > 0 && (
                  <Badge className="bg-[#db973c] text-white">
                    {unreadMessages} new
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : messagesArray.length === 0 ? (
                <div className="text-center py-6">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messagesArray.slice(0, 3).map((message: any) => (
                    <div key={message.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-sm text-[#3d4552]">{message.subject || 'No Subject'}</p>
                        {!message.isRead && (
                          <Badge className="bg-[#db973c] text-white text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {message.createdAt ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true }) : 'Recently'}
                      </p>
                    </div>
                  ))}
                  <Link href="/messages">
                    <Button variant="link" className="w-full text-[#4a6670] hover:text-[#3d4552] p-0">
                      View all messages <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#3d4552] flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Analytics Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="space-y-4">
                  <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                  <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                  <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Time on Page</span>
                    <span className="font-medium text-[#3d4552]">
                      {(analytics as any)?.summary?.avgTimeOnPage || 0}s
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Scroll Depth</span>
                    <span className="font-medium text-[#3d4552]">
                      {(analytics as any)?.summary?.avgScrollDepth || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Views</span>
                    <span className="font-medium text-[#3d4552]">
                      {(analytics as any)?.summary?.totalViews || 0}
                    </span>
                  </div>
                  <Link href="/analytics">
                    <Button variant="link" className="w-full text-[#4a6670] hover:text-[#3d4552] p-0">
                      View detailed analytics <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Centralized Chat Management */}
        <div className="mb-8">
          <ChatDashboard />
        </div>
      </main>
    </div>
  );
}