import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AdminImageUploader } from '@/components/admin/AdminImageUploader';
import { AdminImageGalleryView } from '@/components/admin/AdminImageGalleryView';
import { DriveIngestionDialog } from '@/components/admin/DriveIngestionDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Grid3X3,
  BarChart3,
  Search,
  Filter,
  Images,
  TrendingUp,
  Cloud,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-unified';

interface ImageStats {
  totalImages: number;
  totalStorage: number;
  categoryStats: Array<{ category: string; count: number }>;
  popularTags: Array<{ tag: string; count: number }>;
}

export default function AdminImageGallery() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [driveDialogOpen, setDriveDialogOpen] = useState(false);

  // Check if user has admin or project manager access
  const hasAccess = user?.role === 'admin' || user?.role === 'projectManager';

  // Fetch image statistics
  const { data: stats, isLoading: statsLoading } = useQuery<ImageStats>({
    queryKey: ['/api/admin/images/stats'],
    enabled: hasAccess,
  });

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDriveIngestComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-6 py-24">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-8 pb-8 text-center">
            <Images className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-sm text-muted-foreground">
              Only administrators and project managers can access the image gallery.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-24 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Image Gallery</h1>
            <p className="text-muted-foreground">
              Upload and manage project images with tags and metadata
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setDriveDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Cloud className="h-4 w-4" />
            Import from Drive
          </Button>
          <Badge variant="outline">
            {stats?.totalImages || 0} images
          </Badge>
          <Badge variant="outline">
            {formatFileSize(stats?.totalStorage || 0)}
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Images className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalImages}</p>
                  <p className="text-sm text-muted-foreground">Total Images</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{formatFileSize(stats.totalStorage)}</p>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.categoryStats.length}</p>
                  <p className="text-sm text-muted-foreground">Categories</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Filter className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.popularTags.length}</p>
                  <p className="text-sm text-muted-foreground">Active Tags</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="gallery" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gallery" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Gallery
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search images..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="progress">Progress Photos</SelectItem>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="before_after">Before/After</SelectItem>
                    <SelectItem value="issues">Issues/Problems</SelectItem>
                    <SelectItem value="completed">Completed Work</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Image Gallery */}
          <AdminImageGalleryView
            searchQuery={searchQuery}
            categoryFilter={categoryFilter}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <AdminImageUploader onUploadComplete={handleUploadComplete} />
        </TabsContent>
      </Tabs>

      {/* Drive Ingestion Dialog */}
      <DriveIngestionDialog
        isOpen={driveDialogOpen}
        onOpenChange={setDriveDialogOpen}
        onIngestComplete={handleDriveIngestComplete}
      />
    </div>
  );
}