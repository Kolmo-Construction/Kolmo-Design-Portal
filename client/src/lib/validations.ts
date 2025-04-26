import { z } from 'zod';
// Adjust the import path based on your alias/setup for the shared folder
import { insertProjectSchema, UserRole } from '@shared/schema'; // Added UserRole

// --- Project Schemas ---

export const projectFormSchema = insertProjectSchema
  .extend({
    startDate: z.union([z.date(), z.string().optional()]).optional().nullable(),
    estimatedCompletionDate: z.union([z.date(), z.string().optional()]).optional().nullable(),
    actualCompletionDate: z.union([z.date(), z.string().optional()]).optional().nullable(),
    totalBudget: z.string()
      .min(1, "Budget is required")
      .refine(
        (val) => {
            const cleanedVal = val.replace(/[$,]/g, ''); // Simpler cleaning
            const num = parseFloat(cleanedVal);
            return !isNaN(num) && num > 0;
        },
        { message: "Budget must be a positive number" }
      ),
    projectManagerId: z.union([
      z.number().int().positive("Project manager ID must be positive").optional(),
      z.string()
        .transform((val) => (val === "" || val === "none" ? undefined : parseInt(val, 10)))
        .refine((val) => val === undefined || (typeof val === 'number' && !isNaN(val) && val > 0), {
          message: "Invalid project manager selection",
        }),
       z.undefined(),
    ]).optional(),
    description: z.string().optional().or(z.literal('')),
    imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
    progress: z.number().min(0).max(100).optional().default(0),
    clientIds: z.array(z.number().int().positive()).optional(),
  });

export const createProjectFormSchema = projectFormSchema.omit({
    progress: true,
    actualCompletionDate: true,
});

export const editProjectFormSchema = projectFormSchema.omit({
    clientIds: true,
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;
export type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

// --- User Schemas ---

export const newUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "projectManager", "client"], { // Use specific roles or UserRole if imported correctly
    required_error: "Role is required",
  }),
  projectIds: z.array(z.number().int().positive()).optional(),
});

export type NewUserFormValues = z.infer<typeof newUserSchema>;


export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // Apply error to confirmPassword field
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// --- Add other schemas as needed (e.g., Settings forms) ---