import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DesignProposalWithComparisons } from "@shared/schema";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

export default function PublicDesignProposalPage() {
  const [, params] = useRoute("/design-proposal/:token");
  const token = params?.token;

  const { data: proposal, isLoading, error } =
    useQuery<DesignProposalWithComparisons>({
      queryKey: [`/api/design-proposals/public/${token}`],
      enabled: !!token,
    });

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              The design proposal link is invalid or missing.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Proposal Not Found</CardTitle>
            <CardDescription>
              The design proposal you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-3" data-testid="text-proposal-title">
            {proposal.title}
          </h1>
          {proposal.description && (
            <p className="text-lg text-muted-foreground" data-testid="text-proposal-description">
              {proposal.description}
            </p>
          )}
          {proposal.customerName && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-customer-name">
              Prepared for: {proposal.customerName}
            </p>
          )}
        </div>

        {proposal.comparisons && proposal.comparisons.length > 0 ? (
          <div className="space-y-12">
            {proposal.comparisons.map((comparison, index) => (
              <Card key={comparison.id} className="overflow-hidden" data-testid={`card-comparison-${index}`}>
                <CardHeader>
                  <CardTitle className="text-2xl" data-testid={`text-comparison-title-${index}`}>
                    {comparison.title}
                  </CardTitle>
                  {comparison.description && (
                    <CardDescription className="text-base" data-testid={`text-comparison-description-${index}`}>
                      {comparison.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative bg-gray-50">
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
                        height: "500px",
                        width: "100%",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm font-medium px-6 py-3 bg-muted/50">
                    <span className="text-muted-foreground">← Before</span>
                    <span className="text-muted-foreground">After →</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                No design comparisons available at this time.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Questions about this design proposal? Contact us to discuss further.
          </p>
        </div>
      </div>
    </div>
  );
}
