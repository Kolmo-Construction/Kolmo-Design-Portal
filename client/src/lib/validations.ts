/* -------- client/src/lib/validations.ts -------- */
import * as z from 'zod';
import { parseISO, isValid } from 'date-fns';
// Assuming UserRole might be needed by newUserSchema, ensure it's imported if necessary
// import { UserRole } from '@shared/schema'; // Add if role enum is used directly

// --- Existing Schemas ---
export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  name: z.string().optional().nullable(), // NOTE: Your newUserSchema uses firstName/lastName
  role: z.enum(['admin', 'manager', 'client']), // NOTE: Your newUserSchema uses projectManager
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional().nullable(),
  isSetupComplete: z.boolean(),
  lastLogin: z.string().datetime().optional().nullable(),
});

export type User = z.infer<typeof userSchema>;


// --- Base Project Form Schema ---
export const projectFormSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters long."),
  description: z.string().optional(),
  startDate: z.string().refine((date) => !date || isValid(parseISO(date)), { // Allow empty string or valid date
     message: "Invalid start date format.",
  }).optional().nullable(), // Make explicitly optional and nullable
  endDate: z.string().refine((date) => !date || isValid(parseISO(date)), { // Allow empty string or valid date
     message: "Invalid end date format.",
  }).optional().nullable(), // Make explicitly optional and nullable
  status: z.enum(['planning', 'in_progress', 'completed', 'on_hold', 'cancelled']),
  projectManagerId: z.number().int().positive().optional().nullable(), // PM is optional
  budget: z.string()
     .regex(/^\d+(\.\d{1,2})?$/, "Budget must be a valid number (e.g., 1000 or 1000.50)")
     .optional()
     .nullable(),
  clientIds: z.array(z.number().int().positive()).optional(), // Optional array of client IDs
}).refine(data => {
   // Handle optional/nullable dates in refinement
  if (!data.startDate || !data.endDate) return true; // If either date isn't set, refinement passes
  try {
     return parseISO(data.endDate) >= parseISO(data.startDate);
  } catch {
     return false; // If dates are invalid, refine check fails
  }
}, {
  message: "End date must be on or after the start date.",
  path: ["endDate"],
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

// --- Create Project Schema ---
// FIX: Removed the redundant .extend call
export const createProjectFormSchema = projectFormSchema;

export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;

// --- Edit Project Schema ---
// FIX: Removed the redundant .extend call
export const editProjectFormSchema = projectFormSchema;

export type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;


// --- Other validation schemas ---
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Note: The name field differs from newUserSchema (name vs firstName/lastName)
// Choose which one is correct for your use case. Using CreateUserFormSchema below.
export const createUserFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long."),
  email: z.string().email("Invalid email address."),
  role: z.enum(['admin', 'manager', 'client'], { required_error: "Role is required." }), // Ensure roles match your system ('manager' vs 'projectManager')
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;


// --- *** ADDED MISSING SCHEMA *** ---
// This schema was likely used by your CreateUserDialog/CreateUserForm
// based on earlier refactoring steps. Ensure field names (firstName/lastName vs name)
// and role enum values ('projectManager' vs 'manager') match your actual requirements.
export const newUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  // Ensure this enum matches your actual roles ('projectManager' seems to be used elsewhere)
  role: z.enum(["admin", "projectManager", "client"], { // NOTE: Make sure 'projectManager' is a valid role in your UserRole enum if used.
    required_error: "Role is required",
  }),
  projectIds: z.array(z.number().int().positive()).optional(),
});

export type NewUserFormValues = z.infer<typeof newUserSchema>;
// --- *** END ADDED MISSING SCHEMA *** ---

// --- *** CORRECTED PLACEMENT/DEFINITION *** ---
// The Reset Password Schema and its type
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters long."),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // Error appears under the confirm password field
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
// --- *** END CORRECTION *** ---

// Add other schemas as needed...