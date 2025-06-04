import { useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BeforeAfterPair } from "@shared/schema";

interface MultipleBeforeAfterSliderProps {
  pairs: BeforeAfterPair[];
}

export function MultipleBeforeAfterSlider({ pairs }: MultipleBeforeAfterSliderProps) {
  const [currentPairIndex, setCurrentPairIndex] = useState(0);

  if (!pairs || pairs.length === 0) {
    return null;
  }

  const currentPair = pairs[currentPairIndex];
  const hasMultiplePairs = pairs.length > 1;

  const nextPair = () => {
    setCurrentPairIndex((prev) => (prev + 1) % pairs.length);
  };

  const prevPair = () => {
    setCurrentPairIndex((prev) => (prev - 1 + pairs.length) % pairs.length);
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8 mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-primary mb-2 flex items-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-accent/10 rounded-lg sm:rounded-xl flex items-center justify-center mr-3">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-accent" />
            </div>
            Before & After Transformation
          </h3>
          {hasMultiplePairs && (
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {currentPairIndex + 1} of {pairs.length}
              </Badge>
              <span className="text-sm text-muted-foreground">Different Areas</span>
            </div>
          )}
        </div>

        {hasMultiplePairs && (
          <div className="flex items-center space-x-2">
            <Button
              onClick={prevPair}
              variant="outline"
              size="sm"
              className="w-8 h-8 sm:w-9 sm:h-9 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={nextPair}
              variant="outline"
              size="sm"
              className="w-8 h-8 sm:w-9 sm:h-9 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Current Pair Display */}
      <div className="space-y-4">
        <div>
          <h4 className="text-base sm:text-lg font-semibold text-slate-800 mb-2">
            {currentPair.title}
          </h4>
          {currentPair.description && (
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              {currentPair.description}
            </p>
          )}
        </div>

        {/* Before/After Slider */}
        <div className="relative bg-slate-100 rounded-lg overflow-hidden">
          <ReactCompareSlider
            itemOne={
              <ReactCompareSliderImage
                src={currentPair.beforeImageUrl}
                alt={`Before: ${currentPair.title}`}
                className="w-full h-full object-cover"
                style={{ 
                  minHeight: "250px",
                  maxHeight: "500px",
                  height: "auto"
                }}
              />
            }
            itemTwo={
              <ReactCompareSliderImage
                src={currentPair.afterImageUrl}
                alt={`After: ${currentPair.title}`}
                className="w-full h-full object-cover"
                style={{ 
                  minHeight: "250px",
                  maxHeight: "500px",
                  height: "auto"
                }}
              />
            }
            position={50}
            className="h-[250px] sm:h-[350px] lg:h-[450px]"
          />
          
          {/* Labels */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg">
            <span className="text-sm font-semibold text-slate-800">Before</span>
          </div>
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg">
            <span className="text-sm font-semibold text-slate-800">After</span>
          </div>
        </div>

        {/* Navigation Dots for Multiple Pairs */}
        {hasMultiplePairs && (
          <div className="flex justify-center space-x-2 pt-4">
            {pairs.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPairIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentPairIndex
                    ? "bg-accent"
                    : "bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`View ${pairs[index].title}`}
              />
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Drag the slider or tap to compare before and after images
          </p>
        </div>
      </div>
    </div>
  );
}