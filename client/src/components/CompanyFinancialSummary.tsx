import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react";

interface CompanyFinancialSummaryProps {
  summary?: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    profitMargin: number;
  };
  isLoading?: boolean;
}

export default function CompanyFinancialSummary({
  summary,
  isLoading = false
}: CompanyFinancialSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 animate-pulse">
        {[1, 2, 3, 4].map((item) => (
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

  // Don't show "no data" message - just render with zero values if summary exists but is empty
  if (!summary) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const isProfitable = summary.totalProfit >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {/* Total Revenue Card */}
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(summary.totalRevenue)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                All-time paid invoices
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Expenses Card */}
      <Card className="border-l-4 border-l-red-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(summary.totalExpenses)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Receipts + Labor costs
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Profit Card */}
      <Card className={`border-l-4 ${isProfitable ? 'border-l-green-500' : 'border-l-red-500'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600">Net Profit</p>
              <p className={`text-2xl font-bold mt-1 ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.totalProfit)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Revenue - Expenses
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className={`h-12 w-12 rounded-full ${isProfitable ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
                <TrendingUp className={`h-6 w-6 ${isProfitable ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit Margin Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600">Profit Margin</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatPercent(summary.profitMargin)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Company-wide average
              </p>
            </div>
            <div className="ml-4 flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
