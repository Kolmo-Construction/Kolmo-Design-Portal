import { 
  ReactCompareSlider, 
  ReactCompareSliderImage 
} from 'react-compare-slider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  // Don't render if no images are available
  if (!beforeImageUrl && !afterImageUrl) {
    return null;
  }

  // If we have both images, show the compare slider
  if (beforeImageUrl && afterImageUrl) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="aspect-video rounded-lg overflow-hidden border">
              <ReactCompareSlider
                itemOne={
                  <ReactCompareSliderImage
                    src={beforeImageUrl}
                    alt="Before renovation"
                    style={{ objectFit: 'cover' }}
                    onError={(e) => {
                      console.error("Error loading before image:", beforeImageUrl);
                    }}
                  />
                }
                itemTwo={
                  <ReactCompareSliderImage
                    src={afterImageUrl}
                    alt="After renovation"
                    style={{ objectFit: 'cover' }}
                    onError={(e) => {
                      console.error("Error loading after image:", afterImageUrl);
                    }}
                  />
                }
                position={50}
                style={{ 
                  width: '100%',
                  height: '100%',
                  borderRadius: '0.5rem'
                }}
              />
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Before
              </Badge>
              <div className="text-sm text-muted-foreground">
                Drag the slider to compare
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                After
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we only have one image, show it individually
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="aspect-video rounded-lg overflow-hidden border bg-gray-100">
            {beforeImageUrl && (
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
            {afterImageUrl && !beforeImageUrl && (
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
          </div>
          <div className="text-center">
            <Badge variant="outline" className={beforeImageUrl ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}>
              {beforeImageUrl ? "Before" : "After"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}