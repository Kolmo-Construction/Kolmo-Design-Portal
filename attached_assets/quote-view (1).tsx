import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Calendar, Clock, Phone, Mail, MapPin, FileText, Palette, User } from "lucide-react";
import { formatCurrency, formatPhoneNumber, formatAddress } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ColorPicker } from "@/components/ui/color-picker";
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import ReactMarkdown from 'react-markdown';
import kolmoLogo from "@/assets/kolmo-logo.png";

interface QuoteData {
  id: number;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  projectTitle: string;
  projectDescription: string;
  projectType: string;
  projectLocation?: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  validUntil: string;
  status: string;
  viewedAt?: string;
  respondedAt?: string;
  customerResponse?: string;
  customerNotes?: string;
  createdAt: string;
  showBeforeAfter?: boolean;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeAfterTitle?: string;
  beforeAfterDescription?: string;
  showColorVerification?: boolean;
  colorVerificationTitle?: string;
  colorVerificationDescription?: string;
  paintColors?: Record<string, string>;
  permitRequired?: boolean;
  permitDetails?: string;
  downPaymentPercentage?: string;
  milestonePaymentPercentage?: string;
  finalPaymentPercentage?: string;
  milestoneDescription?: string;
  creditCardProcessingFee?: string;
  acceptsCreditCards?: boolean;
  lineItems: Array<{
    id: number;
    category: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    totalPrice: string;
  }>;
  images: Array<{
    id: number;
    imageUrl: string;
    caption?: string;
    imageType: string;
  }>;
}

export default function QuoteView() {
  const params = useParams();
  const token = params.token;
  const [customerNotes, setCustomerNotes] = useState("");
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [responseType, setResponseType] = useState<"accepted" | "declined" | null>(null);
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});
  const [hasColorChanges, setHasColorChanges] = useState(false);
  
  const { toast } = useToast();

  // Fetch quote data using the magic token
  const { data: quote, isLoading, error, refetch } = useQuery<QuoteData>({
    queryKey: ["/api/quotes", token],
    queryFn: () => apiRequest(`/api/quotes/${token}`),
    enabled: !!token,
  });

  // Submit customer response mutation
  const respondMutation = useMutation({
    mutationFn: (data: { response: "accepted" | "declined"; notes?: string }) =>
      apiRequest({
        url: `/api/quotes/${token}/respond`,
        method: "POST",
        data: data,
      }),
    onSuccess: () => {
      toast({
        title: "Response submitted",
        description: "Thank you for your response. We will be in touch soon.",
      });
      setIsResponseDialogOpen(false);
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit response. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Submit color selections mutation
  const saveColorsMutation = useMutation({
    mutationFn: (colors: Record<string, string>) =>
      apiRequest({
        url: `/api/quotes/${token}/colors`,
        method: "POST",
        data: { paintColors: colors },
      }),
    onSuccess: () => {
      toast({
        title: "Colors saved",
        description: "Your color selections have been saved successfully.",
      });
      setHasColorChanges(false);
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save color selections. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleResponse = (response: "accepted" | "declined") => {
    setResponseType(response);
    setIsResponseDialogOpen(true);
  };

  const submitResponse = () => {
    if (!responseType) return;
    
    respondMutation.mutate({
      response: responseType,
      notes: customerNotes.trim() || undefined,
    });
  };

  // Initialize color selections when quote data loads
  useEffect(() => {
    if (quote?.paintColors && Object.keys(selectedColors).length === 0) {
      setSelectedColors(quote.paintColors);
    }
  }, [quote?.paintColors]);

  // Handle color changes
  const handleColorChange = (area: string, color: string) => {
    setSelectedColors(prev => ({
      ...prev,
      [area]: color
    }));
    setHasColorChanges(true);
  };

  // Save color selections
  const saveColorSelections = () => {
    saveColorsMutation.mutate(selectedColors);
  };

  // Common paint areas for paint projects
  const defaultPaintAreas = [
    "Exterior Walls",
    "Interior Walls",
    "Trim & Molding",
    "Doors",
    "Windows",
    "Ceiling",
    "Garage",
    "Deck/Fence"
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/40 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Quote Not Found</CardTitle>
            <CardDescription>
              The quote you're looking for doesn't exist or may have expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please check your link or contact us for assistance.
            </p>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = new Date(quote.validUntil) < new Date();
  const canRespond = !quote.respondedAt && !isExpired && quote.status !== "expired";

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border">
                <img src={kolmoLogo} alt="Kolmo Construction" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary">Kolmo Construction</h1>
                <p className="text-sm text-muted-foreground">Licensed, Bonded & Insured • EPA Lead-Safe Certified</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-primary" />
                <span>(206) 410-5100</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <span>projects@kolmo.io</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <Badge 
                variant={quote.status === "accepted" ? "default" : 
                       quote.status === "declined" ? "destructive" : 
                       isExpired ? "secondary" : "outline"}
                className="text-sm"
              >
                {quote.status === "accepted" ? "Accepted" :
                 quote.status === "declined" ? "Declined" :
                 isExpired ? "Expired" : "Pending"}
              </Badge>
              {isExpired && (
                <p className="text-sm text-red-600 mt-1">
                  Expired on {format(new Date(quote.validUntil), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>

          {/* Company Credentials */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium">Licensed:</span>
                <span>KOLMOL*753JS</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium">Bonded & Insured</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium">OSHA 40 Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium">lead-safe work</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-muted-foreground">
                EPA RRP (Renovation, Repair, and Painting) certified for lead-safe work practices in Washington State
              </p>
            </div>
          </div>

          {/* Quote Information */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Project Quote</h2>
              <p className="text-muted-foreground">Quote #{quote.quoteNumber}</p>
            </div>
            <div className="text-left sm:text-right text-sm text-muted-foreground">
              <p>Valid until {format(new Date(quote.validUntil), 'MMMM d, yyyy')}</p>
              <p>Created {format(new Date(quote.createdAt), 'MMMM d, yyyy')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4 sm:space-y-6">
        {/* Customer Response Actions */}
        {canRespond && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Response Required
              </CardTitle>
              <CardDescription>
                Please review this quote and let us know if you'd like to proceed.
                Valid until {format(new Date(quote.validUntil), 'MMMM d, yyyy')}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button 
                  onClick={() => handleResponse("accepted")}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Quote
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleResponse("declined")}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Response Status */}
        {quote.respondedAt && (
          <Card className={quote.customerResponse === "accepted" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                {quote.customerResponse === "accepted" ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">
                  Quote {quote.customerResponse === "accepted" ? "Accepted" : "Declined"}
                </span>
                <span className="text-sm text-muted-foreground">
                  on {format(new Date(quote.respondedAt), 'MMMM d, yyyy')}
                </span>
              </div>
              {quote.customerNotes && (
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Your notes:</strong> {quote.customerNotes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Main Quote Details */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Project Information */}
            <Card>
              <CardHeader>
                <CardTitle>{quote.projectTitle}</CardTitle>
                <CardDescription>{quote.projectType}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{quote.projectDescription}</p>
                
                {quote.projectLocation && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{quote.projectLocation}</span>
                  </div>
                )}

                {/* Timeline */}
                {(quote.estimatedStartDate || quote.estimatedCompletionDate) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                    {quote.estimatedStartDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <div>
                          <p className="font-medium">Estimated Start</p>
                          <p className="text-muted-foreground">
                            {format(new Date(quote.estimatedStartDate), 'MMMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                    {quote.estimatedCompletionDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <div>
                          <p className="font-medium">Estimated Completion</p>
                          <p className="text-muted-foreground">
                            {format(new Date(quote.estimatedCompletionDate), 'MMMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Permit Requirements */}
                {quote.permitRequired && (
                  <div className="pt-4 border-t">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-orange-900 mb-1">Permits Required</h4>
                        <p className="text-sm text-orange-700 mb-2">
                          This project requires permits before work can begin.
                        </p>
                        {quote.permitDetails && (
                          <div className="bg-orange-50 p-3 rounded-lg">
                            <p className="text-sm text-orange-800">{quote.permitDetails}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Project Breakdown</CardTitle>
                <CardDescription>Detailed cost breakdown for your project</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quote.lineItems.map((item, index) => {
                    const isDiscount = item.category === "Discount" || parseFloat(item.totalPrice) < 0;
                    return (
                      <div 
                        key={item.id} 
                        className={`flex justify-between items-start p-4 border rounded-lg ${
                          isDiscount ? "border-green-200 bg-green-50" : ""
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                isDiscount ? "border-green-300 text-green-700 bg-green-100" : ""
                              }`}
                            >
                              {item.category}
                            </Badge>
                          </div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} {item.unit} × {formatCurrency(parseFloat(item.unitPrice))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${isDiscount ? "text-green-600" : ""}`}>
                            {formatCurrency(parseFloat(item.totalPrice))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Project Images */}
            {quote.images.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Project Images</CardTitle>
                  <CardDescription>Visual references for your project</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quote.images.map((image) => (
                      <div key={image.id} className="space-y-2">
                        <div className="aspect-video rounded-lg overflow-hidden">
                          <img 
                            src={image.imageUrl} 
                            alt={image.caption || "Project image"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {image.caption && (
                          <p className="text-sm text-muted-foreground">{image.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Before/After Comparison */}
            {quote.showBeforeAfter && (quote.beforeImageUrl || quote.afterImageUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle>{quote.beforeAfterTitle || "Project Transformation"}</CardTitle>
                  {quote.beforeAfterDescription && (
                    <CardDescription>{quote.beforeAfterDescription}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {quote.beforeImageUrl && quote.afterImageUrl ? (
                    <div className="space-y-4">
                      <div className="aspect-video rounded-lg overflow-hidden border">
                        <ReactCompareSlider
                          itemOne={
                            <ReactCompareSliderImage
                              src={quote.beforeImageUrl}
                              alt="Before renovation"
                              style={{ objectFit: 'cover' }}
                            />
                          }
                          itemTwo={
                            <ReactCompareSliderImage
                              src={quote.afterImageUrl}
                              alt="After renovation"
                              style={{ objectFit: 'cover' }}
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
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {quote.beforeImageUrl && (
                        <div className="space-y-3">
                          <div className="aspect-video rounded-lg overflow-hidden border">
                            <img 
                              src={quote.beforeImageUrl} 
                              alt="Before renovation"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-center">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Before
                            </Badge>
                          </div>
                        </div>
                      )}
                      {quote.afterImageUrl && (
                        <div className="space-y-3">
                          <div className="aspect-video rounded-lg overflow-hidden border">
                            <img 
                              src={quote.afterImageUrl} 
                              alt="After renovation"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-center">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              After
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground text-center">
                      <strong>Professional Transformation:</strong> See the quality difference our expert craftsmanship makes. 
                      This is the level of excellence you can expect for your project.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Color Verification Section */}
            {quote.showColorVerification && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    <CardTitle>{quote.colorVerificationTitle || "Color Verification"}</CardTitle>
                  </div>
                  <CardDescription>
                    {quote.colorVerificationDescription || "Please verify and confirm the paint colors for each area of your project."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    {defaultPaintAreas.map((area) => (
                      <div key={area} className="space-y-2">
                        <Label className="text-sm font-medium">{area}</Label>
                        <div className="flex items-center gap-3">
                          <ColorPicker
                            color={selectedColors[area] || "#ffffff"}
                            onChange={(color) => handleColorChange(area, color)}
                            label={`Select color for ${area}`}
                          />
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground">
                              Current: {selectedColors[area] || "Not selected"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasColorChanges && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          You have unsaved color changes
                        </div>
                        <Button 
                          onClick={saveColorSelections}
                          disabled={saveColorsMutation.isPending}
                          size="sm"
                        >
                          {saveColorsMutation.isPending ? "Saving..." : "Save Colors"}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 mb-1">Color Selection Tips</p>
                        <ul className="text-blue-700 space-y-1 text-xs">
                          <li>• Colors may appear different under various lighting conditions</li>
                          <li>• We recommend viewing actual paint samples before final decision</li>
                          <li>• Our team will provide color consultation during project planning</li>
                          <li>• All color selections will be confirmed before work begins</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:space-y-6">
            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Quote Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(parseFloat(quote.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatCurrency(parseFloat(quote.taxAmount))}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(parseFloat(quote.totalAmount))}</span>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Valid until {format(new Date(quote.validUntil), 'MMMM d, yyyy')}
                </div>
              </CardContent>
            </Card>

            {/* Payment Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Down Payment</span>
                    <span className="font-medium">{quote.downPaymentPercentage || 40}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Milestone Payment</span>
                    <span className="font-medium">{quote.milestonePaymentPercentage || 40}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Final Payment</span>
                    <span className="font-medium">{quote.finalPaymentPercentage || 20}%</span>
                  </div>
                </div>
                
                {quote.milestoneDescription && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Milestone:</strong> {quote.milestoneDescription}
                    </p>
                  </div>
                )}
                
                {quote.acceptsCreditCards && quote.creditCardProcessingFee && parseFloat(quote.creditCardProcessingFee) > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Credit Card Processing:</strong> A {quote.creditCardProcessingFee}% processing fee will be added when paying with credit cards.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{quote.customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  <span>{quote.customerEmail}</span>
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <span>{formatPhoneNumber(quote.customerPhone)}</span>
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5" />
                    <span className="whitespace-pre-line">{formatAddress(quote.customerAddress)}</span>
                  </div>
                )}
                {quote.customerNotes && (
                  <div className="pt-3 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Project Notes</div>
                    <div className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200 prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                          h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                          h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({children}) => <li className="text-sm">{children}</li>,
                          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                          em: ({children}) => <em className="italic">{children}</em>,
                          code: ({children}) => <code className="bg-blue-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                          blockquote: ({children}) => <blockquote className="border-l-2 border-blue-300 pl-3 italic">{children}</blockquote>
                        }}
                      >
                        {quote.customerNotes}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Questions?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Have questions about this quote? We're here to help.
                </p>
                <p className="text-xs text-muted-foreground">
                  Contact information available in header above.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Response Dialog */}
        <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {responseType === "accepted" ? "Accept Quote" : "Decline Quote"}
              </DialogTitle>
              <DialogDescription>
                {responseType === "accepted" 
                  ? "Thank you for accepting our quote. Please add any additional notes or requirements."
                  : "We understand this quote may not meet your needs. Please let us know if there's anything we can adjust."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="customer-notes"
                  placeholder={responseType === "accepted" 
                    ? "Any special requirements or notes for the project..."
                    : "Let us know what we can improve or adjust..."
                  }
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => setIsResponseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={submitResponse}
                  disabled={respondMutation.isPending}
                  variant={responseType === "accepted" ? "default" : "destructive"}
                >
                  {respondMutation.isPending ? "Submitting..." : 
                   responseType === "accepted" ? "Accept Quote" : "Decline Quote"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Company Footer */}
      <div className="bg-white border-t mt-8">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Company Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border">
                  <img src={kolmoLogo} alt="Kolmo Construction" className="w-8 h-8 object-contain" />
                </div>
                <h3 className="font-bold text-lg text-primary">Kolmo Construction</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Professional home improvement services with over a decade of experience in the Pacific Northwest.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Licensed, Bonded & Insured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>EPA Lead-Safe Certified</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="font-semibold mb-4">Contact Information</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">(206) 410-5100</p>
                    <p className="text-muted-foreground"></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">projects@kolmo.io</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">Seattle, WA & Surrounding Areas</p>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Simple Footer */}
      <div className="bg-white border-t">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              © 2024 Kolmo Construction. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}