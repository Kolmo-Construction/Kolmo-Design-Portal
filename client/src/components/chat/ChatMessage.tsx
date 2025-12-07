import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Bot, User, ThumbsUp, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isVerified?: boolean;
  onVerify?: (messageId: string) => void;
}

export function ChatMessage({
  id,
  role,
  content,
  timestamp,
  isVerified = false,
  onVerify,
}: ChatMessageProps) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(isVerified);

  const handleVerify = async () => {
    if (verified) return;
    
    setIsVerifying(true);
    try {
      await apiRequest('POST', `/api/chat/${id}/verify`);
      setVerified(true);
      toast({
        title: 'Saved to Memory',
        description: 'This message has been saved and will be used for future context.',
      });
      if (onVerify) {
        onVerify(id);
      }
    } catch (error) {
      console.error('Failed to verify message:', error);
      toast({
        title: 'Error',
        description: 'Failed to save message to memory. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="p-2 bg-kolmo-muted rounded-full h-fit">
          <Bot className="h-5 w-5 text-kolmo-primary" />
        </div>
      )}
      <div className={`flex-1 max-w-[80%] space-y-2`}>
        <div
          className={cn(
            'p-4 rounded-lg',
            isUser
              ? 'bg-kolmo-primary text-white ml-auto'
              : 'bg-kolmo-muted text-kolmo-foreground'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs opacity-70">
              {timestamp.toLocaleTimeString()}
            </p>
            {!isUser && !verified && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleVerify}
                disabled={isVerifying}
                className="h-6 px-2 text-kolmo-accent hover:text-kolmo-accent/80 hover:bg-kolmo-accent/10"
              >
                {isVerifying ? (
                  <div className="h-3 w-3 border-2 border-kolmo-accent border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ThumbsUp className="h-3 w-3" />
                )}
                <span className="ml-1 text-xs">Save to Memory</span>
              </Button>
            )}
            {!isUser && verified && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                <span>Saved</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {isUser && (
        <div className="p-2 bg-kolmo-muted rounded-full h-fit">
          <User className="h-5 w-5 text-kolmo-primary" />
        </div>
      )}
    </div>
  );
}
