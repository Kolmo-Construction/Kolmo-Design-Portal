import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Search,
  Filter,
  MapPin,
  Calendar,
  Mail,
  Phone,
  ExternalLink,
  CheckCircle,
  UserCheck,
  Award,
  Archive,
  FileText,
  ArrowLeft,
  Home,
  TrendingUp,
  Target,
  Star,
  MessageSquare,
  MailPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { theme } from '@/config/theme';
import type { Lead } from '@shared/schema';

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-purple-100 text-purple-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-gray-100 text-gray-600'
};

const statusIcons = {
  new: <Star className="h-3 w-3" />,
  contacted: <MessageSquare className="h-3 w-3" />,
  qualified: <Award className="h-3 w-3" />,
  converted: <CheckCircle className="h-3 w-3" />,
  archived: <Archive className="h-3 w-3" />
};

const sourceColors = {
  manual: 'bg-gray-100 text-gray-700',
  web_search: 'bg-indigo-100 text-indigo-700',
  social_media: 'bg-pink-100 text-pink-700',
  thumbtack: 'bg-orange-100 text-orange-700',
  homedepot: 'bg-amber-100 text-amber-700',
  nextdoor: 'bg-green-100 text-green-700',
  referral: 'bg-teal-100 text-teal-700'
};

export default function LeadsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailFrom, setEmailFrom] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: leadsResponse,
    isLoading,
    error
  } = useQuery<{ success: boolean; leads: Lead[] }>({
    queryKey: ['/api/leads'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const leads = leadsResponse?.leads || [];

  // Mutations for lead actions
  const markContactedMutation = useMutation({
    mutationFn: async (leadId: number) => {
      return await apiRequest("POST", `/api/leads/${leadId}/contacted`);
    },
    onSuccess: () => {
      toast({
        title: "Lead Updated",
        description: "Lead marked as contacted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number; data: Partial<Lead> }) => {
      return await apiRequest("PATCH", `/api/leads/${leadId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Lead Updated",
        description: "Lead updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead",
        variant: "destructive",
      });
    },
  });

  const parseEmailMutation = useMutation({
    mutationFn: async (emailData: { from: string; subject: string; body: string }) => {
      return await apiRequest("POST", "/api/leads/parse-email", emailData);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Lead Created",
        description: `Successfully created lead from ${data.lead.source}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setEmailDialogOpen(false);
      setEmailFrom('');
      setEmailSubject('');
      setEmailBody('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to parse email",
        variant: "destructive",
      });
    },
  });

  // Filter leads
  const filteredLeads = leads
    .filter(lead => {
      const matchesSearch = !searchTerm ||
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contactInfo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contentSnippet?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    })
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  // Calculate stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
    avgConfidence: leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + (l.confidenceScore || 0), 0) / leads.length)
      : 0
  };

  const handleUpdateStatus = (leadId: number, newStatus: string) => {
    updateLeadMutation.mutate({ leadId, data: { status: newStatus as any } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="container mx-auto px-6 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <Users className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Error</h2>
              <p className="text-muted-foreground">Unable to load leads. Please check your permissions.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            style={{ color: theme.colors.textMuted }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="text-sm" style={{ color: theme.colors.textMuted }}>
          <Link href="/" className="hover:underline">
            <Home className="h-4 w-4 inline mr-1" />
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span style={{ color: theme.colors.primary }}>Sales Leads</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: theme.colors.primary }}>
            Sales Leads
          </h1>
          <p style={{ color: theme.colors.textMuted }}>
            Track and manage potential customers discovered by AI
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <MailPlus className="h-4 w-4 mr-2" />
                Import Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Lead from Email</DialogTitle>
                <DialogDescription>
                  Paste an email from Thumbtack, Home Depot Pro Referral, or Nextdoor to automatically create a lead
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">From (email address)</label>
                  <Input
                    placeholder="notifications@thumbtack.com"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    placeholder="New lead from John Smith for Kitchen Remodel"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email Body</label>
                  <Textarea
                    placeholder="Paste the full email content here..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => parseEmailMutation.mutate({ from: emailFrom, subject: emailSubject, body: emailBody })}
                  disabled={!emailBody || parseEmailMutation.isPending}
                >
                  {parseEmailMutation.isPending ? 'Parsing...' : 'Import Lead'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link href="/agent">
            <Button style={{ backgroundColor: theme.colors.primary }}>
              <Target className="h-4 w-4 mr-2" />
              Search for Leads
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-bold">{stats.new}</p>
              </div>
              <Star className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contacted</p>
                <p className="text-2xl font-bold">{stats.contacted}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Qualified</p>
                <p className="text-2xl font-bold">{stats.qualified}</p>
              </div>
              <Award className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="text-2xl font-bold">{stats.converted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">{stats.avgConfidence}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="web_search">Web Search</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
                <SelectItem value="thumbtack">Thumbtack</SelectItem>
                <SelectItem value="homedepot">Home Depot</SelectItem>
                <SelectItem value="nextdoor">Nextdoor</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Grid */}
      {filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leads found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by searching for leads using the AI agent'}
            </p>
            <Link href="/agent">
              <Button>
                <Target className="h-4 w-4 mr-2" />
                Search for Leads
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLeads.map((lead) => (
            <Card key={lead.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {/* Lead Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{lead.name}</h3>
                          <Badge className={statusColors[lead.status]}>
                            {statusIcons[lead.status]}
                            <span className="ml-1 capitalize">{lead.status}</span>
                          </Badge>
                          <Badge className={sourceColors[lead.source]} variant="outline">
                            {lead.source.replace('_', ' ')}
                          </Badge>
                          {lead.confidenceScore && (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {lead.confidenceScore}% confidence
                            </Badge>
                          )}
                        </div>

                        {/* Contact Info */}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {lead.contactInfo && (
                            <div className="flex items-center gap-1">
                              {lead.contactInfo.includes('@') ? (
                                <Mail className="h-4 w-4" />
                              ) : (
                                <Phone className="h-4 w-4" />
                              )}
                              <span>{lead.contactInfo}</span>
                            </div>
                          )}
                          {lead.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{lead.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Detected {format(new Date(lead.detectedAt), 'MMM d, yyyy')}</span>
                          </div>
                          {lead.sourceUrl && (
                            <a
                              href={lead.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              <span>View Source</span>
                            </a>
                          )}
                        </div>

                        {/* Content Snippet */}
                        {lead.contentSnippet && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {lead.contentSnippet}
                            </p>
                          </div>
                        )}

                        {/* Interest Tags */}
                        {lead.interestTags && lead.interestTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {lead.interestTags.map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Draft Response */}
                        {lead.draftResponse && (
                          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-900">AI Suggested Response</span>
                            </div>
                            <p className="text-sm text-blue-800 line-clamp-3">
                              {lead.draftResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    {lead.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markContactedMutation.mutate(lead.id)}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Mark Contacted
                      </Button>
                    )}
                    {lead.status === 'contacted' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(lead.id, 'qualified')}
                      >
                        <Award className="h-4 w-4 mr-1" />
                        Mark Qualified
                      </Button>
                    )}
                    {lead.status === 'qualified' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(lead.id, 'converted')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark Converted
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(lead.id, 'archived')}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Archive
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
