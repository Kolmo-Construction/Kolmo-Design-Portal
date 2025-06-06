import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, X, MessageSquare, Calendar, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuoteResponse {
  id: number;
  quoteNumber: string;
  title: string;
  description?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  projectType: string;
  location?: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  downPaymentPercentage: number;
  milestonePaymentPercentage: number;
  finalPaymentPercentage: number;
  milestoneDescription?: string;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  validUntil: string;
  status: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeImageCaption?: string;
  afterImageCaption?: string;
  projectNotes?: string;
  scopeDescription?: string;
  lineItems?: Array<{
    id: number;
    category: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    totalPrice: string;
  }>;
  responses?: Array<{
    id: number;
    action: string;
    customerName?: string;
    customerEmail?: string;
    message?: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [showResponse, setShowResponse] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: [`/api/quotes/public/${token}`],
    enabled: !!token,
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (data: { action: string; customerName: string; customerEmail: string; message: string }) => {
      return await apiRequest(`/api/quotes/public/${token}/respond`, "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Response Sent",
        description: "Your response has been sent successfully",
      });
      setShowResponse(false);
      // Refresh the quote data
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send response",
        variant: "destructive",
      });
    },
  });

  const handleResponse = (action: 'accepted' | 'declined') => {
    if (!customerName || !customerEmail) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email",
        variant: "destructive",
      });
      return;
    }

    respondMutation.mutate({
      action,
      customerName,
      customerEmail,
      message,
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const isExpired = quote && new Date() > new Date(quote.validUntil);
  const hasResponded = quote?.responses && quote.responses.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
              <p className="text-gray-600 mb-4">
                The quote you're looking for doesn't exist or may have expired.
              </p>
              <p className="text-sm text-gray-500">
                Please check the link or contact us for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quoteData = quote as QuoteResponse;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <img src="/api/placeholder/40/40" alt="Kolmo Construction" className="h-10 w-10" />
                <div>
                  <h1 className="text-xl font-bold">Kolmo Construction</h1>
                  <p className="text-sm text-gray-600">Licensed, Bonded & Insured • EPA Lead-Safe Certified</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">(206) 410-5100</p>
              <p className="text-sm text-gray-600">projects@kolmo.io</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Quote Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Project Quote
                  <Badge variant={isExpired ? "destructive" : hasResponded ? "secondary" : "default"}>
                    {isExpired ? "Expired" : hasResponded ? "Responded" : "Pending"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Quote #{quoteData.quoteNumber}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Valid until {formatDate(quoteData.validUntil)}</div>
                <div className="text-sm text-gray-500">Created {formatDate(quoteData.createdAt)}</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Response Required Section */}
        {!hasResponded && !isExpired && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Clock className="h-5 w-5" />
                Response Required
              </CardTitle>
              <CardDescription className="text-blue-700">
                Please review this quote and let us know if you'd like to proceed. Valid until {formatDate(quoteData.validUntil)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  onClick={() => setShowResponse(true)}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Accept Quote
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowResponse(true)}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Decline Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle>{quoteData.title}</CardTitle>
            <CardDescription>{quoteData.projectType}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quoteData.description && (
                <p className="text-gray-700">{quoteData.description}</p>
              )}
              
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{quoteData.location || "Project location"}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium">Estimated Start</div>
                    <div className="text-sm text-gray-600">
                      {quoteData.estimatedStartDate ? formatDate(quoteData.estimatedStartDate) : "TBD"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium">Estimated Completion</div>
                    <div className="text-sm text-gray-600">
                      {quoteData.estimatedCompletionDate ? formatDate(quoteData.estimatedCompletionDate) : "TBD"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Breakdown */}
        {quoteData.lineItems && quoteData.lineItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Project Breakdown</CardTitle>
              <CardDescription>Detailed cost breakdown for your project</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quoteData.lineItems.map((item, index) => (
                  <div key={item.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{item.category}</div>
                        <div className="text-sm text-gray-600">{item.description}</div>
                        <div className="text-sm text-gray-500">
                          {parseFloat(item.quantity)} {item.unit} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(item.totalPrice)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Before/After Images */}
        {(quoteData.beforeImageUrl || quoteData.afterImageUrl) && (
          <Card>
            <CardHeader>
              <CardTitle>Project Transformation</CardTitle>
              <CardDescription>Conceptual view - not for acceptance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quoteData.beforeImageUrl && (
                  <div className="text-center">
                    <img 
                      src={quoteData.beforeImageUrl} 
                      alt="Before" 
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
                    <p className="text-sm text-gray-600">{quoteData.beforeImageCaption || "Before"}</p>
                  </div>
                )}
                {quoteData.afterImageUrl && (
                  <div className="text-center">
                    <img 
                      src={quoteData.afterImageUrl} 
                      alt="After" 
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
                    <p className="text-sm text-gray-600">{quoteData.afterImageCaption || "After"}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">
                <strong>Professional Transformation:</strong> See the quality difference our expert craftsmanship makes. 
                This is the level of excellence you can expect for your project.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quote Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Quote Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(quoteData.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(quoteData.taxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span>{formatCurrency(quoteData.total)}</span>
              </div>
              <div className="text-sm text-gray-500 text-center">
                Valid until {formatDate(quoteData.validUntil)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Down Payment</span>
                <span>{quoteData.downPaymentPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span>Milestone Payment</span>
                <span>{quoteData.milestonePaymentPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span>Final Payment</span>
                <span>{quoteData.finalPaymentPercentage}%</span>
              </div>
              {quoteData.milestoneDescription && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium mb-1">Milestone:</div>
                  <div className="text-sm text-gray-600">{quoteData.milestoneDescription}</div>
                </div>
              )}
              <div className="text-sm text-gray-500 mt-4">
                <strong>Credit Card Processing:</strong> A 3% processing fee will be added when paying with credit cards.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Scope */}
        {quoteData.scopeDescription && (
          <Card>
            <CardHeader>
              <CardTitle>Project Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p>{quoteData.scopeDescription}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>{quoteData.customerName}</strong>
              </div>
              <div>{quoteData.customerEmail}</div>
              {quoteData.customerPhone && <div>{quoteData.customerPhone}</div>}
              {quoteData.customerAddress && <div>{quoteData.customerAddress}</div>}
            </div>
            {quoteData.projectNotes && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <div className="text-sm font-medium mb-1">Project Notes</div>
                <div className="text-sm text-gray-600">{quoteData.projectNotes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Questions?
            </CardTitle>
            <CardDescription>
              Have questions about this quote? We're here to help.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">(206) 410-5100</p>
              <p className="text-gray-600">projects@kolmo.io</p>
              <p className="text-sm text-gray-500">Seattle, WA & Surrounding Areas</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 border-t">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/api/placeholder/40/40" alt="Kolmo Construction" className="h-8 w-8" />
            <span className="font-semibold">Kolmo Construction</span>
          </div>
          <p className="text-sm text-gray-600">
            Professional home improvement services with over a decade of experience in the Pacific Northwest.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Licensed, Bonded & Insured • EPA Lead-Safe Certified
          </p>
          <p className="text-xs text-gray-400 mt-4">
            © 2024 Kolmo Construction. All rights reserved.
          </p>
        </div>
      </div>

      {/* Response Dialog */}
      {showResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Respond to Quote</CardTitle>
              <CardDescription>
                Please provide your contact information and response
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Your Name</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email Address</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Any additional comments or questions..."
                  />
                </div>
              </div>
            </CardContent>
            <div className="flex justify-between p-6 pt-0">
              <Button variant="outline" onClick={() => setShowResponse(false)}>
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleResponse('declined')}
                  disabled={respondMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  Decline Quote
                </Button>
                <Button
                  onClick={() => handleResponse('accepted')}
                  disabled={respondMutation.isPending}
                >
                  Accept Quote
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}