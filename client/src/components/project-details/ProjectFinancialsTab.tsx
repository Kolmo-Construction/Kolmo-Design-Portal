import { useQuery } from "@tanstack/react-query";
import { Project, Invoice, InvoiceStatus } from "@shared/schema"; // ADDED InvoiceStatus
import { getQueryFn } from "@/lib/queryClient";
// REMOVED: format import from date-fns
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
// REMOVED: Button import (Not used, disable buttons are present) - Keep if planning to enable
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
// ADDED Imports from utils
import { formatDate, getInvoiceStatusLabel, getInvoiceStatusBadgeClasses } from "@/lib/utils";

interface ProjectFinancialsTabProps {
  project: Project;

}

// REMOVED: Local formatDate helper function

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
    // Ensure amount is treated as a number before adding
    const amount = Number(invoice.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const remainingBudget = totalBudget - totalInvoiced;
  const percentInvoiced = totalBudget > 0 ? (totalInvoiced / totalBudget) * 100 : 0;


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
                    <TableCell>{formatDate(invoice.issueDate)}</TableCell> {/* USE Imported formatDate */}
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell> {/* USE Imported formatDate */}

                    <TableCell>${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                       <Badge
                        className={getInvoiceStatusBadgeClasses(invoice.status as InvoiceStatus)} // USE Imported helper

                        variant="outline"
                      >
                        {getInvoiceStatusLabel(invoice.status as InvoiceStatus)} {/* USE Imported helper */}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                         {/* TODO: Implement view/download functionality */}
                        {/* Keep Button import if you plan to enable these actions */}
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