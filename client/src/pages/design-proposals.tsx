import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Eye, Trash2, Copy, Home, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CreateProposalDialog } from "@/components/design-proposals/CreateProposalDialog";
import { ViewProposalDialog } from "@/components/design-proposals/ViewProposalDialog";
import { EditProposalDialog } from "@/components/design-proposals/EditProposalDialog";
import type { DesignProposal, DesignProposalWithComparisons } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

export default function DesignProposalsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewingProposal, setViewingProposal] = useState<DesignProposal | null>(null);
  const [editingProposal, setEditingProposal] = useState<DesignProposalWithComparisons | null>(null);

  const { data: proposals, isLoading } = useQuery<DesignProposal[]>({
    queryKey: ["/api/design-proposals"],
  });

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this design proposal?")) {
      return;
    }

    try {
      await apiRequest("DELETE", `/api/design-proposals/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/design-proposals"] });
      toast({
        title: "Success",
        description: "Design proposal deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete design proposal",
        variant: "destructive",
      });
    }
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/design-proposal/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Share link copied to clipboard",
    });
  };

  const handleEdit = async (id: number) => {
    try {
      const proposal = await apiRequest("GET", `/api/design-proposals/${id}`);
      setEditingProposal(proposal);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load proposal for editing",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="text-foreground">Design Proposals</span>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Design Proposals</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage before/after design views to share with customers
            </p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-2"
            data-testid="button-create-proposal"
          >
            <Plus className="h-4 w-4" />
            Create Proposal
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : proposals && proposals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proposals.map((proposal) => (
              <Card key={proposal.id} className="hover:shadow-lg transition-shadow" data-testid={`card-proposal-${proposal.id}`}>
                <CardHeader>
                  <CardTitle className="text-lg" data-testid={`text-proposal-title-${proposal.id}`}>{proposal.title}</CardTitle>
                  {proposal.customerName && (
                    <CardDescription data-testid={`text-customer-name-${proposal.id}`}>
                      {proposal.customerName}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {proposal.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {proposal.description}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingProposal(proposal)}
                      className="gap-2"
                      data-testid={`button-view-${proposal.id}`}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(proposal.id)}
                      className="gap-2"
                      data-testid={`button-edit-${proposal.id}`}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyShareLink(proposal.accessToken)}
                      className="gap-2"
                      data-testid={`button-copy-link-${proposal.id}`}
                    >
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(proposal.id)}
                      className="gap-2 text-destructive hover:text-destructive"
                      data-testid={`button-delete-${proposal.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center mb-4">
                No design proposals yet. Create your first one to get started!
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2"
                data-testid="button-create-first-proposal"
              >
                <Plus className="h-4 w-4" />
                Create Your First Proposal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <CreateProposalDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {viewingProposal && (
        <ViewProposalDialog
          proposal={viewingProposal}
          open={!!viewingProposal}
          onOpenChange={(open: boolean) => !open && setViewingProposal(null)}
        />
      )}

      {editingProposal && (
        <EditProposalDialog
          proposal={editingProposal}
          open={!!editingProposal}
          onOpenChange={(open: boolean) => !open && setEditingProposal(null)}
        />
      )}
    </div>
  );
}
