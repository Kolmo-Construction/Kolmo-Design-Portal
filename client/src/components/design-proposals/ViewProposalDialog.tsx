import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Image as ImageIcon, ThumbsUp, ThumbsDown, Check, X } from "lucide-react";
import type { DesignProposalWithComparisons } from "@shared/schema";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { ProposalGalleryManager } from "./ProposalGalleryManager";

interface ViewProposalDialogProps {
  proposal: { id: number; accessToken: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewProposalDialog({
  proposal,
  open,
  onOpenChange,
}: ViewProposalDialogProps) {
  const { data: fullProposal, isLoading } =
    useQuery<DesignProposalWithComparisons>({
      queryKey: [`/api/design-proposals/${proposal.id}`],
      enabled: open,
    });

  const openPublicView = () => {
    const url = `${window.location.origin}/design-proposal/${proposal.accessToken}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <>
            <DialogHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48 mt-2" />
            </DialogHeader>
            <div className="space-y-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ))}
            </div>
          </>
        ) : fullProposal ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{fullProposal.title}</DialogTitle>
              <DialogDescription>
                {fullProposal.description || "View before/after comparisons"}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="comparisons" className="space-y-6">
              {fullProposal.customerName && (
                <div className="mb-4">
                  <span className="text-sm font-medium">Customer: </span>
                  <span className="text-sm text-muted-foreground">
                    {fullProposal.customerName}
                  </span>
                </div>
              )}

              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="comparisons">Before/After</TabsTrigger>
                <TabsTrigger value="gallery">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Gallery Images
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comparisons" className="space-y-6">
                {fullProposal.comparisons && fullProposal.comparisons.length > 0 ? (
                  <div className="space-y-8">
                    {fullProposal.comparisons.map((comparison, index) => (
                      <div key={comparison.id} className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {comparison.title}
                          </h3>
                          {comparison.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {comparison.description}
                            </p>
                          )}
                        </div>
                        <div className="rounded-lg overflow-hidden border shadow-sm bg-gray-50">
                          <ReactCompareSlider
                            itemOne={
                              <ReactCompareSliderImage
                                src={comparison.beforeImageUrl}
                                alt="Before"
                                style={{
                                  objectFit: 'contain',
                                  width: '100%',
                                  height: '100%',
                                  maxHeight: 'none',
                                  display: 'block'
                                }}
                              />
                            }
                            itemTwo={
                              <ReactCompareSliderImage
                                src={comparison.afterImageUrl}
                                alt="After"
                                style={{
                                  objectFit: 'contain',
                                  width: '100%',
                                  height: '100%',
                                  maxHeight: 'none',
                                  display: 'block'
                                }}
                              />
                            }
                            position={50}
                            style={{
                              height: "400px",
                              width: "100%",
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground px-2">
                          <span>Before</span>
                          <span>After</span>
                        </div>

                        {/* Pros and Cons for this comparison */}
                        {(comparison.pros?.length > 0 || comparison.cons?.length > 0) && (
                          <div className="mt-4 p-4 border rounded-lg bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Pros */}
                              {comparison.pros && comparison.pros.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-full bg-green-100">
                                      <ThumbsUp className="h-3 w-3 text-green-600" />
                                    </div>
                                    <h4 className="font-semibold text-sm text-green-700">Advantages</h4>
                                  </div>
                                  <ul className="space-y-1.5">
                                    {comparison.pros.map((pro, proIndex) => (
                                      <li key={proIndex} className="flex gap-2 items-start text-xs">
                                        <Check className="h-3 w-3 shrink-0 mt-0.5 text-green-600" />
                                        <span>{pro}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Cons */}
                              {comparison.cons && comparison.cons.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1 rounded-full bg-red-100">
                                      <ThumbsDown className="h-3 w-3 text-red-600" />
                                    </div>
                                    <h4 className="font-semibold text-sm text-red-700">Considerations</h4>
                                  </div>
                                  <ul className="space-y-1.5">
                                    {comparison.cons.map((con, conIndex) => (
                                      <li key={conIndex} className="flex gap-2 items-start text-xs">
                                        <X className="h-3 w-3 shrink-0 mt-0.5 text-red-600" />
                                        <span>{con}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No comparisons available
                  </p>
                )}
              </TabsContent>

              <TabsContent value="gallery">
                <ProposalGalleryManager proposalId={proposal.id} />
              </TabsContent>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={openPublicView}
                  className="gap-2"
                  data-testid="button-open-public-view"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Public View
                </Button>
                <Button onClick={() => onOpenChange(false)} data-testid="button-close-dialog">
                  Close
                </Button>
              </div>
            </Tabs>
          </>
        ) : (
          <p className="text-center py-8">Proposal not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
