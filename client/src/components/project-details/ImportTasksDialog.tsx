import { useState, useRef } from "react";
import { z } from "zod";
import { UseFormReturn, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons
import { AlertCircle, Upload, FileText, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

// Gantt task type from gantt-task-react
import { Task as GanttTask } from "gantt-task-react";

// Schema validation for JSON tasks import
const ganttTaskSchema = z.object({
  id: z.string().or(z.number()).transform(val => String(val)),
  name: z.string(),
  start: z.date().or(z.string().transform(val => new Date(val))),
  end: z.date().or(z.string().transform(val => new Date(val))),
  progress: z.number().min(0).max(100).default(0),
  type: z.string().default("task"),
  project: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  isDisabled: z.boolean().optional(),
  styles: z.record(z.any()).optional(),
  displayOrder: z.number().optional(),
  hideChildren: z.boolean().optional(),
});

const importFormSchema = z.object({
  jsonInput: z.string().refine(
    (val) => {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed);
      } catch (e) {
        return false;
      }
    },
    {
      message: "Invalid JSON format. Input must be a valid JSON array.",
    }
  ),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

interface ImportTasksDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: number;
  onImport: (tasks: GanttTask[]) => void;
  isPending: boolean;
}

export function ImportTasksDialog({
  isOpen,
  setIsOpen,
  projectId,
  onImport,
  isPending,
}: ImportTasksDialogProps) {
  // State for validation status
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedTasks, setValidatedTasks] = useState<GanttTask[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      jsonInput: '',
    },
  });
  
  // Reset form and state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setValidationStatus('idle');
      setValidationError(null);
      setValidatedTasks([]);
    }
    setIsOpen(open);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      form.setValue('jsonInput', content);
      validateJsonInput(content);
    };
    reader.readAsText(file);
  };
  
  // Validate JSON tasks
  const validateJsonInput = (jsonContent: string) => {
    setValidationStatus('validating');
    setValidationError(null);
    
    try {
      const parsedTasks = JSON.parse(jsonContent);
      
      if (!Array.isArray(parsedTasks)) {
        throw new Error('JSON input must be an array of tasks');
      }
      
      if (parsedTasks.length === 0) {
        throw new Error('No tasks found in JSON input');
      }
      
      // Validate each task against schema
      const validatedTasksResult: GanttTask[] = [];
      const validationErrors: string[] = [];
      
      parsedTasks.forEach((task, index) => {
        try {
          const validTask = ganttTaskSchema.parse(task);
          validatedTasksResult.push(validTask as GanttTask);
        } catch (err) {
          const errorMessage = err instanceof Error
            ? err.message
            : `Validation error in task at index ${index}`;
          validationErrors.push(`Task #${index + 1}: ${errorMessage}`);
        }
      });
      
      if (validationErrors.length > 0) {
        setValidationStatus('invalid');
        setValidationError(validationErrors.join('\n'));
        return;
      }
      
      setValidatedTasks(validatedTasksResult);
      setValidationStatus('valid');
    } catch (err) {
      setValidationStatus('invalid');
      setValidationError(err instanceof Error ? err.message : 'Failed to parse JSON input');
    }
  };
  
  // Handle form submission
  const onSubmit = (values: ImportFormValues) => {
    if (validationStatus === 'valid' && validatedTasks.length > 0) {
      onImport(validatedTasks);
    }
  };

  const handleValidateClick = () => {
    const jsonInput = form.getValues('jsonInput');
    validateJsonInput(jsonInput);
  };

  // Open file selector
  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  // Example JSON for reference
  const exampleJson = JSON.stringify([
    {
      id: "1",
      name: "Task 1",
      start: new Date(Date.now()).toISOString(),
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 45,
      type: "task"
    },
    {
      id: "2",
      name: "Task 2",
      start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 10,
      type: "task"
    }
  ], null, 2);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Tasks from JSON</DialogTitle>
          <DialogDescription>
            Import multiple tasks in bulk by uploading a JSON file or pasting JSON data.
            Tasks must follow the gantt-task-react format.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Tabs defaultValue="paste" className="flex-1 flex flex-col">
              <TabsList>
                <TabsTrigger value="paste">Paste JSON</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
                <TabsTrigger value="example">Example Format</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste" className="flex-1 flex flex-col">
                <FormField
                  control={form.control}
                  name="jsonInput"
                  render={({ field }) => (
                    <FormItem className="flex-1 flex flex-col">
                      <FormLabel>JSON Tasks Data</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste JSON array of tasks here..."
                          className="flex-1 min-h-[300px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleValidateClick}
                  className="mt-2 w-full"
                  disabled={validationStatus === 'validating' || form.getValues('jsonInput') === ''}
                >
                  {validationStatus === 'validating' && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Validate JSON
                </Button>
              </TabsContent>
              
              <TabsContent value="upload" className="flex-1">
                <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center h-[300px]">
                  <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Upload JSON File</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a file containing a JSON array of tasks
                  </p>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button type="button" onClick={handleSelectFileClick}>
                    <Upload className="mr-2 h-4 w-4" />
                    Select File
                  </Button>
                  {form.getValues('jsonInput') && (
                    <div className="mt-4 text-sm">
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" /> File loaded. Click Validate to check format.
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="example" className="flex-1">
                <div className="space-y-4">
                  <div className="rounded-md bg-muted p-4">
                    <h3 className="text-sm font-medium mb-2">Required Task Format</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Each task must include these properties:
                    </p>
                    <ul className="text-sm space-y-2 mb-4">
                      <li><strong>id</strong>: Unique identifier (string or number)</li>
                      <li><strong>name</strong>: Task name/title (string)</li>
                      <li><strong>start</strong>: Start date (ISO string or Date object)</li>
                      <li><strong>end</strong>: End date (ISO string or Date object)</li>
                      <li><strong>progress</strong>: Completion percentage (0-100)</li>
                      <li><strong>type</strong>: Usually "task" (other options: "project", "milestone")</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-md">
                    <div className="bg-muted px-4 py-2 text-sm font-medium border-b">
                      Example JSON
                    </div>
                    <ScrollArea className="h-[200px]">
                      <pre className="p-4 text-xs">{exampleJson}</pre>
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Validation Status */}
            {validationStatus === 'valid' && (
              <Alert variant="success" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Validation Successful</AlertTitle>
                <AlertDescription className="text-green-700">
                  Successfully validated {validatedTasks.length} tasks. Ready to import.
                </AlertDescription>
              </Alert>
            )}
            
            {validationStatus === 'invalid' && validationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Failed</AlertTitle>
                <AlertDescription className="max-h-24 overflow-auto whitespace-pre-wrap text-xs">
                  {validationError}
                </AlertDescription>
              </Alert>
            )}
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={validationStatus !== 'valid' || isPending}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {validatedTasks.length} Tasks
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}