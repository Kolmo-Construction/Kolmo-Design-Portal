import { useQuery } from "@tanstack/react-query";
import { Message, User } from "@shared/schema"; // Assuming User might be needed
import { getQueryFn } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MessageItem from "@/components/MessageItem"; // Ensure this path is correct
import { MessageSquare, Loader2, Plus } from "lucide-react";

interface ProjectMessagesTabProps {
  projectId: number;
}

export function ProjectMessagesTab({ projectId }: ProjectMessagesTabProps) {
  const {
    data: messages = [],
    isLoading: isLoadingMessages
  } = useQuery<Message[]>({ // Adjust type if API returns enriched data
    queryKey: [`/api/projects/${projectId}/messages`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // TODO: Fetch users separately or adjust API if sender details are needed
  // const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Project Communication</CardTitle>
          <CardDescription>Messages and communication history for this project</CardDescription>
        </div>
         {/* TODO: Implement New Message Dialog Trigger */}
        <Button disabled className="gap-2"><Plus className="h-4 w-4" /> New Message</Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-200">
          {isLoadingMessages ? (
             <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
             </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary-50 p-3 mb-4">
                <MessageSquare className="h-6 w-6 text-primary-600" />
              </div>
              <p className="text-slate-500">No messages have been exchanged for this project yet.</p>
              <Button variant="outline" className="mt-4 gap-2" disabled>
                <MessageSquare className="h-4 w-4" />
                Start a conversation
              </Button>
            </div>
          ) : (
            messages.map((message) => {
              // Enrich message with sender details if users are fetched
              // const sender = users.find(u => u.id === message.senderId);
              return (
                <MessageItem key={message.id} message={{ ...message /*, sender */ }} />
              );
            })
          )}
        </div>
         {/* TODO: Add Load More Button if implementing pagination */}
      </CardContent>
    </Card>
  );
}


