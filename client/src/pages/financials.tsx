import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import FinancialSummary from "@/components/FinancialSummary";
import { Project, Invoice, Payment } from "@shared/schema";

// Budget tracking interfaces
interface Expense {
  id: string;
  projectId: number;
  amount: number;
  category: string;
  description: string;
  date: string;
  merchant: string;
  receipt?: string;
  status: 'pending' | 'approved' | 'reimbursed';
}

interface ProjectBudgetTracking {
  projectId: number;
  projectName: string;
  totalBudget: number;
  totalExpenses: number;
  remainingBudget: number;
  budgetUtilization: number;
  expenses: Expense[];
}

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
  CreditCard,
  FileText,
  Download,
  CircleDollarSign,
  Loader2,
  ArrowDownUp,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  DollarSign
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

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all invoices across all projects
  const { 
    data: allInvoices = [],
    isLoading: isLoadingInvoices 
  } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    enabled: projects.length > 0,
  });

  // Fetch all payments across all invoices
  const { 
    data: allPayments = [],
    isLoading: isLoadingPayments 
  } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: allInvoices.length > 0,
  });

  // Fetch budget tracking data
  const {
    data: budgetTrackingData = [],
    isLoading: isLoadingBudgetData,
    refetch: refetchBudgetData
  } = useQuery<ProjectBudgetTracking[]>({
    queryKey: ["/api/expense-tracking/budget"],
  });

  // Filter projects based on the selected filter
  const filteredProjects = projects.filter(project =>
    projectFilter === "all" || project.id.toString() === projectFilter
  );

  // Filter budget tracking data based on selected project
  const filteredBudgetData = budgetTrackingData.filter(project =>
    projectFilter === "all" || project.projectId.toString() === projectFilter
  );
  
  // Calculate total budget from the *filtered* projects
  const totalBudget = filteredProjects.reduce((sum, project) => {
    return sum + Number(project.totalBudget);
  }, 0);

  // Calculate total expenses across filtered projects
  const totalExpenses = filteredBudgetData.reduce((sum, project) => sum + project.totalExpenses, 0);

  // Filter invoices based on project
  const filteredInvoices = allInvoices.filter(inv => 
    projectFilter === "all" || (inv.projectId && inv.projectId.toString() === projectFilter)
  );

  // Filter payments based on filtered invoices
  const filteredPayments = allPayments.filter(payment =>
    filteredInvoices.some(inv => inv.id === payment.invoiceId)
  );

  // Format date
  const formatDate = (dateString: string | Date) => {
    return format(new Date(dateString), "MMM d, yyyy");
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
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Financial Overview</h1>
          <p className="text-slate-600">Track budgets, invoices, and payments for your construction projects</p>
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
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Expense Tracking Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Budget Tracking
                </CardTitle>
                <CardDescription>
                  Track project expenses against budgets with AI-powered receipt scanning
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchBudgetData()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Data
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Budget Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Total Budget</p>
                        <p className="text-2xl font-bold text-slate-900">
                          ${totalBudget.toLocaleString()}
                        </p>
                      </div>
                      <CircleDollarSign className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Total Expenses</p>
                        <p className="text-2xl font-bold text-slate-900">
                          ${totalExpenses.toLocaleString()}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Remaining Budget</p>
                        <p className="text-2xl font-bold text-slate-900">
                          ${(totalBudget - totalExpenses).toLocaleString()}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Project Budget Details */}
              {filteredBudgetData.length > 0 ? (
                <div className="space-y-4">
                  {filteredBudgetData.map((project) => (
                    <Card key={project.projectId} className="border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{project.projectName}</CardTitle>
                          <Badge variant={project.budgetUtilization > 90 ? "destructive" : project.budgetUtilization > 75 ? "default" : "secondary"}>
                            {project.budgetUtilization.toFixed(1)}% Used
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Budget Progress Bar */}
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Budget Usage</span>
                              <span>${project.totalExpenses.toLocaleString()} / ${project.totalBudget.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  project.budgetUtilization > 90 ? 'bg-red-500' :
                                  project.budgetUtilization > 75 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(project.budgetUtilization, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Recent Expenses */}
                          {project.expenses && project.expenses.length > 0 && (
                            <div>
                              <h4 className="font-medium text-slate-800 mb-2">Recent Expenses</h4>
                              <div className="space-y-2">
                                {project.expenses.slice(0, 3).map((expense) => (
                                  <div key={expense.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{expense.description}</p>
                                      <p className="text-xs text-slate-500">{expense.merchant} • {expense.category}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium">${expense.amount.toLocaleString()}</p>
                                      <p className="text-xs text-slate-500">{formatDate(expense.date)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  <p className="text-sm">No expense data available yet.</p>
                  <p className="text-xs mt-1">Upload receipts to track project expenses.</p>
                </div>
              )}
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
                ) : (
                  <div className="space-y-4">
                    {filteredInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{invoice.invoiceNumber}</h3>
                          <p className="text-sm text-slate-600">
                            Amount: ${Number(invoice.amount).toLocaleString()}
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
                ) : (
                  <div className="space-y-4">
                    {filteredPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">Payment #{payment.id}</h3>
                          <p className="text-sm text-slate-600">
                            Amount: ${Number(payment.amount).toLocaleString()}
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