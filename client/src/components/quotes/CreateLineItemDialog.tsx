import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const createLineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.string().min(1, "Unit is required"),
  unitPrice: z.string().min(1, "Unit price is required"),
});

type CreateLineItemForm = z.infer<typeof createLineItemSchema>;

interface CreateLineItemDialogProps {
  quoteId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLineItemDialog({ quoteId, open, onOpenChange }: CreateLineItemDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateLineItemForm>({
    resolver: zodResolver(createLineItemSchema),
    defaultValues: {
      category: "",
      description: "",
      quantity: "1",
      unit: "each",
      unitPrice: "",
    },
  });

  const createLineItemMutation = useMutation({
    mutationFn: async (data: CreateLineItemForm) => {
      const quantity = parseFloat(data.quantity);
      const unitPrice = parseFloat(data.unitPrice);
      const totalPrice = quantity * unitPrice;

      return await apiRequest(`/api/quotes/${quoteId}/line-items`, "POST", {
        ...data,
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Line Item Added",
        description: "Line item has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/line-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      form.reset();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add line item",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateLineItemForm) => {
    createLineItemMutation.mutate(data);
  };

  const categories = [
    "Materials",
    "Labor",
    "Equipment",
    "Permits",
    "Demolition",
    "Electrical",
    "Plumbing",
    "Flooring",
    "Painting",
    "Cabinetry",
    "Countertops",
    "Appliances",
    "Fixtures",
    "Hardware",
    "Cleanup",
    "Other"
  ];

  const units = [
    "each",
    "sq ft",
    "linear ft",
    "sq yard",
    "cubic ft",
    "hour",
    "day",
    "week",
    "lot",
    "gallon",
    "pound",
    "bundle",
    "box",
    "case"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
          <DialogDescription>
            Add a new line item to this quote
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of work or materials"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Price ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLineItemMutation.isPending}
              >
                {createLineItemMutation.isPending ? "Adding..." : "Add Line Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}