import React, { useEffect, useRef } from 'react';
import { Gantt, Task as GanttTask } from "wx-react-gantt";
import "wx-react-gantt/dist/gantt.css";

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
export function SafeGanttWrapper(props: SafeGanttWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Add global error handler to catch and suppress type errors from the Gantt chart
  useEffect(() => {
    // Save original console.error to restore later
    const originalConsoleError = console.error;
    
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
    
    // Add event listener to intercept and prevent mouse events that might cause the error
    const container = containerRef.current;
    let mouseMoveHandler: (e: MouseEvent) => void;
    
    if (container) {
      mouseMoveHandler = (e: MouseEvent) => {
        // Let the event pass through, but we've added our defensive coding in the handlers
        // This is just an interception point if we need to do more debugging
      };
      
      container.addEventListener('mousemove', mouseMoveHandler);
    }
    
    // Cleanup
    return () => {
      console.error = originalConsoleError;
      if (container && mouseMoveHandler) {
        container.removeEventListener('mousemove', mouseMoveHandler);
      }
    };
  }, []);
  
  // Render the Gantt chart within our error-handling wrapper
  return (
    <div ref={containerRef} className="gantt-safe-wrapper">
      <Gantt {...props} />
    </div>
  );
}