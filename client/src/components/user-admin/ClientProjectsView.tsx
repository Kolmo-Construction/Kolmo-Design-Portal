/* -------- client/src/components/user-admin/ClientProjectsView.txt -------- */
import { useQuery } from "@tanstack/react-query";
import { Project, User, ProjectStatus } from "@shared/schema"; // ADDED ProjectStatus
import { apiRequest } from "@/lib/queryClient";


import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Building2 } from "lucide-react";
// ADDED Imports from utils
import { getProjectStatusLabel, getProjectStatusBadgeClasses } from "@/lib/utils";

interface ClientProjectsViewProps {
  client: User;

}

// REMOVED: Local getStatusLabel helper function
// REMOVED: Local getStatusBadgeClasses helper function


export function ClientProjectsView({ client }: ClientProjectsViewProps) {

  // Fetch this client's assigned projects
  const {
    data: clientProjects = [],
    isLoading: clientProjectsLoading,
    isError: clientProjectsError,
    error: clientProjectsErrorData,
  } = useQuery<Project[], Error>({
    // Use client ID in query key for uniqueness and dependency tracking
    queryKey: ["/api/admin/client-projects", client.id],
    // --- MODIFIED: Use a custom queryFn ---
    queryFn: async () => {
        // Construct the correct URL with the client ID
        const url = `/api/admin/client-projects/${client.id}`;

        const res = await apiRequest("GET", url); // Use apiRequest helper
        // Ensure response is OK before parsing
        if (!res.ok) {
           const errorText = await res.text();
           throw new Error(`Failed to fetch client projects: ${res.status} ${errorText}`);
        }
        return await res.json();
    },
    // --------------------------------------
    enabled: !!client?.id, // Only run if client ID is valid
  });

  return (
    <Card>
      <CardHeader className="px-6">
        <div className="flex items-center gap-2">
           <Building2 className="h-5 w-5 text-muted-foreground" />
           <CardTitle>Projects for {client.firstName} {client.lastName}</CardTitle>
        </div>
        <CardDescription>
           List of projects this client is assigned to.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 sm:px-6">
         <div className="overflow-x-auto">
             {clientProjectsLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
             ) : clientProjectsError ? (

                 <Alert variant="destructive" className="m-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Error loading client projects: {clientProjectsErrorData?.message || 'Unknown error'}

                    </AlertDescription>
                 </Alert>
             ) : (
                <Table>
                <TableHeader>
                  <TableRow>

                    <TableHead>Project Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    {/* Add more columns if needed (e.g., PM) */}

                    </TableRow>
                </TableHeader>
                <TableBody>
                    {clientProjects.length > 0 ? (

                    clientProjects.map((project) => (
                        <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>{project.address}, {project.city}</TableCell>
                        <TableCell>${Number(project.totalBudget ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>

                        <TableCell>
                            <Badge variant="outline" className={getProjectStatusBadgeClasses(project.status as ProjectStatus)}> {/* USE Imported helper */}
                              {getProjectStatusLabel(project.status as ProjectStatus)} {/* USE Imported helper */}

                            </Badge>
                        </TableCell>
                        </TableRow>
                    ))

                    ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          This client is not assigned to any projects yet.

                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>

            )}
         </div>
         {/* TODO: Add functionality to Assign/Unassign projects here */}
      </CardContent>
    </Card>
  );
}