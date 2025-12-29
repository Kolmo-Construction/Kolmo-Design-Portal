import React from 'react';
import { ClientNavigation } from '@/components/ClientNavigation';
import { ProjectPhotoGallery } from '@/components/client/ProjectPhotoGallery';

export default function PhotosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <ClientNavigation />
      <div className="container mx-auto px-6 pt-24 pb-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Project Photos</h1>
            <p className="text-muted-foreground">
              View all photos from your projects
            </p>
          </div>

          <ProjectPhotoGallery />
        </div>
      </div>
    </div>
  );
}
