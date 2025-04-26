declare module 'wx-react-gantt' {
  interface Task {
    id: string;
    text: string;
    start: Date;
    end: Date;
    progress: number;
    type?: "task" | "milestone" | "project";
    dependencies?: string[];
    [key: string]: any; // Allow any additional properties
  }

  interface EventOption {
    // You can add specific event option properties if known
  }

  interface GanttProps {
    tasks: Task[];
    viewMode?: "Day" | "Week" | "Month";
    onClick?: (task: Task) => void;
    onDateChange?: (task: Task, start: Date, end: Date) => void;
    onProgressChange?: (task: Task, progress: number) => void;
    onViewChange?: (viewMode: string) => void;
    listCellWidth?: string | number;
    columnWidth?: number;
    rowHeight?: number;
    ganttHeight?: number;
    locale?: string;
    [key: string]: any; // Allow any additional properties
  }

  class Gantt extends React.Component<GanttProps> {}

  export { Gantt, Task, EventOption };
}