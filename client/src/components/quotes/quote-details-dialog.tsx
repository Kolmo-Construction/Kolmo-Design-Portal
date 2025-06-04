import { Calendar, MapPin, Phone, Mail, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuoteDetailsDialogProps {
  quote: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailsDialog({ quote, open, onOpenChange }: QuoteDetailsDialogProps) {
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const statusColors = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800", 
    viewed: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800",
    expired: "bg-gray-100 text-gray-800"
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Quote Details - {quote.quoteNumber}</span>
            <Badge className={statusColors[quote.status as keyof typeof statusColors]}>
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Project Information</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Title:</span> {quote.projectTitle}</p>
                <p><span className="font-medium">Type:</span> {quote.projectType}</p>
                {quote.projectLocation && (
                  <p className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {quote.projectLocation}
                  </p>
                )}
                {quote.estimatedStartDate && (
                  <p className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Start: {formatDate(quote.estimatedStartDate)}
                  </p>
                )}
                {quote.estimatedCompletionDate && (
                  <p className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Completion: {formatDate(quote.estimatedCompletionDate)}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Name:</span> {quote.customerName}</p>
                <p className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  {quote.customerEmail}
                </p>
                {quote.customerPhone && (
                  <p className="flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    {quote.customerPhone}
                  </p>
                )}
                {quote.customerAddress && (
                  <p className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {quote.customerAddress}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Project Description */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Project Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {quote.projectDescription}
            </p>
          </div>

          {/* Line Items */}
          {quote.lineItems && quote.lineItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Category</th>
                        <th className="text-left py-2">Description</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Unit Price</th>
                        <th className="text-right py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lineItems.map((item: any, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-3">{item.category}</td>
                          <td className="py-3">{item.description}</td>
                          <td className="text-right py-3">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="text-right py-3">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="text-right py-3 font-medium">
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(quote.taxAmount)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(quote.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          {quote.images && quote.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2" />
                  Project Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quote.images.map((image: any, index: number) => (
                    <div key={index} className="space-y-2">
                      <img
                        src={image.imageUrl}
                        alt={image.caption || "Project image"}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      {image.caption && (
                        <p className="text-sm text-gray-600">{image.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Terms */}
          {(quote.downPaymentPercentage || quote.acceptsCreditCards) && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quote.downPaymentPercentage && (
                  <p>
                    <span className="font-medium">Down Payment:</span> {quote.downPaymentPercentage}%
                  </p>
                )}
                {quote.milestonePaymentPercentage && (
                  <p>
                    <span className="font-medium">Milestone Payment:</span> {quote.milestonePaymentPercentage}%
                    {quote.milestoneDescription && ` (${quote.milestoneDescription})`}
                  </p>
                )}
                {quote.finalPaymentPercentage && (
                  <p>
                    <span className="font-medium">Final Payment:</span> {quote.finalPaymentPercentage}%
                  </p>
                )}
                {quote.acceptsCreditCards && (
                  <p>
                    <span className="font-medium">Credit Cards:</span> Accepted
                    {quote.creditCardProcessingFee && ` (${quote.creditCardProcessingFee}% processing fee)`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quote Status & Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{formatDate(quote.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Valid Until:</span>
                <span>{formatDate(quote.validUntil)}</span>
              </div>
              {quote.viewedAt && (
                <div className="flex justify-between">
                  <span>Viewed:</span>
                  <span>{formatDate(quote.viewedAt)}</span>
                </div>
              )}
              {quote.respondedAt && (
                <div className="flex justify-between">
                  <span>Responded:</span>
                  <span>{formatDate(quote.respondedAt)}</span>
                </div>
              )}
              {quote.customerResponse && (
                <div className="flex justify-between">
                  <span>Customer Response:</span>
                  <Badge className={quote.customerResponse === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {quote.customerResponse.charAt(0).toUpperCase() + quote.customerResponse.slice(1)}
                  </Badge>
                </div>
              )}
              {quote.customerNotes && (
                <div>
                  <span className="font-medium">Customer Notes:</span>
                  <p className="mt-1 p-3 bg-gray-50 rounded text-sm">{quote.customerNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}