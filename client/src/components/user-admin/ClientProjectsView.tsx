import { useQuery } from "@tanstack/react-query";
import { Project, User } from "@shared/schema";
// Remove getQueryFn if no longer needed here, but keep apiRequest if used elsewhere or for mutations
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

interface ClientProjectsViewProps {
  client: User; // Pass the selected client object
}

// Helper function to get status label (can be moved to a utils file)
const getStatusLabel = (status: string | undefined | null): string => {
    if (!status) return 'Unknown';
    switch (status) {
      case "planning": return "Planning";
      case "in_progress": return "In Progress";
      case "on_hold": return "On Hold";
      case "completed": return "Completed";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

// Helper function to get status badge styling (can be moved to a utils file)
const getStatusBadgeClasses = (status: string | undefined | null): string => {
    if (!status) return "bg-slate-100 text-slate-800 border-slate-300";
     switch (status) {
        case "planning": return "bg-blue-100 text-blue-800 border-blue-300";
        case "in_progress": return "bg-primary/10 text-primary border-primary/30";
        case "on_hold": return "bg-yellow-100 text-yellow-800 border-yellow-300";
        case "completed": return "bg-green-100 text-green-800 border-green-300";
        default: return "bg-slate-100 text-slate-800 border-slate-300";
    }
};


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
                            <Badge variant="outline" className={getStatusBadgeClasses(project.status)}>
                                {getStatusLabel(project.status)}
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