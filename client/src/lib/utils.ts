import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isBefore, isToday } from "date-fns";
import { ProjectStatus, UserRole, MilestoneStatus, InvoiceStatus } from "@shared/schema"; // Assuming these types/enums exist or can be defined based on schema

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- NEW: Centralized Helper Functions ---

/**
 * Formats a date string or Date object.
 * @param dateString - The date to format.
 * @param formatStr - The desired date-fns format string (defaults to 'MMM d, yyyy').
 * @returns Formatted date string, 'Not set', or 'Invalid Date'.
 */
export const formatDate = (
    dateString: string | Date | null | undefined,
    formatStr: string = "MMM d, yyyy"
): string => {
  if (!dateString) return "Not set";
  try {
    // Ensure we have a Date object before formatting
    const dateObj = typeof dateString === 'string' ? new Date(dateString) : dateString;
    // Check if the date object is valid
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
 * @param bytes - File size in bytes.
 * @returns Human-readable file size string (e.g., "1.2 MB").
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};


/**
 * Gets a user-friendly label for a project status.
 * @param status - The project status string.
 * @returns Capitalized status label.
 */
export const getProjectStatusLabel = (status: ProjectStatus | string | undefined | null): string => {
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
 * @param status - The project status string.
 * @returns Tailwind classes string.
 */
export const getProjectStatusBadgeClasses = (status: ProjectStatus | string | undefined | null): string => {
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
 * @param role - The user role string.
 * @returns Capitalized role label.
 */
export const getUserRoleLabel = (role: UserRole | string | undefined | null): string => {
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
 * @param role - The user role string.
 * @returns Shadcn Badge variant ('default', 'secondary', 'outline').
 */
export const getUserRoleBadgeVariant = (role: UserRole | string | undefined | null): "default" | "secondary" | "outline" => {
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
 * @param isActivated - Boolean indicating if the user is activated.
 * @returns Tailwind classes string.
 */
export const getUserStatusBadgeClasses = (isActivated: boolean | undefined | null): string => {
    return isActivated
      ? "bg-green-100 text-green-800 border-green-300"
      : "bg-amber-100 text-amber-800 border-amber-300";
};

/**
 * Gets a user-friendly label for an invoice status.
 * @param status - The invoice status string.
 * @returns Capitalized status label.
 */
export const getInvoiceStatusLabel = (status: InvoiceStatus | string | undefined | null): string => {
     if (!status) return 'Unknown';
     switch (status) {
        case "pending": return "Pending";
        case "paid": return "Paid";
        case "overdue": return "Overdue";
        case "cancelled": return "Cancelled";
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

/**
 * Gets Tailwind CSS classes for styling an invoice status badge.
 * @param status - The invoice status string.
 * @returns Tailwind classes string.
 */
export const getInvoiceStatusBadgeClasses = (status: InvoiceStatus | string | undefined | null): string => {
    if (!status) return "bg-slate-100 text-slate-800 border-slate-300";
     switch (status) {
        case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case "paid": return "bg-green-100 text-green-800 border-green-300";
        case "overdue": return "bg-red-100 text-red-800 border-red-300";
        case "cancelled": return "bg-gray-100 text-gray-800 border-gray-300"; // Example
        default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
};

// Add more helpers as needed (e.g., getFileIcon, getMilestoneBadge/Visuals)

// --- End Helper Functions ---