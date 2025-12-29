import { Invoice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FinancialSummaryProps {
  totalBudget: number;
  invoices: Invoice[];
  projects: any[];
  isLoading?: boolean;
}

export default function FinancialSummary({ totalBudget, invoices, projects, isLoading = false }: FinancialSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map((item) => (
          <Card key={item}>
            <CardContent className="p-4">
              <div className="h-4 w-1/3 bg-slate-200 rounded mb-2"></div>
              <div className="h-8 w-2/3 bg-slate-200 rounded mb-2"></div>
              <div className="h-3 w-full bg-slate-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate total invoiced and remaining budget
  // Only count non-draft invoices to match actual issued invoices
  const totalInvoiced = invoices
    .filter(invoice => invoice.status !== 'draft')
    .reduce((sum, invoice) => {
      return sum + Number(invoice.amount);
    }, 0);
  
  const remainingBudget = totalBudget - totalInvoiced;
  
  // Calculate percentage of budget invoiced
  const percentInvoiced = totalBudget > 0 ? (totalInvoiced / totalBudget) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardContent className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm font-medium text-slate-500">Total Budget</p>
          <p className="text-2xl font-semibold text-slate-800">${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-2 text-xs text-slate-500">For all active projects</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm font-medium text-slate-500">Total Invoiced</p>
          <p className="text-2xl font-semibold text-slate-800">${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-2 text-xs text-slate-500">{percentInvoiced.toFixed(1)}% of total budget</div>
          <Progress value={percentInvoiced} className="mt-2 h-1.5" />
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm font-medium text-slate-500">Remaining Budget</p>
          <p className="text-2xl font-semibold text-green-600">${remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-2 text-xs text-slate-500">{(100 - percentInvoiced).toFixed(1)}% of total budget</div>
        </CardContent>
      </Card>
    </div>
  );
}
