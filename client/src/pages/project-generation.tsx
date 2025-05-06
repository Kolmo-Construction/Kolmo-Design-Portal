import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation, Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, RefreshCw } from 'lucide-react';

// Define interfaces for the data structures
interface ProjectVersion {
  id: string;
  projectId: number;
  versionNumber: number;
  notes: string;
  createdAt: string;
}

interface RagTask {
  id: string;
  versionId: string;
  phase: string;
  trade: string;
  taskName: string;
  description: string;
  durationDays: number;
  requiredMaterials: string[];
  createdAt: string;
}

const ProjectGenerationPage = () => {
  const { projectId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');

  // Define interfaces for the data structures
  interface ProjectVersion {
    id: string;
    projectId: number;
    versionNumber: number;
    notes: string;
    createdAt: string;
  }

  interface RagTask {
    id: string;
    versionId: string;
    phase: string;
    trade: string;
    taskName: string;
    description: string;
    durationDays: number;
    requiredMaterials: string[];
    createdAt: string;
  }

  // Fetch project versions
  const { data: versions, isLoading: isLoadingVersions } = useQuery({
    queryKey: ['/api/rag/projects', projectId, 'versions'],
    queryFn: () => apiRequest(`/api/rag/projects/${projectId}/versions`),
    enabled: !!projectId,
  });

  // Fetch tasks for selected version
  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['/api/rag/versions', selectedVersionId, 'tasks'],
    queryFn: () => apiRequest(`/api/rag/versions/${selectedVersionId}/tasks`),
    enabled: !!selectedVersionId,
  });

  // Mutation to create a new project version
  const createVersionMutation = useMutation({
    mutationFn: (data: { notes: string }) => 
      apiRequest(`/api/rag/projects/${projectId}/versions`, {
        method: 'POST',
        data,
      }),
    onSuccess: (newVersion: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag/projects', projectId, 'versions'] });
      setSelectedVersionId(newVersion.id);
      toast({
        title: 'Version created',
        description: `Version ${newVersion.versionNumber} has been created successfully.`,
      });
    },
  });

  // Mutation to create a generation prompt
  const createPromptMutation = useMutation({
    mutationFn: (data: { inputText: string, rawPrompt: string, modelUsed: string }) => 
      apiRequest(`/api/rag/versions/${selectedVersionId}/prompts`, {
        method: 'POST',
        data,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rag/versions', selectedVersionId, 'tasks'] });
      setPrompt('');
      toast({
        title: 'Tasks generated',
        description: 'Tasks have been generated successfully.',
      });
    },
  });

  // Mutation to convert tasks to regular project tasks
  const convertTasksMutation = useMutation({
    mutationFn: () => 
      apiRequest(`/api/rag/projects/${projectId}/versions/${selectedVersionId}/convert`, {
        method: 'POST',
      } as any),
    onSuccess: () => {
      toast({
        title: 'Tasks converted',
        description: 'Tasks have been added to the project successfully.',
      });
      navigate(`/projects/${projectId}`);
    },
  });

  // Set the first version as selected when versions are loaded
  useEffect(() => {
    if (versions && versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const handleCreateVersion = () => {
    createVersionMutation.mutate({ 
      notes: `Generated version ${new Date().toLocaleDateString()}` 
    });
  };

  const handleGenerateTasks = () => {
    if (!prompt) {
      toast({
        title: 'Input required',
        description: 'Please enter a prompt to generate tasks.',
        variant: 'destructive',
      });
      return;
    }

    createPromptMutation.mutate({
      inputText: prompt,
      rawPrompt: prompt, // Will be enhanced on the server side
      modelUsed: 'placeholder-model', // Will be replaced with actual model when LLM provider is chosen
    });
  };

  const handleConvertTasks = () => {
    if (!tasks || tasks.length === 0) {
      toast({
        title: 'No tasks to convert',
        description: 'There are no tasks to convert for this version.',
        variant: 'destructive',
      });
      return;
    }

    convertTasksMutation.mutate();
  };

  if (isLoadingVersions) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading project versions...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project
        </Button>
        <h1 className="text-2xl font-bold ml-4">Task Generation</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Versions Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Project Versions</CardTitle>
              <CardDescription>Manage different versions of task bundles</CardDescription>
            </CardHeader>
            <CardContent>
              {versions && versions.length > 0 ? (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div 
                      key={version.id}
                      className={`p-3 border rounded-md cursor-pointer hover:bg-muted transition-colors ${selectedVersionId === version.id ? 'bg-muted border-primary' : ''}`}
                      onClick={() => setSelectedVersionId(version.id)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Version {version.versionNumber}</span>
                        <Badge>{new Date(version.createdAt).toLocaleDateString()}</Badge>
                      </div>
                      {version.notes && <p className="text-sm text-muted-foreground mt-1">{version.notes}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No versions yet</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleCreateVersion}
                disabled={createVersionMutation.isPending}
              >
                {createVersionMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" /> New Version</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          {selectedVersionId ? (
            <Tabs defaultValue="generate">
              <TabsList className="w-full">
                <TabsTrigger value="generate" className="flex-1">Generate Tasks</TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1">View Tasks</TabsTrigger>
              </TabsList>
              
              <TabsContent value="generate">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Generation</CardTitle>
                    <CardDescription>
                      Describe the project details to generate relevant construction tasks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Describe your project in detail. Include information about the space, materials, specific requirements, and any unique aspects of the project."
                      className="min-h-[200px]"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">Suggestions</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-secondary"
                          onClick={() => setPrompt(prev => `${prev} Include detailed plumbing requirements.`)}
                        >
                          Add plumbing details
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-secondary"
                          onClick={() => setPrompt(prev => `${prev} Include electrical work specifications.`)}
                        >
                          Add electrical specs
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-secondary"
                          onClick={() => setPrompt(prev => `${prev} Include finish details like paint and trim.`)}
                        >
                          Add finishes
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={handleGenerateTasks}
                      disabled={createPromptMutation.isPending || !prompt}
                    >
                      {createPromptMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Tasks...</>
                      ) : (
                        <><RefreshCw className="mr-2 h-4 w-4" /> Generate Tasks</>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="tasks">
                <Card>
                  <CardHeader>
                    <CardTitle>Generated Tasks</CardTitle>
                    <CardDescription>
                      Review and refine the generated tasks before adding them to your project
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTasks ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2">Loading tasks...</span>
                      </div>
                    ) : tasks && tasks.length > 0 ? (
                      <div className="space-y-4">
                        {/* Group tasks by phase */}
                        {Array.from(new Set(tasks.map(task => task.phase))).map(phase => (
                          <div key={phase} className="space-y-2">
                            <h3 className="font-semibold text-lg">{phase}</h3>
                            <Separator />
                            
                            {/* Group tasks by trade within each phase */}
                            {Array.from(new Set(tasks.filter(t => t.phase === phase).map(task => task.trade))).map(trade => (
                              <div key={`${phase}-${trade}`} className="ml-4 mt-2">
                                <h4 className="font-medium text-md">{trade}</h4>
                                <div className="space-y-2 mt-2">
                                  {tasks.filter(t => t.phase === phase && t.trade === trade).map(task => (
                                    <Card key={task.id} className="p-3">
                                      <div className="font-medium">{task.taskName}</div>
                                      <div className="text-sm text-muted-foreground mt-1">{task.description}</div>
                                      <div className="flex justify-between items-center mt-2 text-xs">
                                        <span>{task.durationDays} days</span>
                                        {task.requiredMaterials && Array.isArray(task.requiredMaterials) && task.requiredMaterials.length > 0 && (
                                          <Badge variant="outline" className="text-xs">
                                            {task.requiredMaterials.length} materials
                                          </Badge>
                                        )}
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">No tasks have been generated yet</p>
                        <p className="text-sm mt-1">Go to the Generate Tasks tab to create tasks</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={handleConvertTasks}
                      disabled={convertTasksMutation.isPending || !tasks || tasks.length === 0}
                    >
                      {convertTasksMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting Tasks...</>
                      ) : (
                        <>Add Tasks to Project</>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-center mb-4">No version selected</p>
                <Button onClick={handleCreateVersion}>Create First Version</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectGenerationPage;