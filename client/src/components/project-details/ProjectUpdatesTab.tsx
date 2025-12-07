import { useQuery } from "@tanstack/react-query";
import { ProgressUpdate, User } from "@shared/schema"; // Assuming User might be needed later
import { getQueryFn } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import UpdateItem from "@/components/UpdateItem"; // Ensure this path is correct
import { Image as ImageIcon, Loader2 } from "lucide-react"; // Renamed Image icon import

interface ProjectUpdatesTabProps {
  projectId: number;
}

export function ProjectUpdatesTab({ projectId }: ProjectUpdatesTabProps) {
  const {
    data: response,
    isLoading: isLoadingUpdates
  } = useQuery({
    // Only fetch if projectId is valid
    queryKey: [`/api/projects/${projectId}/updates`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

  // Extract updates array from response (API returns { updates: [...] })
  const updates = response?.updates || [];

  // TODO: If needed, fetch users and media separately or adjust the API
  // to return enriched update objects including createdBy user details and media.
  // For now, UpdateItem will handle missing createdBy gracefully.

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Updates</CardTitle>
        <CardDescription>Latest progress and status updates for this project</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingUpdates ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : updates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary-50 p-3 mb-4">
              <ImageIcon className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-slate-500">No updates have been posted yet for this project.</p>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {updates.map((update) => (
                // Pass the update data. If you enrich data later (e.g., add createdBy),
                // UpdateItem component might need adjustments.
                <UpdateItem key={update.id} update={update} />
              ))}
            </ul>
            {/* TODO: Add Load More Button if implementing pagination */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}