import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, Search } from "lucide-react";

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

interface ProjectFinancialTableProps {
  projects?: ProjectFinancial[];
  isLoading?: boolean;
}

type SortField = 'projectName' | 'revenue' | 'totalExpenses' | 'profit' | 'profitMargin';
type SortDirection = 'asc' | 'desc';

export default function ProjectFinancialTable({
  projects,
  isLoading = false
}: ProjectFinancialTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>('profitMargin');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedProjects = useMemo(() => {
    if (!projects) return [];

    let filtered = projects.filter(project => {
      const matchesSearch = project.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || project.projectType === typeFilter;
      const matchesStatus = statusFilter === 'all' || project.projectStatus === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal as string) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });

    return filtered;
  }, [projects, searchTerm, typeFilter, statusFilter, sortField, sortDirection]);

  const uniqueTypes = useMemo(() => {
    if (!projects) return [];
    return Array.from(new Set(projects.map(p => p.projectType))).sort();
  }, [projects]);

  const uniqueStatuses = useMemo(() => {
    if (!projects) return [];
    return Array.from(new Set(projects.map(p => p.projectStatus))).sort();
  }, [projects]);

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

  const getMarginColor = (margin: number) => {
    if (margin >= 20) return 'text-green-600';
    if (margin >= 10) return 'text-lime-600';
    if (margin >= 0) return 'text-orange-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-200 rounded"></div>
        <div className="h-64 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No project data available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('projectName')}
                    className="h-8 px-2 hover:bg-slate-100"
                  >
                    Project Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('revenue')}
                    className="h-8 px-2 hover:bg-slate-100 ml-auto"
                  >
                    Revenue
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('totalExpenses')}
                    className="h-8 px-2 hover:bg-slate-100 ml-auto"
                  >
                    Expenses
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('profit')}
                    className="h-8 px-2 hover:bg-slate-100 ml-auto"
                  >
                    Profit
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('profitMargin')}
                    className="h-8 px-2 hover:bg-slate-100 ml-auto"
                  >
                    Margin
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedProjects.map((project) => (
                <TableRow key={project.projectId} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{project.projectName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {project.projectType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        project.projectStatus === 'completed' ? 'default' :
                        project.projectStatus === 'in_progress' ? 'secondary' :
                        'outline'
                      }
                      className="text-xs"
                    >
                      {project.projectStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    {formatCurrency(project.revenue)}
                  </TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    <div className="group relative inline-block">
                      {formatCurrency(project.totalExpenses)}
                      <div className="invisible group-hover:visible absolute right-0 top-full mt-1 bg-slate-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                        Receipts: {formatCurrency(project.receiptExpenses)}<br />
                        Labor: {formatCurrency(project.laborExpenses)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(project.profit)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${getMarginColor(project.profitMargin)}`}>
                    {formatPercent(project.profitMargin)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link to={`/projects/${project.projectId}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-600 text-center">
        Showing {filteredAndSortedProjects.length} of {projects.length} projects
      </div>
    </div>
  );
}
