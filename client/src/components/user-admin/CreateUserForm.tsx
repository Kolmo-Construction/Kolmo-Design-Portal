import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Project, UserRole } from "@shared/schema";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define type locally or import from a shared location if created
type NewUserFormValues = {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    projectIds?: number[];
    phoneNumber?: string;
    isActivated?: boolean;
};

interface CreateUserFormProps {
  form: UseFormReturn<NewUserFormValues>;
  projects: Project[];
  isLoadingProjects: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
}

export function CreateUserForm({
  form,
  projects,
  isLoadingProjects,
  disabled = false,
  isEditMode = false,
}: CreateUserFormProps) {
  const selectedRole = form.watch("role");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name*</FormLabel>
              <FormControl>
                <Input placeholder="John" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name*</FormLabel>
              <FormControl>
                <Input placeholder="Smith" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email*</FormLabel>
            <FormControl>
              <Input type="email" placeholder="john@example.com" {...field} disabled={disabled} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
              <Input type="tel" placeholder="+1 (555) 123-4567" {...field} disabled={disabled} />
            </FormControl>
            <FormDescription>
              Optional phone number for contact purposes.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role*</FormLabel>
            <Select
              onValueChange={(value: UserRole) => {
                field.onChange(value);
                // Clear projectIds if role is not client
                if (value !== "client") {
                  form.setValue("projectIds", []);
                }
              }}
              defaultValue={field.value}
              value={field.value}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="projectManager">Project Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              The user's role determines their level of access.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Active Status Toggle - Only show in edit mode */}
      {isEditMode && (
        <FormField
          control={form.control}
          name="isActivated"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <FormDescription>
                  Activate or deactivate this user's account. Inactive users cannot log in.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
            </FormItem>
          )}
        />
      )}

      {/* Conditional Project Assignment for Clients */}
      {selectedRole === "client" && (
        <FormField
          control={form.control}
          name="projectIds"
          render={() => ( // Note: we use render prop but access field via form.watch/setValue
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">Assign Projects</FormLabel>
                <FormDescription>
                  Select which projects this client can access upon creation.
                </FormDescription>
              </div>
              <ScrollArea className="h-40 w-full rounded-md border p-4">
                  <div className="space-y-2">
                    {isLoadingProjects ? (
                      <div className="flex items-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Loading projects...</span>
                      </div>
                    ) : projects && projects.length > 0 ? (
                      projects.map((project) => (
                        <FormField
                          key={project.id}
                          control={form.control}
                          name="projectIds"
                          render={({ field }) => {
                             // field.value here should be the array of selected IDs
                             const isChecked = field.value?.includes(project.id) ?? false;
                            return (
                              <FormItem
                                key={project.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const currentValues = field.value ?? [];
                                      const newValues = checked
                                        ? [...currentValues, project.id]
                                        : currentValues.filter((id) => id !== project.id);
                                      // Update the form state for the projectIds array
                                      field.onChange(newValues);
                                    }}
                                    disabled={disabled}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="font-normal">
                                    {project.name}
                                  </FormLabel>
                                  <FormDescription className="text-xs">
                                    {project.address}, {project.city}
                                  </FormDescription>
                                </div>
                              </FormItem>
                            );
                          }}
                        />
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground py-2">
                        No projects available to assign. Create projects first.
                      </div>
                    )}
                  </div>
              </ScrollArea>
              <FormMessage /> {/* For errors specific to projectIds field */}
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
