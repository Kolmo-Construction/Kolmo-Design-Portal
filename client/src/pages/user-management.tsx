import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  useQuery, 
  useQueryClient 
} from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { User } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clipboard, 
  Copy, 
  Loader2, 
  Plus, 
  RotateCw, 
  Users 
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const newUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "projectManager", "client"], {
    required_error: "Role is required",
  }),
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("users");
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [createdMagicLink, setCreatedMagicLink] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, createMagicLinkMutation } = useAuth();
  const [, navigate] = useLocation();

  // Redirect if not an admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  // Get all users
  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery<User[], Error>({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "client",
    },
  });

  const onSubmit = (data: NewUserFormValues) => {
    createMagicLinkMutation.mutate(data, {
      onSuccess: (response) => {
        setCreatedMagicLink(response.magicLink);
        refetchUsers();
        // Don't close the dialog so the admin can copy the magic link
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copied to clipboard",
          description: "Magic link has been copied to clipboard",
        });
      },
      (err) => {
        toast({
          title: "Copy failed",
          description: "Could not copy text to clipboard",
          variant: "destructive",
        });
      }
    );
  };

  const closeDialog = () => {
    setIsCreateUserDialogOpen(false);
    setCreatedMagicLink(null);
    form.reset();
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-600">
              Manage user accounts and send access invitations
            </p>
          </div>
          <Button
            onClick={() => setIsCreateUserDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New User
          </Button>
        </div>

        <Card>
          <CardHeader className="px-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>User Accounts</CardTitle>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => refetchUsers()}
              >
                <RotateCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
            <CardDescription>
              All user accounts in the system
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : usersError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Error loading users. Please try again.
                </AlertDescription>
              </Alert>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users && users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.role === "admin" 
                              ? "default" 
                              : user.role === "projectManager" 
                                ? "outline" 
                                : "secondary"
                          }>
                            {user.role === "admin" 
                              ? "Admin" 
                              : user.role === "projectManager" 
                                ? "Project Manager" 
                                : "Client"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActivated ? (
                            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              Pending Setup
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No users found. Create a new user to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{createdMagicLink ? "Magic Link Created" : "Create New User"}</DialogTitle>
              <DialogDescription>
                {createdMagicLink 
                  ? "Share this magic link with the user to give them access to the portal" 
                  : "Create a user account and send them a magic link invitation"}
              </DialogDescription>
            </DialogHeader>
            
            {createdMagicLink ? (
              <div className="space-y-4">
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700">
                    User account created successfully!
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Magic Link</label>
                  <div className="flex items-center">
                    <div className="bg-slate-100 rounded-l-md p-2 border border-r-0 border-input flex-grow truncate text-sm">
                      {createdMagicLink}
                    </div>
                    <Button
                      onClick={() => copyToClipboard(createdMagicLink)}
                      variant="outline"
                      size="icon"
                      className="rounded-l-none h-9"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    In a production environment, this would be automatically emailed to the user.
                  </p>
                </div>
                
                <DialogFooter>
                  <Button className="w-full" onClick={closeDialog}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="client">Client</SelectItem>
                            <SelectItem value="projectManager">Project Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The user's role determines their level of access
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {createMagicLinkMutation.isError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {createMagicLinkMutation.error?.message || "Error creating user. Please try again."}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <DialogFooter className="pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeDialog}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMagicLinkMutation.isPending}
                    >
                      {createMagicLinkMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create User"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}