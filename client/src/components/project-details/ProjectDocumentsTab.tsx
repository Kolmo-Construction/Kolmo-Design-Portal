import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Document, Project } from "@shared/schema";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
// REMOVED: format import from date-fns
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, FolderOpen, FileIcon, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
// ADDED Imports from utils
import { formatDate, formatFileSize, getFileIcon } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProjectDocumentsTabProps {
  projectId: number;
}

// REMOVED: Local getFileIcon helper function
// REMOVED: Local formatFileSize helper function
// REMOVED: Local formatDate helper function

// Define form schema for document upload
const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: "Please select a file to upload" }),
  description: z.string().optional(),
  category: z.string().default("GENERAL"),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

export function ProjectDocumentsTab({ projectId }: ProjectDocumentsTabProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Get project data to check if current user is project manager
  const { data: project } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });
  
  const {
    data: documents = [],
    isLoading: isLoadingDocuments
  } = useQuery<Document[]>({
    queryKey: [`/api/projects/${projectId}/documents`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });
  
  // Function to check if user can delete documents
  const canDeleteDocument = () => {
    if (!user) return false;
    
    // Admin can always delete
    if (user.role === 'ADMIN') return true;
    
    // Project managers can delete for their projects
    if (user.role === 'PROJECT_MANAGER' && project?.projectManagerId === user.id) return true;
    
    // All other users cannot delete
    return false;
  };

  // Initialize form with react-hook-form
  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      description: "",
      category: "GENERAL",
    },
  });

  // Handle document download
  const handleDownload = async (document: Document) => {
    try {
      // Use the document download API endpoint instead of direct fileUrl
      const response = await fetch(`/api/projects/${projectId}/documents/${document.id}/download`);
      const data = await response.json();
      
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: "Download Failed",
          description: "Could not generate download link",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download Error",
        description: "There was a problem downloading the file",
        variant: "destructive",
      });
      console.error("Download error:", error);
    }
  };
  
  // Handle document upload
  // Handle document deletion
  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${documentToDelete.id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Delete failed" }));
        throw new Error(errorData.message || "Failed to delete document");
      }
      
      // Success - refresh document list
      await queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      
      toast({
        title: "Document Deleted",
        description: "The document was successfully deleted",
      });
      
      // Close dialog
      setIsDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "There was a problem deleting the document",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Open delete confirmation dialog
  const confirmDeleteDocument = (document: Document) => {
    setDocumentToDelete(document);
    setIsDeleteDialogOpen(true);
  };

  const handleUpload = async (values: UploadFormValues) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", values.file);
      
      if (values.description) {
        formData.append("description", values.description);
      }
      
      formData.append("category", values.category);
      
      // Use fetch directly for file uploads since apiRequest may not handle FormData correctly
      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
        // Don't set Content-Type - it will be set automatically with boundary
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || "Failed to upload document");
      }
      
      // Success - refresh document list
      await queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      
      toast({
        title: "Document Uploaded",
        description: "Your document was uploaded successfully",
      });
      
      // Close dialog and reset form
      setIsUploadDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "There was a problem uploading your document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Project Documents</CardTitle>
            <CardDescription>Access all documents related to your project</CardDescription>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="ml-auto gap-2"
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
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
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4 gap-2"
                onClick={() => setIsUploadDialogOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Upload Your First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 border rounded-md hover:bg-slate-50 flex items-center justify-between transition-colors">
                  <div className="flex items-center min-w-0 mr-4"> {/* Allow content to shrink */}
                    <div className="p-2 bg-slate-100 rounded mr-4 flex-shrink-0">
                      {getFileIcon(doc.fileType)}
                    </div>
                    <div className="min-w-0"> {/* Allow text to truncate */}
                      <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {doc.category ? doc.category.charAt(0).toUpperCase() + doc.category.slice(1) : 'Uncategorized'} • {formatFileSize(doc.fileSize)}
                      </p>
                      {doc.description && <p className="text-xs text-slate-400 mt-0.5 truncate" title={doc.description}>{doc.description}</p>}
                       <p className="text-xs text-slate-400 mt-0.5">Uploaded on {formatDate(doc.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                    
                    {/* Only show delete button for admin and project managers on their projects */}
                    {canDeleteDocument() && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive gap-2 flex-shrink-0"
                        onClick={() => confirmDeleteDocument(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Document Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-[485px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document to this project. Supported file types include PDF, images, and common document formats.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-4">
              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, value, ...rest }, fieldState }) => (
                  <FormItem>
                    <FormLabel>File</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onChange(file);
                          }
                        }}
                        {...rest}
                      />
                    </FormControl>
                    {fieldState.error && (
                      <FormMessage>{fieldState.error.message}</FormMessage>
                    )}
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of the document" 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone
              and the document will be permanently removed from the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // Prevent dialog from closing automatically
                handleDeleteDocument();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>Delete</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}