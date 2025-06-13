import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth-unified';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClientNavigation } from '@/components/ClientNavigation';
import { 
  DollarSign, 
  FileText, 
  Calendar, 
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  projectName: string;
  description: string;
}

export default function ClientInvoices() {
  const { user } = useAuth();
  const params = useParams();
  const [location] = useLocation();
  
  // Detect if we're in project context (e.g., /project-details/:projectId/invoices)
  const projectId = params.projectId;
  const isProjectContext = projectId && location.includes('/project-details/');
  
  // Use project-specific endpoint if in project context, otherwise use global client endpoint
  const apiEndpoint = isProjectContext 
    ? `/api/projects/${projectId}/invoices`
    : '/api/client/invoices';

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: [apiEndpoint, 'v4', Date.now()], // Force fresh request with timestamp
    enabled: !!user && (user.role === 'client' || user.role === 'admin'),
    staleTime: 0, // Disable caching temporarily for debugging
    gcTime: 0 // Disable cache storage (renamed from cacheTime in v5)
  });

  // Get project name for header when in project context
  const { data: project } = useQuery<{ id: number; name: string }>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId && !!user
  });

  if (!user || (user.role !== 'client' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <ClientNavigation />
        <div className="container mx-auto px-6 pt-24">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="pt-6 text-center">
              <DollarSign className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">You don't have access to view invoices.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'sent':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'sent':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <ClientNavigation />
      
      <div className="container mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {isProjectContext ? `${project?.name || 'Project'} Invoices` : 'My Invoices'}
          </h1>
          <p className="text-muted-foreground">
            {isProjectContext 
              ? `View invoices for this project only`
              : 'View and manage your project invoices and payment history'
            }
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <Card className="border-accent/20">
            <CardContent className="pt-8 pb-8 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invoices Yet</h3>
              <p className="text-muted-foreground">
                Your project invoices will appear here once they are generated.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="border-accent/20 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <DollarSign className="h-5 w-5 text-accent" />
                        {invoice.invoiceNumber}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {invoice.projectName}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={getStatusColor(invoice.status)}
                    >
                      <div className="flex items-center gap-1">
                        {getStatusIcon(invoice.status)}
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </div>
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Amount</p>
                      <p className="text-lg font-semibold">${parseFloat(invoice.amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(invoice.issueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                      <p className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {invoice.description && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{invoice.description}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Link to={`/invoices/${invoice.id}/view`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}