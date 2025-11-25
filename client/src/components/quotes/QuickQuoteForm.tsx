import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { theme } from "@/config/theme";
import { Loader2 } from "lucide-react";

const quickQuoteSchema = z.object({
  title: z.string().min(1, "Quote title is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  description: z.string().optional(),
});

type QuickQuoteForm = z.infer<typeof quickQuoteSchema>;

interface QuickQuoteFormProps {
  onSuccess?: () => void;
}

export function QuickQuoteForm({ onSuccess }: QuickQuoteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<QuickQuoteForm>({
    resolver: zodResolver(quickQuoteSchema),
    defaultValues: {
      title: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      projectType: "",
      description: "",
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: QuickQuoteForm) => {
      const response = await apiRequest("POST", "/api/quotes", {
        ...data,
        subtotal: 0,
        discountPercentage: 0,
        discountAmount: 0,
        taxRate: 8.5,
        taxAmount: 0,
        total: 0,
        downPaymentPercentage: 40,
        milestonePaymentPercentage: 40,
        finalPaymentPercentage: 20,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: [],
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Quote Created",
        description: "Quick quote created successfully. Add line items to complete it.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: QuickQuoteForm) => {
    setIsLoading(true);
    createQuoteMutation.mutate(data);
    setIsLoading(false);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader style={{ backgroundColor: theme.colors.primary }}>
        <CardTitle className="text-white">Quick Quote</CardTitle>
        <CardDescription className="text-gray-200">
          Create a new quote in seconds
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: theme.colors.textDark }}>
                      Quote Title
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Kitchen Renovation"
                        {...field}
                        style={{ borderColor: theme.colors.border }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: theme.colors.textDark }}>
                      Project Type
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Residential, Commercial"
                        {...field}
                        style={{ borderColor: theme.colors.border }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: theme.colors.textDark }}>
                      Customer Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Full name"
                        {...field}
                        style={{ borderColor: theme.colors.border }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: theme.colors.textDark }}>
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="customer@example.com"
                        {...field}
                        style={{ borderColor: theme.colors.border }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: theme.colors.textDark }}>
                    Phone (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="(555) 123-4567"
                      {...field}
                      style={{ borderColor: theme.colors.border }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: theme.colors.textDark }}>
                    Description (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional details about the project..."
                      {...field}
                      className="min-h-24"
                      style={{ borderColor: theme.colors.border }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isLoading}
              style={{ backgroundColor: theme.colors.accent }}
              className="w-full hover:opacity-90 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Quote"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
