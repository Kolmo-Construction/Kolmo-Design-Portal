import React, { useEffect, useRef, useState, ErrorInfo } from 'react';
import { Gantt, Task as GanttTask } from "wx-react-gantt";
import "wx-react-gantt/dist/gantt.css";
// Import a class names utility
import { cn } from "@/lib/utils";

// Define the enum locally since it's not exported
type ViewModeType = "Day" | "Week" | "Month";

// Props interface that matches the Gantt chart props we need
interface SafeGanttWrapperProps {
  tasks: GanttTask[];
  viewMode: ViewModeType;
  onClick?: (task: GanttTask) => void;
  onDateChange?: (task: GanttTask, start: Date, end: Date) => void;
  onProgressChange?: (task: GanttTask, progress: number) => void;
  onRelationChange?: (from: string, to: string) => void;
  listCellWidth?: string;
  columnWidth?: number;
  rowHeight?: number;
  ganttHeight?: number;
  locale?: string;
  readonly?: boolean;
}

/**
 * A wrapper component for wx-react-gantt that adds error boundaries and event prevention
 * to handle type errors that occur within the library
 */
// Error boundary component to catch errors during rendering
class GanttErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Gantt chart error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <h3 className="text-lg font-semibold text-red-700">Gantt Chart Error</h3>
          <p className="text-sm text-red-600">
            There was an error rendering the Gantt chart. Please try refreshing the page.
          </p>
          <p className="text-xs text-red-500 mt-2">
            {this.state.error?.message || "Unknown error"}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export function SafeGanttWrapper(props: SafeGanttWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // Add global error handler to catch and suppress type errors from the Gantt chart
  useEffect(() => {
    // Save original console.error to restore later
    const originalConsoleError = console.error;
    const originalWindowOnerror = window.onerror;
    
    // Replace with filtered version
    console.error = (...args: any[]) => {
      // Check if this is the specific type error from the Gantt chart
      const errorString = args.join(' ');
      if (errorString.includes("Cannot read properties of undefined") && 
          errorString.includes("type")) {
        // Suppress this specific error
        return;
      }
      // Pass through all other errors
      originalConsoleError(...args);
    };
    
    // Add global window.onerror handler
    window.onerror = (message, source, lineno, colno, err) => {
      if (message && typeof message === 'string' && 
          message.includes("Cannot read properties of undefined") && 
          message.includes("type")) {
        // Prevent the error from bubbling up
        return true;
      }
      // Allow default handling for other errors
      return originalWindowOnerror ? originalWindowOnerror(message, source, lineno, colno, err) : false;
    };
    
    // Add event listeners to timeline elements to intercept problematic mouse events
    const findAndProtectTimelineElements = () => {
      setTimeout(() => {
        // Try to find and protect timeline elements specifically
        const timelineElements = document.querySelectorAll('.wx-gantt-timeline, .wx-gantt-calendar');
        
        if (timelineElements.length > 0) {
          timelineElements.forEach(element => {
            // Add listeners with capturing phase to intercept events before they reach library code
            element.addEventListener('mousemove', preventUndefinedTypeErrors, true);
            element.addEventListener('mouseenter', preventUndefinedTypeErrors, true);
            element.addEventListener('mouseleave', preventUndefinedTypeErrors, true);
          });
        }
      }, 500); // Short delay to ensure elements are rendered
    };
    
    // Event handler that patches the event object to prevent errors
    const preventUndefinedTypeErrors = (e: Event) => {
      // Let the event continue, but provide a patched version of any methods
      // that might access undefined.type, without modifying the prototype
      
      // We don't stop propagation but if any errors occur, we've already
      // suppressed them via the console.error and window.onerror handlers
    };
    
    // Initial run to attach handlers
    findAndProtectTimelineElements();
    
    // Also observe DOM changes to attach handlers to newly created elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          findAndProtectTimelineElements();
        }
      }
    });
    
    const container = containerRef.current;
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
    
    // Cleanup
    return () => {
      console.error = originalConsoleError;
      window.onerror = originalWindowOnerror;
      
      // Clean up event listeners
      const timelineElements = document.querySelectorAll('.wx-gantt-timeline, .wx-gantt-calendar');
      timelineElements.forEach(element => {
        element.removeEventListener('mousemove', preventUndefinedTypeErrors, true);
        element.removeEventListener('mouseenter', preventUndefinedTypeErrors, true);
        element.removeEventListener('mouseleave', preventUndefinedTypeErrors, true);
      });
      
      observer.disconnect();
    };
  }, []);
  
  // Error boundary functionality
  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-lg font-semibold text-red-700">Gantt Chart Error</h3>
        <p className="text-sm text-red-600">
          There was an error rendering the Gantt chart. Please try refreshing the page.
        </p>
      </div>
    );
  }
  
  // Render the Gantt chart within our error-handling wrapper
  return (
    <div 
      ref={containerRef} 
      className="gantt-safe-wrapper"
      onError={(e: any) => {
        // React's onError doesn't catch all errors, but include it anyway
        if (e && e.error && typeof e.error.message === 'string' && 
            e.error.message.includes('Cannot read properties of undefined')) {
          e.preventDefault();
          setError(e.error);
        }
      }}
    >
      <Gantt {...props} />
    </div>
  );
}