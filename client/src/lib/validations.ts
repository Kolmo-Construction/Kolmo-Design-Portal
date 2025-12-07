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
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "Zip code is required"),
  longitude: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  // Accept Date objects or strings for dates
  startDate: z.union([z.date(), z.string()]).optional(),
  estimatedCompletionDate: z.union([z.date(), z.string()]).optional(),
  actualCompletionDate: z.union([z.date(), z.string()]).optional(),
  status: z.enum(['planning', 'in_progress', 'completed', 'on_hold']),
  projectManagerId: z.number().int().positive().optional(),
  totalBudget: z.string().min(1, "Budget is required"),
  imageUrl: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  clientIds: z.array(z.number().int().positive()).optional(), // Optional array of client IDs
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
  phoneNumber: z.string().optional(),
  isActivated: z.boolean().optional(),
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