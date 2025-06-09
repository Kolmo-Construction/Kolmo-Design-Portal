import React from "react"; // REQUIRED for JSX
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isBefore, isToday } from "date-fns";
// Import types from shared schema
import { milestones } from "@shared/schema";
type Milestone = typeof milestones.$inferSelect;
// Import icons used in getFileIcon and getMilestoneVisuals
import { FileIcon, Image as ImageIcon, FileText, CheckCircle2, ClockIcon, AlertTriangle } from "lucide-react";
// Import Badge component used in getMilestoneBadge
import { Badge } from "@/components/ui/badge"; // Assuming badge.txt is resolved as badge.(tsx|jsx)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Centralized Helper Functions ---

/**
 * Formats a date string or Date object.
 */
export const formatDate = (
    dateString: string | Date | null | undefined,
    formatStr: string = "MMM d, yyyy"
): string => {
  if (!dateString) return "Not set";
  try {
    const dateObj = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(dateObj.getTime())) {
       console.warn("Invalid date value provided to formatDate:", dateString);
       return "Invalid Date";
    }
    return format(dateObj, formatStr);
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "Format Error";
  }
};

/**
 * Formats a file size in bytes into a human-readable string.
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};



/**
 * Returns a React element representing a file icon based on MIME type.
 */
export const getFileIcon = (fileType: string | null | undefined): React.ReactElement => {
  if (!fileType) return <FileIcon className="h-6 w-6 text-slate-400" />;
  if (fileType.includes("image")) {
    return <ImageIcon className="h-6 w-6 text-primary-600" />;
  } else if (fileType.includes("pdf")) {
    return <FileText className="h-6 w-6 text-red-600" />;
  } else {
    return <FileIcon className="h-6 w-6 text-blue-600" />;
  }
};

/**
 * Gets a user-friendly label for a project status.
 */
export const getProjectStatusLabel = (status: string | undefined | null): string => {
    if (!status) return 'Unknown';
    switch (status) {
      case "planning": return "Planning";
      case "in_progress": return "In Progress";
      case "on_hold": return "On Hold";
      case "completed": return "Completed";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

/**
 * Gets Tailwind CSS classes for styling a project status badge.
 */
export const getProjectStatusBadgeClasses = (status: string | undefined | null): string => {
    if (!status) return "bg-slate-100 text-slate-800 border-slate-300";
     switch (status) {
        case "planning": return "bg-blue-100 text-blue-800 border-blue-300";
        case "in_progress": return "bg-primary/10 text-primary border-primary/30";
        case "on_hold": return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case "completed": return "bg-green-100 text-green-800 border-green-300";
        default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
};

/**
 * Gets a user-friendly label for a user role.
 */
export const getUserRoleLabel = (role: string | undefined | null): string => {
     if (!role) return 'Unknown';
     switch (role) {
        case "admin": return "Admin";
        case "projectManager": return "Project Manager";
        case "client": return "Client";
        default: return role.charAt(0).toUpperCase() + role.slice(1);
    }
};

/**
 * Gets the badge variant for a user role.
 */
export const getUserRoleBadgeVariant = (role: string | undefined | null): "default" | "secondary" | "outline" => {
    if (!role) return "secondary";
    switch (role) {
        case "admin": return "default";
        case "projectManager": return "outline";
        case "client": return "secondary";
        default: return "secondary";
    }
};

/**
 * Gets Tailwind CSS classes for styling a user activation status badge.
 */
export const getUserStatusBadgeClasses = (isActivated: boolean | undefined | null): string => {
    return isActivated
      ? "bg-green-100 text-green-800 border-green-300"
      : "bg-amber-100 text-amber-800 border-amber-300";
};

/**
 * Gets a user-friendly label for an invoice status.
 */
export const getInvoiceStatusLabel = (status: string | undefined | null): string => {
     if (!status) return 'Unknown';
     switch (status) {
        case "draft": return "Draft";
        case "pending": return "Pending";
        case "paid": return "Paid";
        case "overdue": return "Overdue";
        case "cancelled": return "Cancelled";
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

/**
 * Gets Tailwind CSS classes for styling an invoice status badge.
 */
export const getInvoiceStatusBadgeClasses = (status: string | undefined | null): string => {
    if (!status) return "bg-slate-100 text-slate-800 border-slate-300";
     switch (status) {
        case "draft": return "bg-blue-100 text-blue-800 border-blue-300";
        case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case "paid": return "bg-green-100 text-green-800 border-green-300";
        case "overdue": return "bg-red-100 text-red-800 border-red-300";
        case "cancelled": return "bg-gray-100 text-gray-800 border-gray-300";
        default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
};

/**
 * Returns a Badge component styled based on milestone status and dates.
 * @param milestone - The Milestone object.
 * @returns A React element (Badge).
 */
export const getMilestoneBadge = (milestone: Milestone): React.ReactElement => {
  const now = new Date();
  // Set time to 00:00:00 for consistent date comparison
  now.setHours(0, 0, 0, 0);
  const plannedDate = new Date(milestone.plannedDate);
  plannedDate.setHours(0, 0, 0, 0);

  if (milestone.status === "completed") return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
  if (milestone.status === "delayed") return <Badge className="bg-red-100 text-red-800 border-red-300">Delayed</Badge>;
  // Check if plannedDate is valid before comparison
  if (!isNaN(plannedDate.getTime()) && isBefore(plannedDate, now) && !isToday(plannedDate)) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Overdue</Badge>;
  }
  // Default status
  return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Scheduled</Badge>;
};

/**
 * Returns an icon component and Tailwind CSS class based on milestone status/dates.
 * @param milestone - The Milestone object.
 * @returns An object with icon (React element) and colorClass (string).
 */
export const getMilestoneVisuals = (milestone: Milestone): { icon: React.ReactElement; colorClass: string } => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const plannedDate = new Date(milestone.plannedDate);
  plannedDate.setHours(0, 0, 0, 0);

  let icon;
  let colorClass;

  if (milestone.status === "completed") {
    icon = <CheckCircle2 className="h-4 w-4" />;
    colorClass = "bg-green-100 text-green-600";
  } else if (milestone.status === "delayed") {
    icon = <AlertTriangle className="h-4 w-4" />;
    colorClass = "bg-red-100 text-red-600";
  } else if (!isNaN(plannedDate.getTime()) && isBefore(plannedDate, now) && !isToday(plannedDate)) {
    icon = <AlertTriangle className="h-4 w-4" />;
    colorClass = "bg-yellow-100 text-yellow-600";
  } else {
    icon = <ClockIcon className="h-4 w-4" />;
    colorClass = "bg-blue-100 text-blue-600";
  }
  return { icon, colorClass };
};

/**
 * Formats a monetary amount as currency.
 */
export const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num || 0);
};

// --- End Helper Functions ---