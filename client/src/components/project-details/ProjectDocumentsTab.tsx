import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";
// REMOVED: format import from date-fns
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, FolderOpen, FileIcon, Image as ImageIcon } from "lucide-react";
// ADDED Imports from utils
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";

interface ProjectDocumentsTabProps {
  projectId: number;
}

// REMOVED: Local getFileIcon helper function
// REMOVED: Local formatFileSize helper function
// REMOVED: Local formatDate helper function

export function ProjectDocumentsTab({ projectId }: ProjectDocumentsTabProps) {
  const {
    data: documents = [],
    isLoading: isLoadingDocuments
  } = useQuery<Document[]>({
    queryKey: [`/api/projects/${projectId}/documents`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Handle document download
  const handleDownload = (document: Document) => {
    if (document.fileUrl) {
      window.open(document.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Documents</CardTitle>
        <CardDescription>Access all documents related to your project</CardDescription>
        {/* TODO: Add Upload button here if needed, triggering a dialog */}
      </CardHeader>
      <CardContent>
        {isLoadingDocuments ? (
           <div className="flex justify-center py-8">
             <Loader2 className="h-8 w-8 animate-spin text-primary-600" />

          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary-50 p-3 mb-4">
              <FolderOpen className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-slate-500">No documents have been uploaded for this project yet.</p>

          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 border rounded-md hover:bg-slate-50 flex items-center justify-between transition-colors">
                <div className="flex items-center min-w-0 mr-4"> {/* Allow content to shrink */}

                  <div className="p-2 bg-slate-100 rounded mr-4 flex-shrink-0">
                    {getFileIcon(doc.fileType)} {/* USE Imported getFileIcon */}
                  </div>
                  <div className="min-w-0"> {/* Allow text to truncate */}
                    <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>

                    <p className="text-xs text-slate-500 truncate">
                      {doc.category ? doc.category.charAt(0).toUpperCase() + doc.category.slice(1) : 'Uncategorized'} • {formatFileSize(doc.fileSize)} {/* USE Imported formatFileSize */}

                    </p>
                    {doc.description && <p className="text-xs text-slate-400 mt-0.5 truncate" title={doc.description}>{doc.description}</p>}
                     <p className="text-xs text-slate-400 mt-0.5">Uploaded on {formatDate(doc.createdAt)}</p> {/* USE Imported formatDate */}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-primary-600 gap-2 flex-shrink-0" // Prevent button from shrinking
                  onClick={() => handleDownload(doc)}

                  disabled={!doc.fileUrl}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>

            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}