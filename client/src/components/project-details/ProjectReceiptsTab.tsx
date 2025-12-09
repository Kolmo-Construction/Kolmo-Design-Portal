import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt,
  Upload,
  Scan,
  RefreshCw,
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle,
  AlertCircle,
  Brain
} from "lucide-react";

interface ProjectReceiptsTabProps {
  project: Project;
}

interface OCRConfig {
  taggun?: {
    configured: boolean;
    connected: boolean;
    message: string;
  };
  gemini?: {
    configured: boolean;
    connected: boolean;
    message: string;
  };
  activeService: string;
  message: string;
}

interface ProcessedReceipt {
  id: string;
  projectId: number;
  amount: number;
  merchant: string;
  date: string;
  category: string;
  confidence: number;
  status: 'pending' | 'processed' | 'error';
}

export function ProjectReceiptsTab({ project }: ProjectReceiptsTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch OCR service configuration (Gemini/Taggun)
  const { data: ocrConfig } = useQuery<OCRConfig>({
    queryKey: ['/api/taggun/status'],
  });

  // Fetch project receipts
  const { data: receiptsData, isLoading: isLoadingReceipts } = useQuery({
    queryKey: [`/api/taggun/receipts/${project.id}`],
    enabled: !!project.id,
  });

  // Scan receipt mutation
  const scanReceiptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await fetch(`/api/taggun/projects/${project.id}/scan`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to scan receipt');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Receipt Scanned",
        description: `Successfully scanned receipt from ${data.receipt.merchant} for $${data.receipt.amount}`,
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: [`/api/taggun/receipts/${project.id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Scan Failed",
        description: error?.message || "Failed to scan receipt",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleScan = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a receipt image to scan",
        variant: "destructive",
      });
      return;
    }

    scanReceiptMutation.mutate(selectedFile);
  };

  const isGeminiActive = ocrConfig?.activeService === 'gemini';
  const isConfigured = ocrConfig?.gemini?.configured || ocrConfig?.taggun?.configured;

  if (!isConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receipt Scanning
          </CardTitle>
          <CardDescription>
            Receipt OCR is not configured. Contact your administrator to set up receipt scanning.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const receipts: ProcessedReceipt[] = receiptsData?.receipts || [];
  const totalAmount = receiptsData?.totalAmount || 0;
  const averageConfidence = receiptsData?.averageConfidence || 0;

  return (
    <div className="space-y-6">
      {/* Receipt Scanning Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan Receipt
          </CardTitle>
          <CardDescription>
            {isGeminiActive ? (
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                Upload a receipt image to extract data using Gemini AI
              </span>
            ) : (
              "Upload a receipt image to extract data using AI OCR"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border-2 border-dashed rounded-lg">
            <div className="flex flex-col items-center justify-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <Label htmlFor="receipt-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>Choose Receipt Image</span>
                </Button>
                <Input
                  id="receipt-upload"
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </Label>
              {selectedFile && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </div>
              )}
            </div>
          </div>

          {selectedFile && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <Label className="text-sm font-medium text-blue-800">Ready to Scan</Label>
                <div className="mt-1 text-sm text-blue-700">
                  Click "Scan Receipt" to extract data from {selectedFile.name}
                </div>
              </div>

              <Button
                onClick={handleScan}
                disabled={scanReceiptMutation.isPending}
                className="w-full flex items-center gap-2"
              >
                {scanReceiptMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Scan className="h-4 w-4" />
                )}
                {scanReceiptMutation.isPending ? 'Scanning...' : 'Scan Receipt'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Receipt Summary
          </CardTitle>
          <CardDescription>
            Overview of scanned receipts for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {receipts.length}
              </div>
              <div className="text-sm text-blue-600">Total Receipts</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${totalAmount.toLocaleString()}
              </div>
              <div className="text-sm text-green-600">Total Amount</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(averageConfidence)}%
              </div>
              <div className="text-sm text-purple-600">Avg Confidence</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Receipts Card */}
      {receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recent Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {receipts.slice(0, 5).map((receipt) => (
                <div key={receipt.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{receipt.merchant}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(receipt.date).toLocaleDateString()} • {receipt.category}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${receipt.amount.toFixed(2)}</div>
                      <div className="flex items-center gap-1 text-sm">
                        <div className="w-16">
                          <Progress value={receipt.confidence * 100} className="h-2" />
                        </div>
                        <span className="text-muted-foreground">{Math.round(receipt.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI OCR Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isGeminiActive ? (
              <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                <Brain className="h-5 w-5 text-purple-600" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-purple-600">Active</Badge>
                    <span className="font-medium">Gemini 2.0 Flash</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ocrConfig?.gemini?.message || "Using Google's Gemini AI for receipt scanning"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant={ocrConfig?.taggun?.connected ? "default" : "destructive"}>
                  {ocrConfig?.taggun?.connected ? "Connected" : "Disconnected"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {ocrConfig?.message}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
