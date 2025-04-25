import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Document, Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  RefreshCcw
} from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

export default function Documents() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Create query params with date filters
  const createParams = () => {
    const params = new URLSearchParams();
    if (startDate) {
      params.append('startDate', startDate.toISOString());
    }
    if (endDate) {
      params.append('endDate', endDate.toISOString());
    }
    return params.toString();
  };
  
  // Prepare query string for documents endpoint
  const documentsQueryString = createParams();

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all documents across all projects
  const { 
    data: allDocuments = [],
    isLoading: isLoadingDocuments,
    refetch: refetchDocuments
  } = useQuery<Document[]>({
    queryKey: ["/api/documents", documentsQueryString],
    enabled: projects.length > 0,
  });

  // Get unique document categories
  const categories = Array.from(new Set(allDocuments.map(doc => doc.category)));

  // Filter documents based on project, category and search query
  const filteredDocuments = allDocuments.filter(doc => {
    const matchesProject = projectFilter === "all" || doc.projectId.toString() === projectFilter;
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (doc.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesCategory && matchesSearch;
  });

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes("image")) {
      return <ImageIcon className="h-6 w-6 text-primary-600" />;
    } else if (fileType.includes("pdf")) {
      return <FileText className="h-6 w-6 text-red-600" />;
    } else {
      return <FileIcon className="h-6 w-6 text-blue-600" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  // Format date
  const formatDate = (dateString: string | Date) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Handle document download
  const handleDownload = (document: Document) => {
    window.open(document.fileUrl, '_blank');
  };

  // Reset date filters
  const resetDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    refetchDocuments();
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Document Center</h1>
          <p className="text-slate-600">Access all documents related to your construction projects</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium text-slate-500 mb-1 block">Project</label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-500 mb-1 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="relative">
                <label className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search documents by name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            {/* Date Range Filter */}
            <div className="border-t pt-4 mt-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-500 block">Date Filters</label>
                  <div className="flex space-x-4">
                    <div>
                      <span className="text-xs text-slate-500 mb-1 block">Start Date</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-[140px] justify-start text-left font-normal ${
                              !startDate && "text-slate-400"
                            }`}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div>
                      <span className="text-xs text-slate-500 mb-1 block">End Date</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-[140px] justify-start text-left font-normal ${
                              !endDate && "text-slate-400"
                            }`}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchDocuments()}
                    disabled={!startDate && !endDate}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Apply Filters
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetDateFilters}
                    disabled={!startDate && !endDate}
                  >
                    Clear Dates
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Project Documents</CardTitle>
              <CardDescription>
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            {filteredDocuments.length > 0 && (
              <Button variant="outline" className="gap-2">
                <DownloadCloud className="h-4 w-4" />
                Download All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(isLoadingProjects || isLoadingDocuments) ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-4 border rounded-md flex items-center">
                    <div className="w-10 h-10 bg-slate-200 rounded mr-4"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                    </div>
                    <div className="w-20 h-8 bg-slate-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-primary-50 p-3 mb-4">
                  <FolderOpen className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Documents Found</h3>
                <p className="text-center text-slate-500 mb-6 max-w-md">
                  {allDocuments.length === 0 
                    ? "No documents have been uploaded to any of your projects yet."
                    : "No documents match your current filters. Try adjusting your search criteria."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDocuments.map((document) => {
                  // Find the project this document belongs to
                  const project = projects.find(p => p.id === document.projectId);
                  
                  return (
                    <div key={document.id} className="p-4 border rounded-md hover:bg-slate-50 flex items-center justify-between transition-colors">
                      <div className="flex items-center">
                        <div className="p-2 bg-primary-50 rounded mr-4">
                          {getFileIcon(document.fileType)}
                        </div>
                        <div>
                          <p className="font-medium">{document.name}</p>
                          <p className="text-sm text-slate-500">
                            {project?.name} • {document.category.charAt(0).toUpperCase() + document.category.slice(1)} • {formatFileSize(document.fileSize)}
                          </p>
                          {document.description && (
                            <p className="text-xs text-slate-400 mt-1">{document.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">Uploaded on {formatDate(document.createdAt)}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-primary-600 gap-2"
                        onClick={() => handleDownload(document)}
                      >
                        <Download className="h-4 w-4" />
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