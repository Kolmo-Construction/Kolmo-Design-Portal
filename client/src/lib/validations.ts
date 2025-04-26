// client/src/lib/validations.ts
import * as z from 'zod';
import { parseISO, isValid } from 'date-fns';

// --- Existing Schemas (assuming they exist) ---
export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  name: z.string().optional().nullable(),
  role: z.enum(['admin', 'manager', 'client']),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional().nullable(),
  isSetupComplete: z.boolean(),
  lastLogin: z.string().datetime().optional().nullable(),
});

export type User = z.infer<typeof userSchema>;


// --- Base Project Form Schema ---
// Common fields for both create and edit
export const projectFormSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters long."),
  description: z.string().optional(),
  startDate: z.string().refine((date) => isValid(parseISO(date)), {
    message: "Invalid start date format.",
  }),
  endDate: z.string().refine((date) => isValid(parseISO(date)), {
    message: "Invalid end date format.",
  }),
  status: z.enum(['planning', 'in_progress', 'completed', 'on_hold', 'cancelled']),
  projectManagerId: z.number().int().positive().optional().nullable(), // PM is optional
  budget: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Budget must be a valid number (e.g., 1000 or 1000.50)")
    .optional()
    .nullable(),
  clientIds: z.array(z.number().int().positive()).optional(), // Optional array of client IDs
}).refine(data => {
  // Optional: Add cross-field validation, e.g., end date after start date
  try {
    return parseISO(data.endDate) >= parseISO(data.startDate);
  } catch {
    return false; // If dates are invalid, refine check fails
  }
}, {
  message: "End date must be on or after the start date.",
  path: ["endDate"], // Path to show the error message
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

// --- Create Project Schema ---
// Extends base, makes clientIds mandatory for creation if needed, or keeps optional
export const createProjectFormSchema = projectFormSchema.extend({
  // Make clientIds explicitly optional for creation as well,
  // or mandatory: z.array(z.number().int().positive()).min(1, "At least one client must be selected.")
  clientIds: z.array(z.number().int().positive()).optional(),
});

export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;

// --- *MODIFIED* Edit Project Schema ---
// Extends base, includes clientIds (optional), might omit fields not editable here
export const editProjectFormSchema = projectFormSchema.extend({
  // Keep clientIds as defined in the base schema (optional array of numbers)
  clientIds: z.array(z.number().int().positive()).optional(),
});
// If you want to prevent editing certain fields via this form, list them in omit:
// .omit({ fieldToOmit: true });

export type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

// --- Other validation schemas (login, user creation, etc.) ---
// ... (keep your existing schemas like loginSchema, createUserFormSchema, etc.)
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createUserFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long."),
  email: z.string().email("Invalid email address."),
  role: z.enum(['admin', 'manager', 'client'], { required_error: "Role is required." }),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export const resetPasswordFormSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long."),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // Error appears under the confirm password field
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

// Add other schemas as needed...