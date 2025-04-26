// client/src/pages/documents.tsx
// Note: Renamed to .tsx for consistency with React components

import React, { useState } from "react"; // Import React
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth"; // [cite: 6187]
import TopNavBar from "@/components/TopNavBar"; // [cite: 6188]
import Sidebar from "@/components/Sidebar"; // [cite: 6188]
import { Document, Project } from "@shared/schema"; // [cite: 6188]
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"; // [cite: 6189]
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"; // [cite: 6190]
import { Input } from "@/components/ui/input"; // [cite: 6190]
import { Button } from "@/components/ui/button"; // [cite: 6191]
import {
  FileText,
  Search,
  Download,
  FolderOpen,
  FileIcon,
  Image as ImageIcon,
  DownloadCloud,
  Loader2,
  Calendar,
  RefreshCcw,
  Upload // Import Upload icon
} from "lucide-react"; // [cite: 6191]
import { format } from "date-fns"; // [cite: 6192]
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // [cite: 6192]
import { Calendar as CalendarComponent } from "@/components/ui/calendar"; // [cite: 6193]
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog"; // [cite: 6193] - Import Dialog components
import { UploadDocumentForm } from '@/components/UploadDocumentForm'; // Import the Upload Form

export default function Documents() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all"); // [cite: 6194]
  const [categoryFilter, setCategoryFilter] = useState<string>("all"); // [cite: 6194]
  const [searchQuery, setSearchQuery] = useState<string>(""); // [cite: 6194]
  const [startDate, setStartDate] = useState<Date | undefined>(undefined); // [cite: 6195]
  const [endDate, setEndDate] = useState<Date | undefined>(undefined); // [cite: 6195]
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false); // State for upload dialog

  // --- Authentication ---
  const { user } = useAuth(); // [cite: 6187]
  const canUploadGlobally = user?.role === 'admin' || user?.role === 'projectManager';
  // Determine if upload is possible based on role AND if a specific project is selected
  const canUploadToSelectedProject = canUploadGlobally && projectFilter !== "all";
  const selectedProjectId = projectFilter !== "all" ? parseInt(projectFilter, 10) : undefined;

  // Create query params with date filters [cite: 6196]
  const createParams = () => {
    const params = new URLSearchParams();
    if (startDate) { // [cite: 6197]
      params.append('startDate', startDate.toISOString());
    } // [cite: 6198]
    if (endDate) {
      params.append('endDate', endDate.toISOString());
    }
    return params.toString();
  }; // [cite: 6199]

  // Prepare query string for documents endpoint
  const documentsQueryString = createParams();

  // Fetch projects [cite: 6200]
  const {
    data: projects = [],
    isLoading: isLoadingProjects
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"], // Consider using a more specific query key if needed elsewhere
     // Placeholder for fetch function if not using default queryFn behavior
     // queryFn: async () => { /* your project fetch logic */ return []; }
  });

  // Fetch all documents across all projects [cite: 6201]
  const {
    data: allDocuments = [],
    isLoading: isLoadingDocuments,
    refetch: refetchDocuments,
    isRefetching // Added isRefetching state
  } = useQuery<Document[]>({
    // Use a more specific query key including filters
    queryKey: ["/api/documents", documentsQueryString],
     // queryFn: async ({ queryKey }) => {
     //   const [, params] = queryKey;
     //   const response = await fetch(`/api/documents?${params}`);
     //   if (!response.ok) throw new Error('Network response was not ok');
     //   return response.json();
     // },
     // Only enable if projects are loaded? Not strictly necessary for global documents endpoint
     // enabled: projects.length > 0,
  });

  // Get unique document categories [cite: 6202]
  const categories = Array.from(new Set(allDocuments.map(doc => doc.category).filter(Boolean))); // Filter out potential null/undefined categories

  // Filter documents based on project, category and search query [cite: 6203]
  const filteredDocuments = allDocuments.filter(doc => {
    const matchesProject = projectFilter === "all" || doc.projectId.toString() === projectFilter;
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (doc.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesCategory && matchesSearch;
  });

  // Get file icon based on file type [cite: 6204]
  const getFileIcon = (fileType: string | null) => { // Allow null fileType
    if (!fileType) return <FileIcon className="h-6 w-6 text-slate-400" />;
    if (fileType.includes("image")) {
      return <ImageIcon className="h-6 w-6 text-primary" />; // [cite: 6204] Use primary color
    } else if (fileType.includes("pdf")) { // [cite: 6205]
      return <FileText className="h-6 w-6 text-red-600" />; // [cite: 6205]
    } else { // [cite: 6206]
      return <FileIcon className="h-6 w-6 text-blue-600" />; // [cite: 6206]
    }
  };

  // Format file size [cite: 6207]
  const formatFileSize = (bytes: number | null) => { // Allow null size
    if (bytes === null || bytes === undefined) return "";
    if (bytes < 1024) {
      return `${bytes} B`; // [cite: 6207]
    } else if (bytes < 1024 * 1024) { // [cite: 6208]
      return `${(bytes / 1024).toFixed(1)} KB`; // [cite: 6208]
    } else if (bytes < 1024 * 1024 * 1024) { // [cite: 6209]
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; // [cite: 6209]
    } else { // [cite: 6210]
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`; // [cite: 6210]
    }
  };

  // Format date [cite: 6211]
  const formatDate = (dateString: string | Date | null) => { // Allow null date
    if (!dateString) return "";
    try {
        return format(new Date(dateString), "MMM d, yyyy"); // [cite: 6211] Use standard format
    } catch {
        return "Invalid Date";
    }
  };

  // Handle document download [cite: 6212]
  const handleDownload = (document: Document) => {
    if (document.fileUrl) {
        window.open(document.fileUrl, '_blank'); // [cite: 6212]
    }
  };

  // Reset date filters [cite: 6213]
  const resetDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    // Refetch documents after clearing dates to apply change
    refetchDocuments(); // [cite: 6213]
  };

  return ( // [cite: 6214]
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Document Center</h1>
          <p className="text-slate-600">Access all documents related to your construction projects</p>
        </div>

        {/* Filters */}
        <Card className="mb-6"> {/* [cite: 6215] */}
          <CardContent className="p-4 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="project-filter" className="text-sm font-medium text-slate-500 mb-1 block">Project</label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger id="project-filter"> {/* [cite: 6216] */}
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {isLoadingProjects ? (
                        <SelectItem value="loading" disabled>Loading projects...</SelectItem>
                    ) : (
                        projects.map(project => ( // [cite: 6217]
                        <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                        </SelectItem>
                        )) // [cite: 6218]
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="category-filter" className="text-sm font-medium text-slate-500 mb-1 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}> {/* [cite: 6219] */}
                  <SelectTrigger id="category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem> {/* [cite: 6220] */}
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem> // [cite: 6221]
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative"> {/* [cite: 6222] */}
                <label htmlFor="search-filter" className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="search-filter"
                    type="text" // [cite: 6223]
                    placeholder="Search documents by name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10" // [cite: 6224]
                  />
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="border-t pt-4 mt-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"> {/* [cite: 6225] */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-500 block">Date Filters</label>
                  <div className="flex flex-wrap gap-2 sm:space-x-4"> {/* Adjusted for wrapping */}
                    <div>
                      <span className="text-xs text-slate-500 mb-1 block">Start Date</span> {/* [cite: 6226] */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline" // [cite: 6227]
                            size="sm"
                            className={`w-[140px] justify-start text-left font-normal ${!startDate && "text-slate-400"}`} // [cite: 6228]
                          >
                            <Calendar className="mr-2 h-4 w-4" /> {/* [cite: 6229] */}
                            {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"} {/* [cite: 6230] */}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus // [cite: 6232]
                          /> {/* [cite: 6231] */}
                        </PopoverContent>
                      </Popover> {/* [cite: 6233] */}
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 mb-1 block">End Date</span>
                      <Popover> {/* [cite: 6234] */}
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm" // [cite: 6235]
                            className={`w-[140px] justify-start text-left font-normal ${!endDate && "text-slate-400"}`} // [cite: 6236]
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"} {/* [cite: 6237] */}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus // [cite: 6239]
                          /> {/* [cite: 6238] */}
                        </PopoverContent>
                      </Popover> {/* [cite: 6240] */}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2 sm:pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchDocuments()}
                    disabled={isRefetching || (!startDate && !endDate)} // Disable if no dates or already refetching
                  >
                    {isRefetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />} {/* [cite: 6242] */}
                    Apply Filters
                  </Button>
                  <Button
                    variant="ghost" // [cite: 6243]
                    size="sm"
                    onClick={resetDateFilters}
                    disabled={!startDate && !endDate} // Disable if no dates selected
                  >
                    Clear Dates {/* [cite: 6244] */}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card> {/* [cite: 6245] */}
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Project Documents</CardTitle>
              <CardDescription>
                {isLoadingDocuments ? "Loading..." : `${filteredDocuments.length} document${filteredDocuments.length !== 1 ? 's' : ''} found`} {/* [cite: 6246] */}
              </CardDescription>
            </div>
            {/* --- UPLOAD BUTTON & DIALOG (conditionally rendered) --- */}
            {canUploadToSelectedProject && selectedProjectId !== undefined && (
                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                    <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Document
                    </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Upload New Document</DialogTitle>
                        <DialogDescription>
                        Upload a document to the selected project ({projects.find(p => p.id === selectedProjectId)?.name || 'Unknown Project'}). Max file size: 15MB.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <UploadDocumentForm
                            projectId={selectedProjectId} // Pass the selected project ID
                            onUploadSuccess={() => setIsUploadDialogOpen(false)} // Close dialog on success
                        />
                    </div>
                    </DialogContent>
                </Dialog>
            )}
             {/* --- END UPLOAD BUTTON & DIALOG --- */}
             {/* Download All Button (placeholder, requires backend implementation) */}
            {/* {filteredDocuments.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2">
                <DownloadCloud className="h-4 w-4" />
                Download All
              </Button> // [cite: 6247]
            )} */}
          </CardHeader>
          <CardContent>
            {(isLoadingProjects || isLoadingDocuments) ? ( // [cite: 6248] - Loading state uses Skeleton concept
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => ( // Use different key
                  <div key={`skel-${i}`} className="p-4 border rounded-md flex items-center animate-pulse">
                    <div className="w-10 h-10 bg-slate-200 rounded mr-4"></div>
                    <div className="flex-1"> {/* [cite: 6249] */}
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                    <div className="w-24 h-8 bg-slate-200 rounded ml-4"></div> {/* [cite: 6250] */}
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? ( // [cite: 6251]
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-slate-100 p-3 mb-4">
                  <FolderOpen className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Documents Found</h3>
                <p className="text-sm text-slate-500 mb-6 max-w-md"> {/* [cite: 6252] */}
                  {allDocuments.length === 0
                    ? "No documents have been uploaded to any of your projects yet."
                    : "No documents match your current filters. Try adjusting your search criteria or clearing filters."} {/* [cite: 6253] */}
                </p>
              </div>
            ) : (
              <div className="space-y-3"> {/* Reduced spacing slightly */}
                {filteredDocuments.map((document) => {
                  // Find the project this document belongs to [cite: 6254]
                  const project = projects.find(p => p.id === document.projectId);

                  return (
                    <div key={document.id} className="p-3 border rounded-md hover:bg-slate-100 flex items-center justify-between transition-colors">
                      <div className="flex items-center flex-1 min-w-0 mr-4"> {/* [cite: 6255] */}
                        <div className="p-2 bg-slate-100 rounded mr-3 flex-shrink-0">
                          {getFileIcon(document.fileType)}
                        </div>
                        <div className="min-w-0"> {/* Allow text to truncate */}
                          <p className="font-medium text-sm truncate" title={document.name}>{document.name}</p>
                          <p className="text-xs text-slate-500 truncate"> {/* [cite: 6257] */}
                            {project?.name || 'Unknown Project'} • {document.category ? document.category.charAt(0).toUpperCase() + document.category.slice(1) : 'Uncategorized'} • {formatFileSize(document.size)}
                          </p>
                          {document.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate" title={document.description}>{document.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">Uploaded on {formatDate(document.createdAt)}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary gap-1.5 flex-shrink-0" // Ensure button doesn't shrink text
                        onClick={() => handleDownload(document)}
                        disabled={!document.fileUrl} // Disable if no URL
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}