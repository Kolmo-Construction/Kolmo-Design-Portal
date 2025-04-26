import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { z } from "zod";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Define type locally or import from shared location
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"], // Apply error to confirmPassword field
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;


interface ResetPasswordFormProps {
  form: UseFormReturn<ResetPasswordFormValues>;
  disabled?: boolean;
}

export function ResetPasswordForm({
    form,
    disabled = false
}: ResetPasswordFormProps) {
  return (
    <div className="space-y-4">
       <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                 <Input type="password" {...field} disabled={disabled} />
              </FormControl>
              <FormDescription>
                 Must be at least 8 characters.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                 <Input type="password" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
    </div>
  );
}