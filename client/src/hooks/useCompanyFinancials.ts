import { useQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { format, parse } from 'date-fns';
import type { Project, Invoice, Quote } from '@shared/schema';

interface ExpenseSummary {
  totalAmount: number;
  totalReceipts: number;
  byCategory: Array<{ category: string; amount: number; count: number }>;
  byVendor: Array<{ vendor: string; amount: number; count: number }>;
  verified: number;
  unverified: number;
}

interface LaborCosts {
  totalLaborCost: number;
  totalHours: number;
  entryCount: number;
}

interface ProjectFinancial {
  projectId: number;
  projectName: string;
  projectType: string;
  projectStatus: string;
  revenue: number;
  receiptExpenses: number;
  laborExpenses: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ProjectTypeMetrics {
  projectType: string;
  projectCount: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  avgProfitMargin: number;
}

interface CompanyFinancials {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    profitMargin: number;
  };
  trends: {
    byMonth: MonthlyTrend[];
  };
  byProjectType: ProjectTypeMetrics[];
  byProject: ProjectFinancial[];
}

export function useCompanyFinancials() {
  // Fetch all projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch all quotes to map project types
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ['/api/quotes'],
  });

  // Fetch all invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['/api/invoices'],
  });

  const allInvoices = invoicesData?.invoices || [];

  // Fetch all payments for monthly revenue tracking (by payment date)
  const { data: allPayments = [], isLoading: isLoadingPayments } = useQuery<any[]>({
    queryKey: ['/api/payments'],
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Fetch all time entries for monthly labor expense tracking
  const { data: allTimeEntries = [], isLoading: isLoadingTimeEntries } = useQuery<any[]>({
    queryKey: ['/api/time/entries'],
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Fetch expenses for each project
  const expenseQueries = useQueries({
    queries: projects.map(project => ({
      queryKey: [`/api/projects/${project.id}/expenses`],
      enabled: !!projects.length,
      retry: 1,
      // Return empty object if no expenses
      select: (data: ExpenseSummary | null) => data || { totalAmount: 0, totalReceipts: 0, byCategory: [], byVendor: [], verified: 0, unverified: 0 }
    }))
  });

  // Fetch individual receipts for each project (for monthly tracking)
  const receiptQueries = useQueries({
    queries: projects.map(project => ({
      queryKey: [`/api/projects/${project.id}/receipts`],
      enabled: !!projects.length,
      retry: 1,
      select: (data: any) => Array.isArray(data) ? data : (data?.receipts || [])
    }))
  });

  // Fetch labor costs for each project
  const laborQueries = useQueries({
    queries: projects.map(project => ({
      queryKey: [`/api/time/project/${project.id}/labor-costs`],
      enabled: !!projects.length,
      retry: 1,
      // Return empty object if no labor costs
      select: (data: LaborCosts | null) => data || { totalLaborCost: 0, totalHours: 0, entryCount: 0 }
    }))
  });

  // More robust loading state - ensure all queries are complete
  const isLoadingExpenses = expenseQueries.some(q => q.isLoading);
  const isLoadingLabor = laborQueries.some(q => q.isLoading);
  const isLoadingReceipts = receiptQueries.some(q => q.isLoading);

  const isLoading = isLoadingProjects || isLoadingQuotes || isLoadingInvoices ||
    isLoadingPayments || isLoadingTimeEntries ||
    isLoadingExpenses || isLoadingLabor || isLoadingReceipts;

  const aggregatedData = useMemo(() => {
    // Only return null if we're still loading base data
    if (isLoadingProjects || isLoadingQuotes || isLoadingInvoices) {
      return null;
    }

    // If no projects, return empty structure instead of null
    if (!projects.length) {
      return {
        summary: {
          totalRevenue: 0,
          totalExpenses: 0,
          totalProfit: 0,
          profitMargin: 0
        },
        trends: { byMonth: [] },
        byProjectType: [],
        byProject: []
      } as CompanyFinancials;
    }

    // If nested queries are still loading, return null to keep showing loading state
    if (isLoadingExpenses || isLoadingLabor || isLoadingReceipts || isLoadingPayments || isLoadingTimeEntries) {
      return null;
    }

    // Create project type map
    const projectTypeMap = new Map<number, string>();
    projects.forEach(project => {
      if (project.originQuoteId) {
        const quote = quotes.find(q => q.id === project.originQuoteId);
        projectTypeMap.set(project.id, quote?.projectType || 'Unknown');
      } else {
        projectTypeMap.set(project.id, 'Unknown');
      }
    });

    // Calculate per-project financials
    const projectFinancials: ProjectFinancial[] = projects.map((project, index) => {
      const projectInvoices = allInvoices.filter(inv => inv.projectId === project.id);

      // Revenue = sum of paid invoices only
      const revenue = projectInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);

      // Expenses from receipts
      const expensesData = expenseQueries[index]?.data as ExpenseSummary;
      const receiptExpenses = expensesData?.totalAmount || 0;

      // Expenses from labor
      const laborData = laborQueries[index]?.data as LaborCosts;
      const laborExpenses = laborData?.totalLaborCost || 0;

      const totalExpenses = receiptExpenses + laborExpenses;
      const profit = revenue - totalExpenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        projectId: project.id,
        projectName: project.name,
        projectType: projectTypeMap.get(project.id) || 'Unknown',
        projectStatus: project.status,
        revenue,
        receiptExpenses,
        laborExpenses,
        totalExpenses,
        profit,
        profitMargin
      };
    });

    // Calculate company-wide summary
    const summary = {
      totalRevenue: projectFinancials.reduce((sum, p) => sum + p.revenue, 0),
      totalExpenses: projectFinancials.reduce((sum, p) => sum + p.totalExpenses, 0),
      totalProfit: projectFinancials.reduce((sum, p) => sum + p.profit, 0),
      profitMargin: 0
    };
    summary.profitMargin = summary.totalRevenue > 0
      ? (summary.totalProfit / summary.totalRevenue) * 100
      : 0;

    // Calculate monthly trends
    const monthlyRevenueMap = new Map<string, number>();
    const monthlyExpensesMap = new Map<string, number>();

    // Group revenue by month (from payment dates - when money was actually received)
    allPayments.forEach((payment: any) => {
      if (payment.paymentDate && payment.amount) {
        const monthKey = format(new Date(payment.paymentDate), 'yyyy-MM');
        const current = monthlyRevenueMap.get(monthKey) || 0;
        monthlyRevenueMap.set(monthKey, current + parseFloat(payment.amount.toString()));
      }
    });

    // Group receipt expenses by month (from receipt date)
    projects.forEach((project, index) => {
      const receipts = receiptQueries[index]?.data as any[];
      if (receipts && receipts.length > 0) {
        receipts.forEach((receipt: any) => {
          if (receipt.receiptDate && receipt.totalAmount) {
            const monthKey = format(new Date(receipt.receiptDate), 'yyyy-MM');
            const current = monthlyExpensesMap.get(monthKey) || 0;
            monthlyExpensesMap.set(monthKey, current + parseFloat(receipt.totalAmount.toString()));
          }
        });
      }
    });

    // Group labor expenses by month (from time entry start time)
    if (allTimeEntries && allTimeEntries.length > 0) {
      allTimeEntries.forEach((entry: any) => {
        if (entry.startTime && entry.laborCost) {
          const monthKey = format(new Date(entry.startTime), 'yyyy-MM');
          const current = monthlyExpensesMap.get(monthKey) || 0;
          monthlyExpensesMap.set(monthKey, current + parseFloat(entry.laborCost.toString()));
        }
      });
    }

    // Merge and sort monthly data
    const allMonths = new Set([
      ...Array.from(monthlyRevenueMap.keys()),
      ...Array.from(monthlyExpensesMap.keys())
    ]);

    const byMonth = Array.from(allMonths)
      .sort()
      .map(monthKey => {
        const revenue = monthlyRevenueMap.get(monthKey) || 0;
        const expenses = monthlyExpensesMap.get(monthKey) || 0;
        return {
          month: format(parse(monthKey, 'yyyy-MM', new Date()), 'MMM yyyy'),
          revenue,
          expenses,
          profit: revenue - expenses
        };
      });

    // Calculate by project type
    const projectTypeMap2 = new Map<string, {
      projectCount: number;
      totalRevenue: number;
      totalExpenses: number;
      totalProfit: number;
    }>();

    projectFinancials.forEach(pf => {
      const type = pf.projectType;
      const existing = projectTypeMap2.get(type) || {
        projectCount: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0
      };

      projectTypeMap2.set(type, {
        projectCount: existing.projectCount + 1,
        totalRevenue: existing.totalRevenue + pf.revenue,
        totalExpenses: existing.totalExpenses + pf.totalExpenses,
        totalProfit: existing.totalProfit + pf.profit
      });
    });

    const byProjectType = Array.from(projectTypeMap2.entries())
      .map(([type, data]) => ({
        projectType: type,
        projectCount: data.projectCount,
        totalRevenue: data.totalRevenue,
        totalExpenses: data.totalExpenses,
        totalProfit: data.totalProfit,
        avgProfitMargin: data.totalRevenue > 0
          ? (data.totalProfit / data.totalRevenue) * 100
          : 0
      }))
      .sort((a, b) => b.avgProfitMargin - a.avgProfitMargin);

    return {
      summary,
      trends: { byMonth },
      byProjectType,
      byProject: projectFinancials
    } as CompanyFinancials;
  }, [
    projects,
    quotes,
    allInvoices,
    allPayments,
    expenseQueries,
    laborQueries,
    receiptQueries,
    allTimeEntries,
    isLoadingProjects,
    isLoadingQuotes,
    isLoadingInvoices,
    isLoadingExpenses,
    isLoadingLabor,
    isLoadingReceipts,
    isLoadingPayments,
    isLoadingTimeEntries
  ]);

  return {
    data: aggregatedData,
    isLoading,
    error: expenseQueries.find(q => q.error)?.error ||
           laborQueries.find(q => q.error)?.error ||
           null
  };
}
