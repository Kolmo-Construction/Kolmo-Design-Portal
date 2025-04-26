import React from 'react';
import { UseFormReturn } from 'react-hook-form';
// REMOVED: z import
// ADDED Import for validation type
import { ResetPasswordFormValues } from '@/lib/validations';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// REMOVED: Local resetPasswordSchema definition
// REMOVED: Local ResetPasswordFormValues type definition

interface ResetPasswordFormProps {
  form: UseFormReturn<ResetPasswordFormValues>; // USE Imported type
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