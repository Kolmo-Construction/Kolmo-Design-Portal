import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import UpdateItem from "@/components/UpdateItem";
import { ProgressUpdate, Project, User, UpdateMedia } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
  Image,
  Search,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Filter
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProgressUpdates() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<UpdateMedia | null>(null);

  // Fetch projects
  const { 
    data: projects = [],
    isLoading: isLoadingProjects 
  } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all updates across all projects
  const { 
    data: allUpdates = [],
    isLoading: isLoadingUpdates 
  } = useQuery<ProgressUpdate[]>({
    queryKey: ["/api/updates"],
    enabled: projects.length > 0,
  });

  // Fetch users
  const { 
    data: users = [],
    isLoading: isLoadingUsers 
  } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch media
  const { 
    data: allMedia = [],
    isLoading: isLoadingMedia 
  } = useQuery<UpdateMedia[]>({
    queryKey: ["/api/media"],
    enabled: allUpdates.length > 0,
  });

  // Filter updates based on project, type and search query
  const filteredUpdates = allUpdates.filter(update => {
    const matchesProject = projectFilter === "all" || update.projectId.toString() === projectFilter;
    const matchesType = typeFilter === "all" || update.updateType === typeFilter;
    const matchesSearch = update.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         update.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesType && matchesSearch;
  });

  // Enrich updates with user and media data
  const enrichedUpdates = filteredUpdates.map(update => {
    return {
      ...update,
      createdBy: users.find(u => u.id === update.createdById),
      media: allMedia.filter(m => m.updateId === update.id)
    };
  });

  // Function to get type label
  const getUpdateTypeLabel = (type: string) => {
    switch (type) {
      case "milestone":
        return "Milestone";
      case "photo":
        return "Photo Update";
      case "issue":
        return "Issue";
      case "general":
        return "General Update";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Progress Updates</h1>
          <p className="text-slate-600">Track the progress of your construction projects</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="text-sm font-medium text-slate-500 mb-1 block">Update Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="milestone">Milestones</SelectItem>
                  <SelectItem value="photo">Photo Updates</SelectItem>
                  <SelectItem value="issue">Issues</SelectItem>
                  <SelectItem value="general">General Updates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="relative">
              <label className="text-sm font-medium text-slate-500 mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search updates by title or description"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Viewer Dialog */}
        <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Media View</DialogTitle>
            </DialogHeader>
            {selectedMedia && (
              <div className="flex flex-col items-center">
                <img 
                  src={selectedMedia.mediaUrl} 
                  alt={selectedMedia.caption || "Project update media"} 
                  className="max-h-[70vh] object-contain rounded-md"
                />
                {selectedMedia.caption && (
                  <p className="mt-4 text-slate-600 text-center">{selectedMedia.caption}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Content Tabs */}
        <Tabs defaultValue="timeline" className="mb-6">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            <TabsTrigger value="gallery">Photo Gallery</TabsTrigger>
          </TabsList>
          
          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Project Updates</CardTitle>
                <CardDescription>
                  {filteredUpdates.length} update{filteredUpdates.length !== 1 ? 's' : ''} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(isLoadingProjects || isLoadingUpdates || isLoadingUsers || isLoadingMedia) ? (
                  <div className="space-y-8">
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                    <UpdateItem isLoading={true} update={{} as ProgressUpdate} />
                  </div>
                ) : filteredUpdates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <FileText className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Updates Found</h3>
                    <p className="text-center text-slate-500 mb-6 max-w-md">
                      {allUpdates.length === 0 
                        ? "No progress updates have been posted for any of your projects yet."
                        : "No updates match your current filters. Try adjusting your search or filter criteria."}
                    </p>
                    {searchQuery || projectFilter !== "all" || typeFilter !== "all" ? (
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => {
                          setSearchQuery("");
                          setProjectFilter("all");
                          setTypeFilter("all");
                        }}
                      >
                        <Filter className="h-4 w-4" />
                        Clear Filters
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {enrichedUpdates.map((update) => (
                        <UpdateItem 
                          key={update.id} 
                          update={update}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
              {filteredUpdates.length > 10 && (
                <CardFooter className="justify-center border-t py-4">
                  <Button variant="outline">Load More Updates</Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
          
          {/* Gallery Tab */}
          <TabsContent value="gallery">
            <Card>
              <CardHeader>
                <CardTitle>Photo Gallery</CardTitle>
                <CardDescription>
                  Visual documentation of your project progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(isLoadingProjects || isLoadingUpdates || isLoadingMedia) ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <div key={i} className="aspect-square bg-slate-200 rounded-md"></div>
                    ))}
                  </div>
                ) : allMedia.filter(m => m.mediaType === "image").length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="rounded-full bg-primary-50 p-3 mb-4">
                      <Image className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Photos Available</h3>
                    <p className="text-center text-slate-500 mb-6 max-w-md">
                      No photos have been uploaded for your projects yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {allMedia
                      .filter(media => media.mediaType === "image")
                      .filter(media => {
                        // Check if the media's update passes our filters
                        const update = allUpdates.find(u => u.id === media.updateId);
                        if (!update) return false;
                        
                        const matchesProject = projectFilter === "all" || update.projectId.toString() === projectFilter;
                        return matchesProject;
                      })
                      .map((media) => {
                        const update = allUpdates.find(u => u.id === media.updateId);
                        const project = update ? projects.find(p => p.id === update.projectId) : undefined;
                        
                        return (
                          <DialogTrigger key={media.id} asChild onClick={() => setSelectedMedia(media)}>
                            <div className="relative aspect-square rounded-md overflow-hidden cursor-pointer group">
                              <img 
                                src={media.mediaUrl} 
                                alt={media.caption || "Project update"} 
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-end">
                                <div className="p-2 w-full bg-black bg-opacity-60 text-white transform translate-y-full group-hover:translate-y-0 transition-transform">
                                  <p className="text-sm truncate">{media.caption || (update?.title || 'Project Update')}</p>
                                  <p className="text-xs truncate text-gray-300">{project?.name || 'Project'}</p>
                                </div>
                              </div>
                            </div>
                          </DialogTrigger>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
