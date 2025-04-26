import { useQuery } from "@tanstack/react-query";
import { PunchListItem } from "@shared/schema"; // Assuming type exists
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, ListChecks } from "lucide-react";

interface ProjectPunchListTabProps {
  projectId: number;
}

export function ProjectPunchListTab({ projectId }: ProjectPunchListTabProps) {
   const {
    data: punchListItems = [],
    isLoading,
    error,
  } = useQuery<PunchListItem[]>({ // Adjust type if needed (e.g., PunchListItemWithAssignee)
    queryKey: [`/api/projects/${projectId}/punch-list`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: projectId > 0,
  });

   // TODO: Implement create/edit punch list item dialogs/modals
  const handleAddItem = () => {
    console.log("Open Add Punch List Item Dialog");
  };

  return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <div>
           <CardTitle>Punch List</CardTitle>
           <CardDescription>Track remaining items needing attention before project completion.</CardDescription>
         </div>
         <Button size="sm" onClick={handleAddItem} className="gap-1">
           <PlusCircle className="h-4 w-4" />
           Add Item
        </Button>
       </CardHeader>
       <CardContent>
         {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
         {error && (
          <div className="text-red-600 text-center py-4">
            Error loading punch list: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}
        {!isLoading && !error && punchListItems.length === 0 && (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <ListChecks className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No punch list items have been added yet.</p>
                 <Button size="sm" onClick={handleAddItem} className="mt-4 gap-1">
                   <PlusCircle className="h-4 w-4" />
                   Add First Item
                </Button>
            </div>
        )}
        {!isLoading && !error && punchListItems.length > 0 && (
          <div>
            {/* TODO: Render table or list of PunchListItems */}
            <p>Display {punchListItems.length} punch list items here...</p>
             {/* Example:
            <PunchListTable items={punchListItems} />
            */}
          </div>
        )}
       </CardContent>
     </Card>
  );
}