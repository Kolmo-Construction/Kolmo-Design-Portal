import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarIcon, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const invoiceSchema = z.object({
  invoiceType: z.enum(['regular', 'change_order', 'additional_work', 'expense']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  amount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Amount must be a positive number'
  ),
  dueDate: z.date({
    required_error: 'Due date is required',
  }),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface CreateInvoiceDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unbilledWarnings?: {
    milestones: number;
    tasks: number;
  };
}

export function CreateInvoiceDialog({
  projectId,
  open,
  onOpenChange,
  unbilledWarnings,
}: CreateInvoiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showWarning, setShowWarning] = useState(true);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceType: 'regular',
      description: '',
      amount: '',
      dueDate: undefined,
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      // Generate invoice number in format: INV-YYYYMM-XXXXXX
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
      const invoiceNumber = `INV-${year}${month}-${randomSuffix}`;

      const invoiceData = {
        invoiceNumber,
        invoiceType: values.invoiceType,
        description: values.description,
        amount: values.amount, // Keep as string for validation
        issueDate: new Date().toISOString(),
        dueDate: values.dueDate.toISOString(),
        // Don't set status - let it default to 'draft'
      };

      return apiRequest('POST', `/api/projects/${projectId}/invoices`, invoiceData);
    },
    onSuccess: () => {
      toast({
        title: 'Invoice Created',
        description: 'Manual invoice has been created successfully.',
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/invoices`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });

      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Creating Invoice',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: InvoiceFormValues) => {
    createInvoiceMutation.mutate(values);
  };

  const hasUnbilledWork = unbilledWarnings &&
    (unbilledWarnings.milestones > 0 || unbilledWarnings.tasks > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Manual Invoice</DialogTitle>
          <DialogDescription>
            Create an invoice for additional work, change orders, or expenses.
          </DialogDescription>
        </DialogHeader>

        {hasUnbilledWork && showWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This project has{' '}
              {unbilledWarnings.milestones > 0 && (
                <span>{unbilledWarnings.milestones} unbilled milestone{unbilledWarnings.milestones > 1 ? 's' : ''}</span>
              )}
              {unbilledWarnings.milestones > 0 && unbilledWarnings.tasks > 0 && ' and '}
              {unbilledWarnings.tasks > 0 && (
                <span>{unbilledWarnings.tasks} unbilled task{unbilledWarnings.tasks > 1 ? 's' : ''}</span>
              )}
              . Consider billing those first.
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWarning(false)}
                className="ml-2"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoiceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="regular">Regular Invoice</SelectItem>
                      <SelectItem value="change_order">Change Order</SelectItem>
                      <SelectItem value="additional_work">Additional Work</SelectItem>
                      <SelectItem value="expense">Expense Reimbursement</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the type of manual invoice to create
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of work or expenses..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide a clear description (minimum 10 characters)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Invoice amount in dollars
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    When payment is due
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert>
              <AlertDescription className="text-sm">
                ⚠️ This invoice will be separate from task/milestone billing.
                It will be included in the total project value.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createInvoiceMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createInvoiceMutation.isPending}>
                {createInvoiceMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
