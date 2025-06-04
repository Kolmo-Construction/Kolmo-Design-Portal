import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeImageUrl?: string;
  afterImageUrl?: string;
  title?: string;
  description?: string;
}

export function BeforeAfterSlider({
  beforeImageUrl,
  afterImageUrl,
  title = "Project Transformation",
  description
}: BeforeAfterSliderProps) {
  const [showAfter, setShowAfter] = useState(false);

  // Don't render if no images are available
  if (!beforeImageUrl && !afterImageUrl) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Image Container */}
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
            {beforeImageUrl && !showAfter && (
              <img
                src={beforeImageUrl}
                alt="Before"
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error("Error loading before image:", beforeImageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            {afterImageUrl && showAfter && (
              <img
                src={afterImageUrl}
                alt="After"
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error("Error loading after image:", afterImageUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            
            {/* Image Label */}
            <div className="absolute top-4 left-4">
              <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                {showAfter ? "After" : "Before"}
              </span>
            </div>

            {/* Navigation Buttons */}
            {beforeImageUrl && afterImageUrl && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowAfter(false)}
                  disabled={!showAfter}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowAfter(true)}
                  disabled={showAfter}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Toggle Buttons */}
          {beforeImageUrl && afterImageUrl && (
            <div className="flex justify-center mt-4 space-x-2">
              <Button
                variant={!showAfter ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAfter(false)}
              >
                Before
              </Button>
              <Button
                variant={showAfter ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAfter(true)}
              >
                After
              </Button>
            </div>
          )}

          {/* Single Image Labels */}
          {beforeImageUrl && !afterImageUrl && (
            <div className="text-center mt-2">
              <span className="text-sm text-muted-foreground">Before Image</span>
            </div>
          )}
          {!beforeImageUrl && afterImageUrl && (
            <div className="text-center mt-2">
              <span className="text-sm text-muted-foreground">After Image</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}