import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Import DialogClose for the close button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react"; // Import navigation icons
import { DailyLogPhoto } from "@shared/schema"; // Import the photo type

interface PhotoViewerDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  photos: DailyLogPhoto[] | null | undefined; // Array of photos to display
  startIndex?: number; // Optional index to start viewing from
}

export function PhotoViewerDialog({
  isOpen,
  setIsOpen,
  photos = [], // Default to empty array if null/undefined
  startIndex = 0,
}: PhotoViewerDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Effect to set the starting index when the dialog opens or photos/startIndex change
  useEffect(() => {
    if (isOpen && photos && photos.length > 0) {
      const validStartIndex = Math.max(0, Math.min(startIndex, photos.length - 1));
      setCurrentIndex(validStartIndex);
    }
  }, [isOpen, photos, startIndex]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
  }, []);

  const goToNext = useCallback(() => {
    if (photos && photos.length > 0) {
      setCurrentIndex((prevIndex) =>
        prevIndex < photos.length - 1 ? prevIndex + 1 : prevIndex
      );
    }
  }, [photos]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      } else if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, goToPrevious, goToNext, setIsOpen]);

  const currentPhoto = photos?.[currentIndex];
  const totalPhotos = photos?.length ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl p-0"> {/* Wider dialog, remove default padding */}
        <DialogHeader className="p-4 border-b">
          <DialogTitle>View Photos</DialogTitle>
           {/* Display caption if available */}
           {currentPhoto?.caption && (
               <DialogDescription>{currentPhoto.caption}</DialogDescription>
           )}
        </DialogHeader>

        {/* Main Content Area */}
        <div className="relative p-4 flex justify-center items-center min-h-[50vh] max-h-[75vh] bg-muted/30">
          {/* Previous Button */}
          {totalPhotos > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/50 hover:bg-background/80 text-foreground"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Image Display */}
          {currentPhoto ? (
            <img
              src={currentPhoto.photoUrl}
              alt={currentPhoto.caption || `Photo ${currentIndex + 1} of ${totalPhotos}`}
              className="max-w-full max-h-[70vh] object-contain block" // Ensure image scales correctly
            />
          ) : (
            <div className="text-center text-muted-foreground">
                {photos && photos.length === 0 ? "No photos available." : "Loading photo..."}
            </div>
          )}

          {/* Next Button */}
          {totalPhotos > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/50 hover:bg-background/80 text-foreground"
              onClick={goToNext}
              disabled={currentIndex === totalPhotos - 1}
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* Footer with index and close button */}
        <DialogFooter className="p-3 border-t flex justify-between items-center">
           <div className="text-sm text-muted-foreground">
               {totalPhotos > 0 ? `Photo ${currentIndex + 1} of ${totalPhotos}` : "No photos"}
           </div>
           {/* Use DialogClose for better accessibility */}
           <DialogClose asChild>
              <Button type="button" variant="secondary">
                  Close
              </Button>
           </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}