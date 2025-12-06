import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { format } from "date-fns";
import { User } from "@shared/schema"; // Keep User import
// Import the shared schema and type
import { projectFormSchema, ProjectFormValues } from '@/lib/validations'; // Adjust path if needed

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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon, X, Upload, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { ClientMultiSelectCombobox } from "./ClientMultiSelectCombobox";
import { geocodeAddress } from "@/lib/geocoding";
import { useToast } from "@/hooks/use-toast";

// REMOVE the local definition of projectFormSchema and ProjectFormValues here

interface ProjectFormFieldsProps {
  form: UseFormReturn<ProjectFormValues>; // Use imported type
  projectManagers: User[];
  isLoadingManagers: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
  // Upload related props
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  isUploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
}

export function ProjectFormFields({
  form,
  projectManagers,
  isLoadingManagers,
  disabled = false,
  isEditMode = false,
  selectedFile,
  setSelectedFile,
  imagePreview,
  setImagePreview,
  isUploading,
  onFileChange,
  onRemoveFile,
}: ProjectFormFieldsProps) {
    const { toast } = useToast();
    const [isGeocoding, setIsGeocoding] = React.useState(false);

    // Function to fetch geolocation coordinates
    const handleGeocode = async () => {
      const address = form.getValues('address');
      const city = form.getValues('city');
      const state = form.getValues('state');
      const zipCode = form.getValues('zipCode');

      if (!address || !city || !state || !zipCode) {
        toast({
          title: "Incomplete address",
          description: "Please fill in all address fields before fetching coordinates.",
          variant: "destructive",
        });
        return;
      }

      setIsGeocoding(true);
      try {
        const result = await geocodeAddress({
          street: address,
          city,
          state,
          zipCode,
        });

        if (result) {
          form.setValue('longitude', result.longitude);
          form.setValue('latitude', result.latitude);
          toast({
            title: "Location found",
            description: `Coordinates: ${result.latitude}, ${result.longitude}`,
          });
        } else {
          toast({
            title: "Location not found",
            description: "Could not find coordinates for this address. Please check the address and try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        toast({
          title: "Geocoding failed",
          description: "An error occurred while fetching coordinates. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsGeocoding(false);
      }
    };

    // Function to safely format dates
    const safeFormatDate = (date: Date | string | null | undefined, formatString: string) => {
       if (!date) return undefined;
       try {
         // Ensure we have a Date object before formatting
         const dateObj = typeof date === 'string' ? new Date(date) : date;
         // Check if the date object is valid
         if (isNaN(dateObj.getTime())) {
            console.warn("Invalid date value provided to safeFormatDate:", date);
            return "Invalid Date";
         }
         return format(dateObj, formatString);
       } catch (e) {
         console.error("Error formatting date:", date, e);
         return "Format Error"; // Return a specific error string
       }
    };


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name*</FormLabel>
              <FormControl>
                <Input placeholder="Enter project name" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status*</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value} // Use value for controlled component
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Description */}
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter project description"
                {...field}
                rows={3}
                disabled={disabled}
                value={field.value ?? ""} // Handle potential null/undefined
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />
      <p className="text-sm font-medium text-slate-600">Location Details</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Address */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address*</FormLabel>
              <FormControl>
                <Input placeholder="Enter street address" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* City */}
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City*</FormLabel>
              <FormControl>
                <Input placeholder="Enter city" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* State */}
        <FormField
          control={form.control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State*</FormLabel>
              <FormControl>
                <Input placeholder="Enter state" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Zip Code */}
        <FormField
          control={form.control}
          name="zipCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zip Code*</FormLabel>
              <FormControl>
                <Input placeholder="Enter zip code" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Geocoding Section */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">Geolocation</span>
          </div>
          <p className="text-xs text-slate-500">
            Fetch coordinates from the address above to store the project location.
          </p>
          {form.watch('latitude') && form.watch('longitude') && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>
                Coordinates: {form.watch('latitude')}, {form.watch('longitude')}
              </span>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleGeocode}
          disabled={disabled || isGeocoding}
          className="flex items-center gap-2"
        >
          {isGeocoding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Get Coordinates
            </>
          )}
        </Button>
      </div>

      {/* Hidden fields for longitude and latitude */}
      <div className="hidden">
        <FormField
          control={form.control}
          name="longitude"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="latitude"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      <Separator />
      <p className="text-sm font-medium text-slate-600">Project Image</p>
      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          {/* File Input */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('project-image-upload')?.click()}
              disabled={disabled || isUploading}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {selectedFile ? 'Change Image' : 'Upload Image'}
            </Button>
            <input
              id="project-image-upload"
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
              disabled={disabled || isUploading}
            />
            {selectedFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemoveFile}
                disabled={disabled || isUploading}
                className="flex items-center gap-2 text-destructive"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            )}
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            )}
          </div>
          
          {/* Preview */}
          {imagePreview && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground mb-2">Preview:</p>
              <div className="relative w-full max-w-xs h-48 border rounded-md overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          
          {/* URL Input as alternative to upload */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-600">Or enter image URL</div>
            <Input
              placeholder="https://example.com/image.jpg"
              value={form.watch('imageUrl') || ''}
              onChange={(e) => form.setValue('imageUrl', e.target.value)}
              disabled={disabled || isUploading}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Provide a direct image URL if you prefer not to upload a file.
            </p>
          </div>
        </div>
      </div>

      <Separator />
      <p className="text-sm font-medium text-slate-600">Dates & Financials</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Start Date */}
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={disabled}
                    >
                      {field.value
                        ? safeFormatDate(field.value, "PPP") ?? <span>Pick a date</span>
                        : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    // Use Date object for selected, allow undefined
                    selected={field.value ? new Date(field.value) : undefined}
                    // Pass the Date object or undefined back to the form state
                    onSelect={(date) => field.onChange(date)}
                    disabled={disabled || ((date) => date < new Date("1900-01-01"))}
                    initialFocus
                  />
                  {field.value && (
                      <div className="p-2 border-t border-border">
                          <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-destructive gap-2"
                              onClick={() => field.onChange(undefined)}
                              disabled={disabled}
                          >
                              <X className="h-4 w-4" /> Clear date
                          </Button>
                      </div>
                  )}
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Estimated Completion Date */}
        <FormField
          control={form.control}
          name="estimatedCompletionDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Estimated Completion Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                       disabled={disabled}
                    >
                      {field.value
                         ? safeFormatDate(field.value, "PPP") ?? <span>Pick a date</span>
                         : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                 <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => field.onChange(date)}
                     disabled={disabled || ((date) => date < new Date("1900-01-01"))}
                    initialFocus
                  />
                   {field.value && (
                      <div className="p-2 border-t border-border">
                          <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-destructive gap-2"
                              onClick={() => field.onChange(undefined)}
                              disabled={disabled}
                          >
                              <X className="h-4 w-4" /> Clear date
                          </Button>
                      </div>
                  )}
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actual Completion Date (Only for Edit Mode likely) */}
         {isEditMode && (
            <FormField
              control={form.control}
              name="actualCompletionDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Actual Completion Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                           disabled={disabled}
                        >
                           {field.value
                             ? safeFormatDate(field.value, "PPP") ?? <span>Pick a date</span>
                             : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                     <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => field.onChange(date)}
                         disabled={disabled || ((date) => date < new Date("1900-01-01"))}
                        initialFocus
                      />
                       {field.value && (
                          <div className="p-2 border-t border-border">
                              <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-destructive gap-2"
                                  onClick={() => field.onChange(undefined)}
                                  disabled={disabled}
                              >
                                  <X className="h-4 w-4" /> Clear date
                              </Button>
                          </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
         )}

        {/* Total Budget */}
        <FormField
          control={form.control}
          name="totalBudget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Budget*</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    $
                  </span>
                  <Input
                    placeholder="Enter budget amount"
                    type="text" // Keep as text to allow formatting, parse on submit
                    {...field}
                    // Ensure value is always a string for the input
                    value={field.value?.toString() ?? ""}
                    className="pl-7"
                    disabled={disabled}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Project Manager */}
        <FormField
          control={form.control}
          name="projectManagerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Manager</FormLabel>
              <Select
                 // Ensure the value passed to onChange matches the expected type (number or undefined)
                 onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value, 10))}
                 // Ensure the value prop is a string or undefined for the Select component
                 value={field.value?.toString() ?? "none"}
                 disabled={disabled || isLoadingManagers}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingManagers ? "Loading..." : "Select project manager"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projectManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id.toString()}>
                      {manager.firstName} {manager.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Optional: Assign a project manager.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* --- Client Assignment (Only in Create Mode for now) --- */}
        {!isEditMode && (
          <FormField
            control={form.control}
            name="clientIds"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Assign Clients (Optional)</FormLabel>
                {/* Ensure ClientMultiSelectCombobox receives and sends number[] */}
                <ClientMultiSelectCombobox
                    selectedClientIds={Array.isArray(field.value) ? field.value : []}
                    onClientIdsChange={field.onChange}
                    disabled={disabled}
                />
                <FormDescription>
                  Select clients to assign to this project.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {/* --- End Client Assignment --- */}



        {/* Progress (Only for Edit Mode likely) */}
         {isEditMode && (
            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Progress (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Enter progress percentage"
                      {...field}
                       // Ensure value is number, default to 0
                       value={field.value ?? 0}
                       // Ensure onChange passes a number or 0
                       onChange={(e) => {
                           const value = parseInt(e.target.value, 10);
                           field.onChange(isNaN(value) ? 0 : Math.max(0, Math.min(100, value)));
                       }}
                       disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    Percentage of project completed (0-100).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
         )}
      </div>
    </>
  );
}
