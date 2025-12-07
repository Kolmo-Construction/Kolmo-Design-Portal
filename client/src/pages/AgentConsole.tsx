import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { useAgentConsult, AgentAction } from '@/hooks/useAgentConsult';
import { AgentActionCard } from '@/components/agent/AgentActionCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  FolderOpen,
  User,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  Brain,
} from 'lucide-react';
import { Project } from '@shared/schema';

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  actions?: AgentAction[];
  timestamp: Date;
  isVerified?: boolean;
  sessionId?: string;
}

interface ApprovedAction {
  messageId: string;
  actionIndex: number;
}

export default function AgentConsole() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userPrompt, setUserPrompt] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [approvedActions, setApprovedActions] = useState<ApprovedAction[]>([]);
  const [rejectedActions, setRejectedActions] = useState<ApprovedAction[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { consult, isConsulting } = useAgentConsult();

  // Fetch projects for context selection
  const { data: projects, isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: getQueryFn({ on401: () => window.location.href = '/login' }),
  });

  // Generate a session ID based on the project
  const sessionId = selectedProjectId ? `project-${selectedProjectId}` : 'general';

  // Load chat history when project is selected
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!selectedProjectId) {
        setMessages([]);
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/chat/session/${sessionId}`);
        const loadedMessages: ChatMessage[] = response.map((msg: any) => ({
          id: msg.id,
          type: msg.role === 'assistant' ? 'agent' : msg.role,
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          isVerified: msg.isVerified,
          sessionId: msg.sessionId,
        }));
        setMessages(loadedMessages);
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };

    loadChatHistory();
  }, [selectedProjectId, sessionId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userPrompt.trim() || isConsulting) return;

    const currentPrompt = userPrompt;
    setUserPrompt('');

    // Declare thinkingMessageId outside try block to make it accessible in catch block
    const thinkingMessageId = `thinking-${Date.now()}`;

    try {
      // Save user message to database
      const userMessageResponse = await apiRequest('POST', '/api/chat', {
        sessionId,
        role: 'user',
        content: currentPrompt,
      });

      // Add user message to chat
      const userMessage: ChatMessage = {
        id: userMessageResponse.id,
        type: 'user',
        content: currentPrompt,
        timestamp: new Date(userMessageResponse.createdAt),
        isVerified: false,
        sessionId,
      };

      setMessages((prev) => [...prev, userMessage]);

      // Add a thinking message
      const thinkingMessage: ChatMessage = {
        id: thinkingMessageId,
        type: 'agent',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, thinkingMessage]);

      // Call agent API
      const response = await apiRequest('POST', '/api/agent/consult', {
        userPrompt: currentPrompt,
        projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
      });

      // Save agent response to database
      const agentMessageResponse = await apiRequest('POST', '/api/chat', {
        sessionId,
        role: 'assistant',
        content: response.answer,
      });

      // Remove the thinking message and add the actual response
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== thinkingMessageId);
        const agentMessage: ChatMessage = {
          id: agentMessageResponse.id,
          type: 'agent',
          content: response.answer,
          actions: response.actions || [],
          timestamp: new Date(agentMessageResponse.createdAt),
          isVerified: false,
          sessionId,
        };
        return [...filtered, agentMessage];
      });

      // If there are suggested actions, notify the user
      if (response.actions && response.actions.length > 0) {
        toast({
          title: 'Actions Suggested',
          description: `The AI agent has suggested ${response.actions.length} action(s) for your review.`,
        });
      }
    } catch (error) {
      console.error('Failed to consult agent:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to consult agent',
        variant: 'destructive',
      });

      // Remove thinking message and add error message
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== thinkingMessageId);
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            type: 'agent',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            timestamp: new Date(),
          },
        ];
      });
    }
  };

  const handleApproveAction = async (messageId: string, actionIndex: number, action: AgentAction) => {
    console.log('Approving action:', action);

    try {
      // Execute the action based on its type
      switch (action.action) {
        case 'CREATE_TASK':
          await apiRequest('POST', `/api/projects/${selectedProjectId}/tasks`, action.payload);
          break;
        case 'UPDATE_TASK':
          if (action.payload?.taskId) {
            await apiRequest('PUT', `/api/projects/${selectedProjectId}/tasks/${action.payload.taskId}`, action.payload);
          }
          break;
        case 'CREATE_MILESTONE':
          await apiRequest('POST', `/api/projects/${selectedProjectId}/milestones`, action.payload);
          break;
        case 'SEND_INVOICE':
          // Implement invoice sending logic
          console.log('Send invoice action - to be implemented');
          break;
        case 'UPDATE_PROJECT_STATUS':
          if (selectedProjectId) {
            await apiRequest('PUT', `/api/projects/${selectedProjectId}`, { status: action.payload?.status });
          }
          break;
        default:
          throw new Error(`Unknown action type: ${action.action}`);
      }

      // Mark as approved
      setApprovedActions((prev) => [...prev, { messageId, actionIndex }]);

      // Invalidate relevant queries
      if (selectedProjectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/tasks`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/milestones`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });

      toast({
        title: 'Action Approved',
        description: 'The action has been executed successfully.',
      });
    } catch (error) {
      console.error('Failed to execute action:', error);
      toast({
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to execute the action',
        variant: 'destructive',
      });
    }
  };

  const handleRejectAction = async (messageId: string, actionIndex: number, action: AgentAction) => {
    console.log('Rejecting action:', action);
    setRejectedActions((prev) => [...prev, { messageId, actionIndex }]);
    toast({
      title: 'Action Rejected',
      description: 'The suggested action has been rejected.',
    });
  };

  const handleSaveToMemory = async (messageId: string) => {
    try {
      // Call the verify endpoint to generate embeddings and mark as verified
      await apiRequest('POST', `/api/chat/${messageId}/verify`, {});

      // Update the message in state to reflect verification
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isVerified: true } : msg
        )
      );

      toast({
        title: 'Saved to Memory',
        description: 'This response has been added to the AI\'s long-term memory.',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to save to memory:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save to memory',
        variant: 'destructive',
      });
    }
  };

  const isActionApproved = (messageId: string, actionIndex: number) =>
    approvedActions.some((a) => a.messageId === messageId && a.actionIndex === actionIndex);

  const isActionRejected = (messageId: string, actionIndex: number) =>
    rejectedActions.some((a) => a.messageId === messageId && a.actionIndex === actionIndex);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-kolmo-primary rounded-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-kolmo-foreground">Kolmo AI Agent</h1>
            <p className="text-sm text-kolmo-secondary mt-1">
              Ask questions about your projects, get insights, and approve suggested actions
            </p>
          </div>
        </div>
      </div>

      {/* Project Context Selector */}
      <Card className="mb-6 border-kolmo-muted">
        <CardHeader className="pb-3 bg-kolmo-muted">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-kolmo-primary" />
            <CardTitle className="text-sm font-medium text-kolmo-primary">Project Context</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full border-kolmo-secondary/30 focus:ring-kolmo-accent">
              <SelectValue placeholder="Select a project (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific project</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-kolmo-secondary mt-2">
            Select a project to provide context for your questions
          </p>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="mb-4 min-h-[500px] max-h-[600px] overflow-y-auto">
        <CardContent className="pt-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-kolmo-muted rounded-full mb-4">
                <Sparkles className="h-8 w-8 text-kolmo-accent" />
              </div>
              <h3 className="text-lg font-semibold text-kolmo-foreground mb-2">
                Start a Conversation
              </h3>
              <p className="text-sm text-kolmo-secondary max-w-md">
                Ask me anything about your projects, tasks, milestones, or invoices.
                I can provide insights and suggest actions based on your data.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'agent' && (
                  <div className="p-2 bg-kolmo-muted rounded-full h-fit">
                    <Bot className="h-5 w-5 text-kolmo-primary" />
                  </div>
                )}
                <div className={`flex-1 max-w-[80%] space-y-3`}>
                  {/* Message Content */}
                  {message.content === '' ? (
                    // Thinking indicator
                    <div className="p-4 rounded-lg bg-kolmo-muted text-kolmo-foreground">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-8 w-8 rounded-full bg-kolmo-primary flex items-center justify-center">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                          <div className="absolute -top-1 -right-1 h-4 w-4 border-2 border-white rounded-full bg-kolmo-accent animate-ping"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-kolmo-accent animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="h-2 w-2 rounded-full bg-kolmo-accent animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="h-2 w-2 rounded-full bg-kolmo-accent animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <p className="text-xs text-kolmo-secondary">Kolmo AI is thinking...</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        className={`p-4 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-kolmo-primary text-white ml-auto'
                            : 'bg-kolmo-muted text-kolmo-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs mt-2 opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Save to Memory Button - Only for agent messages */}
                      {message.type === 'agent' && message.content && (
                        <div className="mt-2 flex items-center gap-2">
                          {message.isVerified ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Brain className="h-3 w-3 mr-1" />
                              Saved to Memory
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveToMemory(message.id)}
                              className="text-kolmo-secondary hover:text-kolmo-primary hover:bg-kolmo-muted"
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Save to Memory
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Cards */}
                  {message.type === 'agent' && message.actions && message.actions.length > 0 && (
                    <div className="space-y-3">
                      {message.actions.map((action, index) => {
                        const approved = isActionApproved(message.id, index);
                        const rejected = isActionRejected(message.id, index);

                        if (approved || rejected) {
                          return (
                            <div
                              key={index}
                              className={`p-4 rounded-lg border-2 ${
                                approved
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-kolmo-muted border-kolmo-muted'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {approved ? (
                                  <>
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <span className="text-sm font-medium text-green-700">
                                      Action Approved & Executed
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-5 w-5 text-kolmo-secondary" />
                                    <span className="text-sm font-medium text-kolmo-secondary">
                                      Action Rejected
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <AgentActionCard
                            key={index}
                            action={action}
                            onApprove={() => handleApproveAction(message.id, index, action)}
                            onReject={() => handleRejectAction(message.id, index, action)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                {message.type === 'user' && (
                  <div className="p-2 bg-kolmo-muted rounded-full h-fit">
                    <User className="h-5 w-5 text-kolmo-primary" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      {/* Input Area */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Textarea
              placeholder="Ask me anything about your projects..."
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="min-h-[80px] resize-none"
              disabled={isConsulting}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!userPrompt.trim() || isConsulting}
              className="h-auto bg-kolmo-accent hover:bg-kolmo-accent/90 text-white"
            >
              {isConsulting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-kolmo-secondary mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
