import { useQuery } from "@tanstack/react-query";
import { Project, Invoice } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, FileText, Download, Loader2, FolderOpen } from "lucide-react";

interface ProjectFinancialsTabProps {
  project: Project; // Receive the whole project object
}

// Format date (can be moved to a utils file)
const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "Not set";
  try {
      return format(new Date(dateString), "MMM d, yyyy");
  } catch {
      return "Invalid Date";
  }
};

export function ProjectFinancialsTab({ project }: ProjectFinancialsTabProps) {
  const {
    data: invoices = [],
    isLoading: isLoadingInvoices
  } = useQuery<Invoice[]>({
    queryKey: [`/api/projects/${project.id}/invoices`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!project.id,
  });

  // Calculate financial summary using the passed project prop
  const totalBudget = Number(project.totalBudget ?? 0);
  const totalInvoiced = invoices.reduce((sum, invoice) => {
    return sum + Number(invoice.amount);
  }, 0);
  const remainingBudget = totalBudget - totalInvoiced;
  const percentInvoiced = totalBudget > 0
    ? (totalInvoiced / totalBudget) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Overview</CardTitle>
        <CardDescription>Track budget, invoices and payments for {project.name}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary - Already present in ProjectOverviewCard, maybe simplify here or show different details */}
        <div className="mb-6 border-b pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Budget Usage</p>
            <Progress value={percentInvoiced} className="h-2 mb-1" />
            <div className="flex justify-between text-xs text-slate-500">
                <span>${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })} Invoiced ({percentInvoiced.toFixed(1)}%)</span>
                <span>${remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })} Remaining</span>
            </div>
        </div>

        <h3 className="text-lg font-medium mb-4">Invoices</h3>

        {isLoadingInvoices ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary-50 p-3 mb-4">
              <FolderOpen className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-slate-500">No invoices have been issued for this project yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                       <Badge
                        className={{
                          'paid': 'bg-green-100 text-green-800 border-green-300',
                          'pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
                          'overdue': 'bg-red-100 text-red-800 border-red-300'
                        }[invoice.status] || 'bg-slate-100 text-slate-800 border-slate-300'}
                        variant="outline"
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                         {/* TODO: Implement view/download functionality */}
                        <Button variant="outline" size="sm" className="text-primary-600 gap-1" disabled>
                          <FileText className="h-4 w-4" /> View
                        </Button>
                        <Button variant="outline" size="sm" className="text-primary-600 gap-1" disabled>
                          <Download className="h-4 w-4" /> Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {/* TODO: Add Payments section if needed, fetching payments related to these invoices */}
      </CardContent>
    </Card>
  );
}