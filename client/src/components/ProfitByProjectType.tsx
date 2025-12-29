import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Badge } from "@/components/ui/badge";

interface ProjectTypeMetrics {
  projectType: string;
  projectCount: number;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  avgProfitMargin: number;
}

interface ProfitByProjectTypeProps {
  byProjectType?: ProjectTypeMetrics[];
  isLoading?: boolean;
}

export default function ProfitByProjectType({
  byProjectType,
  isLoading = false
}: ProfitByProjectTypeProps) {
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-80 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!byProjectType || byProjectType.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No project type data available yet</p>
        <p className="text-sm mt-1">Project profitability will be analyzed once projects are completed</p>
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

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Color based on margin
  const getBarColor = (margin: number) => {
    if (margin >= 20) return '#16a34a'; // Green
    if (margin >= 10) return '#84cc16'; // Yellow-green
    if (margin >= 0) return '#f59e0b'; // Orange
    return '#dc2626'; // Red
  };

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Average Profit Margin by Project Type
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={byProjectType}
            margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="projectType"
              stroke="#64748b"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={100}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              label={{
                value: 'Profit Margin %',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px'
              }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as ProjectTypeMetrics;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
                      <p className="font-semibold text-slate-800 mb-2">{data.projectType}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-slate-600">
                          Avg Margin: <span className="font-medium">{formatPercent(data.avgProfitMargin)}</span>
                        </p>
                        <p className="text-slate-600">
                          Projects: <span className="font-medium">{data.projectCount}</span>
                        </p>
                        <p className="text-slate-600">
                          Total Profit: <span className="font-medium">{formatCurrency(data.totalProfit)}</span>
                        </p>
                        <p className="text-slate-600">
                          Revenue: <span className="font-medium">{formatCurrency(data.totalRevenue)}</span>
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="avgProfitMargin"
              radius={[8, 8, 0, 0]}
            >
              {byProjectType.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.avgProfitMargin)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Project Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
        {byProjectType.map((type, index) => {
          const isPositive = type.avgProfitMargin >= 0;
          return (
            <div
              key={index}
              className="bg-slate-50 border border-slate-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-slate-800 text-sm">
                  {type.projectType}
                </h4>
                <Badge
                  variant={isPositive ? "default" : "destructive"}
                  className={
                    type.avgProfitMargin >= 20
                      ? "bg-green-100 text-green-800 border-green-200"
                      : type.avgProfitMargin >= 10
                      ? "bg-lime-100 text-lime-800 border-lime-200"
                      : type.avgProfitMargin >= 0
                      ? "bg-orange-100 text-orange-800 border-orange-200"
                      : ""
                  }
                >
                  {formatPercent(type.avgProfitMargin)}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Projects:</span>
                  <span className="font-medium">{type.projectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span className="font-medium">{formatCurrency(type.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Profit:</span>
                  <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(type.totalProfit)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-sm">
        <span className="text-slate-600 font-medium">Margin Color Key:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600"></div>
          <span className="text-slate-600">≥ 20% (Excellent)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-lime-500"></div>
          <span className="text-slate-600">10-20% (Good)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500"></div>
          <span className="text-slate-600">0-10% (Fair)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-600"></div>
          <span className="text-slate-600">&lt; 0% (Loss)</span>
        </div>
      </div>
    </div>
  );
}
