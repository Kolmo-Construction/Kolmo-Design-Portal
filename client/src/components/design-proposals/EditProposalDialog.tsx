import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DesignProposalWithComparisons } from "@shared/schema";
import { ProposalGalleryManager } from "./ProposalGalleryManager";

const proposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  projectId: z.number().optional().nullable(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface EditProposalDialogProps {
  proposal: DesignProposalWithComparisons;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProposalDialog({
  proposal,
  open,
  onOpenChange,
}: EditProposalDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: proposal.title,
      description: proposal.description || "",
      customerName: proposal.customerName || "",
      customerEmail: proposal.customerEmail || "",
      projectId: proposal.projectId,
    },
  });

  // Reset form when proposal changes
  useEffect(() => {
    form.reset({
      title: proposal.title,
      description: proposal.description || "",
      customerName: proposal.customerName || "",
      customerEmail: proposal.customerEmail || "",
      projectId: proposal.projectId,
    });
  }, [proposal, form]);

  const onSubmit = async (data: ProposalFormData) => {
    setIsSubmitting(true);

    try {
      await apiRequest("PATCH", `/api/design-proposals/${proposal.id}`, data);

      queryClient.invalidateQueries({ queryKey: ["/api/design-proposals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/design-proposals/${proposal.id}`] });

      toast({
        title: "Success",
        description: "Design proposal updated successfully",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating proposal:", error);
      toast({
        title: "Error",
        description: "Failed to update design proposal",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Design Proposal</DialogTitle>
          <DialogDescription>
            Update proposal details and customer information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="gallery">Gallery Images</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proposal Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Kitchen Renovation Design"
                          {...field}
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any additional details about this proposal"
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
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
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
                        <FormLabel>Customer Email (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="gallery">
            <ProposalGalleryManager proposalId={proposal.id} />
            <div className="flex justify-end pt-4 border-t mt-6">
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
