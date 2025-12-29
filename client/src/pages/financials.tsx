import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import FinancialSummary from "@/components/FinancialSummary";
import CompanyFinancialSummary from "@/components/CompanyFinancialSummary";
import FinancialTrendCharts from "@/components/FinancialTrendCharts";
import ProfitByProjectType from "@/components/ProfitByProjectType";
import ProjectFinancialTable from "@/components/ProjectFinancialTable";
import { useCompanyFinancials } from "@/hooks/useCompanyFinancials";
import { Project, Invoice, Payment } from "@shared/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Loader2,
  TrendingUp,
  CreditCard
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Financials() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Fetch company-wide financial data
  const { data: companyFinancials, isLoading: isLoadingCompany } = useCompanyFinancials();

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all invoices across all projects
  const {
    data: invoicesData,
    isLoading: isLoadingInvoices
  } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/invoices"],
    enabled: projects.length > 0,
  });

  // Extract invoices array from response
  const allInvoices = invoicesData?.invoices || [];

  // Fetch all payments across all invoices
  const { 
    data: allPayments = [],
    isLoading: isLoadingPayments 
  } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: allInvoices.length > 0,
  });

  // Budget tracking data removed - expense tracking feature not implemented
  // Keeping invoice-based financial tracking only

  // Filter projects based on the selected filter - with defensive guards
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeAllInvoices = Array.isArray(allInvoices) ? allInvoices : [];
  const safeAllPayments = Array.isArray(allPayments) ? allPayments : [];

  const filteredProjects = safeProjects.filter(project =>
    projectFilter === "all" || project.id.toString() === projectFilter
  );


  // Calculate total budget from the *filtered* projects
  const totalBudget = filteredProjects.reduce((sum, project) => {
    return sum + Number(project.totalBudget);
  }, 0);

  // Filter invoices based on project and exclude drafts for accurate financial reporting
  const filteredInvoices = safeAllInvoices.filter(inv =>
    (projectFilter === "all" || (inv.projectId && inv.projectId.toString() === projectFilter)) &&
    inv.status !== 'draft'
  );

  // Filter payments based on filtered invoices
  const filteredPayments = safeAllPayments.filter(payment =>
    filteredInvoices.some(inv => inv.id === payment.invoiceId)
  );

  // Format date with error handling
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, "MMM d, yyyy");
    } catch {
      return 'N/A';
    }
  };

  // Prepare data for charts
  const statusCounts = {
    draft: filteredInvoices.filter(i => i.status === "draft").length,
    pending: filteredInvoices.filter(i => i.status === "pending").length,
    paid: filteredInvoices.filter(i => i.status === "paid").length,
    overdue: filteredInvoices.filter(i => i.status === "overdue").length,
  };

  const pieChartData = [
    { name: "Draft", value: statusCounts.draft, color: "#3b82f6" },
    { name: "Pending", value: statusCounts.pending, color: "#facc15" },
    { name: "Paid", value: statusCounts.paid, color: "#16a34a" },
    { name: "Overdue", value: statusCounts.overdue, color: "#dc2626" },
  ].filter(item => item.value > 0);

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Company Financial Health Dashboard</h1>
          <p className="text-slate-600">Comprehensive financial overview across all projects</p>
        </div>

        {/* Company-Wide Summary Cards */}
        <section className="mb-8">
          <CompanyFinancialSummary
            summary={companyFinancials?.summary}
            isLoading={isLoadingCompany}
          />
        </section>

        {/* Financial Trends */}
        <section className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Financial Trends</CardTitle>
              <CardDescription>Historical revenue, expenses, and profit over time</CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialTrendCharts
                trends={companyFinancials?.trends}
                isLoading={isLoadingCompany}
              />
            </CardContent>
          </Card>
        </section>

        {/* Profit by Project Type */}
        <section className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Profit Analysis by Project Type</CardTitle>
              <CardDescription>Average profit margins and performance across different project types</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfitByProjectType
                byProjectType={companyFinancials?.byProjectType}
                isLoading={isLoadingCompany}
              />
            </CardContent>
          </Card>
        </section>

        {/* Project Financial Breakdown */}
        <section className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Project Financial Breakdown</CardTitle>
              <CardDescription>Detailed profit and loss for each project</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectFinancialTable
                projects={companyFinancials?.byProject}
                isLoading={isLoadingCompany}
              />
            </CardContent>
          </Card>
        </section>

        {/* Divider */}
        <div className="my-12 border-t border-slate-200"></div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Legacy Financial Views</h2>
          <p className="text-slate-600 text-sm">Detailed invoice and payment management</p>
        </div>

        {/* Project Filter */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6">
            <div className="w-full sm:w-1/3">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Select Project</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {safeProjects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <div className="mb-6">
          <FinancialSummary 
            totalBudget={totalBudget}
            invoices={filteredInvoices}
            projects={filteredProjects}
          />
        </div>

        {/* Tabs for detailed financial data */}
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Management
                </CardTitle>
                <CardDescription>
                  View and manage all project invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingInvoices ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No invoices found for the selected filter</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{invoice.invoiceNumber || 'N/A'}</h3>
                          <p className="text-sm text-slate-600">
                            Amount: ${Number(invoice.amount || 0).toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-500">
                            Created: {formatDate(invoice.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={
                            invoice.status === "paid" ? "default" :
                            invoice.status === "pending" ? "secondary" :
                            invoice.status === "overdue" ? "destructive" : "outline"
                          }>
                            {invoice.status}
                          </Badge>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment History
                </CardTitle>
                <CardDescription>
                  Track all payments received
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No payments found for the selected filter</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">Payment #{payment.id}</h3>
                          <p className="text-sm text-slate-600">
                            Amount: ${Number(payment.amount || 0).toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-500">
                            Date: {formatDate(payment.paymentDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="default">
                            {payment.paymentMethod}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Financial Analytics
                </CardTitle>
                <CardDescription>
                  Visual insights into your financial data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Invoice Status Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-4">Summary Statistics</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span>Total Invoices:</span>
                          <span className="font-medium">{filteredInvoices.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Revenue:</span>
                          <span className="font-medium">
                            ${filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Payments Received:</span>
                          <span className="font-medium">
                            ${filteredPayments.reduce((sum, pay) => sum + Number(pay.amount), 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No financial data available for the selected filter
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}