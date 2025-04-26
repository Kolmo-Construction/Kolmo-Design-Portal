import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth"; // Assuming user object is available here
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { User, Project } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Building2, Plus, RotateCw, AlertCircle, ArrowLeft } from "lucide-react";

// Import the new child components
import { UserListTable } from '@/components/user-admin/UserListTable';
import { CreateUserDialog } from '@/components/user-admin/CreateUserDialog';
import { ResetPasswordDialog } from '@/components/user-admin/ResetPasswordDialog';
import { DeleteUserDialog } from '@/components/user-admin/DeleteUserDialog';
import { ClientProjectsView } from '@/components/user-admin/ClientProjectsView';


export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("users"); // 'users' or 'client-projects'
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [userToManage, setUserToManage] = useState<User | null>(null); // For Reset/Delete dialogs
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null); // For ClientProjectsView

  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Redirect if not an admin
  useEffect(() => {
      if (currentUser && currentUser.role !== "admin") {
        navigate("/");
      }
  }, [currentUser, navigate]);


  // Get all users (needed for the list)
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery<User[], Error>({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: currentUser?.role === 'admin', // Only fetch if admin
  });

  // Get email service configuration status (needed for CreateUserDialog)
  const {
    data: emailConfig,
    isLoading: emailConfigLoading,
  } = useQuery<{ configured: boolean }, Error>({
    queryKey: ["/api/admin/email-config"],
    queryFn: getQueryFn({ on401: "throw" }),
     enabled: currentUser?.role === 'admin', // Only fetch if admin
  });

  // Handlers to open dialogs
  const handleOpenResetPassword = (user: User) => {
    setUserToManage(user);
    setIsResetPasswordDialogOpen(true);
  };

  const handleOpenDeleteUser = (user: User) => {
    setUserToManage(user);
    setIsDeleteUserDialogOpen(true);
  };

  // Handler to switch view to client projects
   const handleSelectClient = (userId: number) => {
      setSelectedClientId(userId);
      setActiveTab("client-projects");
   };

   // Find the selected client object
   const selectedClient = users.find(u => u.id === selectedClientId);

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-600">
              Manage user accounts and client project access.
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            // If switching back to users tab, clear selected client
            if (value === 'users') {
                setSelectedClientId(null);
            }
        }} className="mb-6">
          <TabsList className="grid w-full grid-cols-1">
             {/* Conditionally render tabs based on whether a client is selected */}
             {selectedClientId && selectedClient ? (
                 <div className="flex justify-between items-center border-b">
                     <TabsTrigger value="client-projects" className="flex-shrink-0">
                        {selectedClient.firstName}'s Projects
                     </TabsTrigger>
                     <Button variant="ghost" size="sm" onClick={() => setActiveTab('users')} className="text-sm gap-1 mr-2">
                        <ArrowLeft className="h-4 w-4" /> Back to All Users
                    </Button>
                 </div>
             ) : (
                 <TabsTrigger value="users">All User Accounts</TabsTrigger>
             )}
          </TabsList>

           {/* Content Area */}
            <div className="mt-4">
                {activeTab === 'users' && (
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
                            disabled={usersLoading}
                            >
                                <RotateCw className={`h-4 w-4 ${usersLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                        <CardDescription>
                            All user accounts in the system.
                        </CardDescription>
                        {/* Email Config Warning */}
                        {!emailConfigLoading && emailConfig && !emailConfig.configured && (
                            <Alert className="mt-2 bg-amber-50 border-amber-200">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800 text-xs">
                                Email service is not configured. Magic links must be shared manually. Set <code className="bg-amber-100 p-0.5 rounded">SENDGRID_API_KEY</code> (or MailerSend equivalent) to enable automatic email delivery.
                            </AlertDescription>
                            </Alert>
                        )}
                        </CardHeader>
                        <CardContent className="px-0 sm:px-6">
                            <div className="overflow-x-auto">
                                <UserListTable
                                    users={users}
                                    currentUser={currentUser}
                                    isLoading={usersLoading}
                                    onSelectClient={handleSelectClient}
                                    onResetPassword={handleOpenResetPassword}
                                    onDeleteUser={handleOpenDeleteUser}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'client-projects' && selectedClient && (
                    <ClientProjectsView client={selectedClient} />
                )}
             </div>

        </Tabs>


        {/* Dialogs */}
        <CreateUserDialog
            isOpen={isCreateUserDialogOpen}
            onOpenChange={setIsCreateUserDialogOpen}
            emailConfigured={emailConfig?.configured ?? false}
        />

        <ResetPasswordDialog
            isOpen={isResetPasswordDialogOpen}
            onOpenChange={setIsResetPasswordDialogOpen}
            userToManage={userToManage}
        />

        <DeleteUserDialog
            isOpen={isDeleteUserDialogOpen}
            onOpenChange={setIsDeleteUserDialogOpen}
            userToManage={userToManage}
        />

      </main>
    </div>
  );
}