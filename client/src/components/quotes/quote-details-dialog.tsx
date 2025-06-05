import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, DollarSignIcon, UserIcon, MapPinIcon } from "lucide-react";
import type { CustomerQuote } from "@shared/schema";

interface QuoteDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: CustomerQuote | null;
}

export default function QuoteDetailsDialog({ 
  open, 
  onOpenChange, 
  quote 
}: QuoteDetailsDialogProps) {
  if (!quote) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'viewed': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Quote Details: {quote.quoteNumber}
            <Badge className={getStatusColor(quote.status)}>
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Complete details for {quote.projectTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Project Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Project Type</p>
                <p className="text-sm">{quote.projectType}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Project Title</p>
                <p className="text-sm">{quote.projectTitle}</p>
              </div>
              {quote.projectLocation && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Location</p>
                  <p className="text-sm flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    {quote.projectLocation}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500">Description</p>
              <p className="text-sm mt-1">{quote.projectDescription}</p>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-sm flex items-center">
                  <UserIcon className="h-4 w-4 mr-1" />
                  {quote.customerName}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-sm">{quote.customerEmail}</p>
              </div>
              {quote.customerPhone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-sm">{quote.customerPhone}</p>
                </div>
              )}
              {quote.customerAddress && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="text-sm">{quote.customerAddress}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Pricing Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Pricing</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Subtotal</span>
                <span className="text-sm font-medium">${quote.subtotal}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Tax</span>
                <span className="text-sm font-medium">${quote.taxAmount}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-lg font-bold text-green-600 flex items-center">
                  <DollarSignIcon className="h-5 w-5 mr-1" />
                  {quote.totalAmount}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Timeline</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quote.estimatedStartDate && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Estimated Start</p>
                  <p className="text-sm flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {new Date(quote.estimatedStartDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {quote.estimatedCompletionDate && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Estimated Completion</p>
                  <p className="text-sm flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {new Date(quote.estimatedCompletionDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Valid Until</p>
                <p className="text-sm flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {new Date(quote.validUntil).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          {(quote.downPaymentPercentage || quote.acceptsCreditCards) && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Payment Terms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quote.downPaymentPercentage && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Down Payment</p>
                      <p className="text-sm">{quote.downPaymentPercentage}%</p>
                    </div>
                  )}
                  {quote.milestonePaymentPercentage && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Milestone Payment</p>
                      <p className="text-sm">{quote.milestonePaymentPercentage}%</p>
                    </div>
                  )}
                  {quote.finalPaymentPercentage && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Final Payment</p>
                      <p className="text-sm">{quote.finalPaymentPercentage}%</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">Credit Cards Accepted</p>
                    <p className="text-sm">{quote.acceptsCreditCards ? 'Yes' : 'No'}</p>
                  </div>
                  {quote.creditCardProcessingFee && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Processing Fee</p>
                      <p className="text-sm">{quote.creditCardProcessingFee}%</p>
                    </div>
                  )}
                </div>
                {quote.milestoneDescription && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-500">Milestone Description</p>
                    <p className="text-sm mt-1">{quote.milestoneDescription}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Permits */}
          {quote.permitRequired && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Permits</h3>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Permit Required: Yes</p>
                  {quote.permitDetails && (
                    <p className="text-sm text-gray-600">{quote.permitDetails}</p>
                  )}
                </div>
              </div>
            </>
          )}



          {/* Color Verification */}
          {quote.showColorVerification && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {quote.colorVerificationTitle || "Color Verification"}
                </h3>
                {quote.colorVerificationDescription && (
                  <p className="text-sm text-gray-600 mb-4">{quote.colorVerificationDescription}</p>
                )}
                {quote.paintColors && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Paint Colors:</p>
                    <div className="space-y-1">
                      {Object.entries(quote.paintColors).map(([location, color]) => (
                        <div key={location} className="flex justify-between">
                          <span className="text-sm">{location}:</span>
                          <span className="text-sm font-medium">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Customer Response */}
          {quote.customerResponse && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Customer Response</h3>
                <div className={`p-4 rounded-lg ${
                  quote.customerResponse === 'accepted' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className="text-sm font-medium mb-2">
                    Status: {quote.customerResponse.charAt(0).toUpperCase() + quote.customerResponse.slice(1)}
                  </p>
                  {quote.respondedAt && (
                    <p className="text-sm text-gray-600 mb-2">
                      Responded: {new Date(quote.respondedAt).toLocaleDateString()}
                    </p>
                  )}
                  {quote.customerNotes && (
                    <p className="text-sm">{quote.customerNotes}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-3">Quote History</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-500">Created</p>
                <p>{new Date(quote.createdAt).toLocaleString()}</p>
              </div>
              {quote.viewedAt && (
                <div>
                  <p className="font-medium text-gray-500">Viewed by Customer</p>
                  <p>{new Date(quote.viewedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}