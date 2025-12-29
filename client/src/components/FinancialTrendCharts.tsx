import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface FinancialTrendChartsProps {
  trends?: {
    byMonth: MonthlyTrend[];
  };
  isLoading?: boolean;
}

export default function FinancialTrendCharts({
  trends,
  isLoading = false
}: FinancialTrendChartsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-80 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!trends || trends.byMonth.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No trend data available yet</p>
        <p className="text-sm mt-1">Financial trends will appear once you have invoice history</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Combined Trend Chart */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Financial Trends Over Time
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={trends.byMonth}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px'
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend
              wrapperStyle={{
                paddingTop: '20px'
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#16a34a"
              strokeWidth={2}
              dot={{ fill: '#16a34a', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#dc2626"
              strokeWidth={2}
              dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Expenses"
            />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Profit"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-sm text-slate-600">Average Monthly Revenue</p>
          <p className="text-xl font-bold text-green-600 mt-1">
            {formatCurrency(
              trends.byMonth.reduce((sum, m) => sum + m.revenue, 0) / trends.byMonth.length
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-600">Average Monthly Expenses</p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatCurrency(
              trends.byMonth.reduce((sum, m) => sum + m.expenses, 0) / trends.byMonth.length
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-600">Average Monthly Profit</p>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {formatCurrency(
              trends.byMonth.reduce((sum, m) => sum + m.profit, 0) / trends.byMonth.length
            )}
          </p>
        </div>
      </div>

      {/* Monthly Profit Breakdown Table */}
      <div className="pt-6 border-t">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Monthly Profit Breakdown (All Projects Combined)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Expenses</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Profit</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {trends.byMonth.slice().reverse().map((month, index) => {
                const margin = month.revenue > 0 ? (month.profit / month.revenue) * 100 : 0;
                const isProfit = month.profit >= 0;
                return (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{month.month}</td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(month.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatCurrency(month.expenses)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(month.profit)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                      {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td className="px-4 py-3 text-slate-800">Total</td>
                <td className="px-4 py-3 text-right text-green-600">
                  {formatCurrency(trends.byMonth.reduce((sum, m) => sum + m.revenue, 0))}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {formatCurrency(trends.byMonth.reduce((sum, m) => sum + m.expenses, 0))}
                </td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {formatCurrency(trends.byMonth.reduce((sum, m) => sum + m.profit, 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {(() => {
                    const totalRev = trends.byMonth.reduce((sum, m) => sum + m.revenue, 0);
                    const totalProfit = trends.byMonth.reduce((sum, m) => sum + m.profit, 0);
                    const totalMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
                    return `${totalMargin >= 0 ? '+' : ''}${totalMargin.toFixed(1)}%`;
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
