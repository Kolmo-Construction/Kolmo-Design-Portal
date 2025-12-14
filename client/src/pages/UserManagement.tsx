import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-unified"; // Assuming user object is available here
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { User, Project } from "@shared/schema"; // Keep Project type if ClientProjectsView needs it indirectly
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
// Import the child components
import { UserListTable } from '@/components/user-admin/UserListTable';
import { CreateUserDialog } from '@/components/user-admin/CreateUserDialog';
import { ResetPasswordDialog } from '@/components/user-admin/ResetPasswordDialog';
import { DeleteUserDialog } from '@/components/user-admin/DeleteUserDialog';
import { ClientProjectsView } from '@/components/user-admin/ClientProjectsView';
// --- ADDED: Import the new dialogs hook ---
import { useUserManagementDialogs } from '@/hooks/useUserManagementDialogs';
// --- END ADDED ---


export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("users"); // 'users' or 'client-projects'
  // --- REMOVED: Dialog state useState hooks (moved to hook) ---
  // --- REMOVED: userToManage useState hook (moved to hook) ---
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null); // Keep for tab view state

  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient(); // Keep if needed for direct invalidation, otherwise remove

  // --- ADDED: Get dialog state and handlers from hook ---
  const {
      isCreateUserDialogOpen,
      openEditUserDialog, // Handler to open dialog in edit mode
      setIsCreateUserDialogOpen, // Use if Dialog uses onOpenChange

      isResetPasswordDialogOpen,
      openResetPasswordDialog, // Pass this down to UserListTable
      setIsResetPasswordDialogOpen, // Use if Dialog uses onOpenChange

      isDeleteUserDialogOpen,
      openDeleteUserDialog, // Pass this down to UserListTable
      setIsDeleteDialogOpen, // Use if Dialog uses onOpenChange

      userToManage, // Pass this down to Reset/Delete dialogs
      userToEdit // Pass this down to Create/Edit dialog
  } = useUserManagementDialogs();
  // --- END ADDED ---

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

  // --- REMOVED: Handlers to open dialogs (moved to hook or handled by setters) ---

  // Handler to switch view to client projects (Keep this local state)
   const handleSelectClient = (userId: number) => {
      setSelectedClientId(userId);
      setActiveTab("client-projects");
   };

   // Find the selected client object
   const selectedClient = users.find(u => u.id === selectedClientId);

  return (
    <div className="h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="lg:ml-64 p-4 lg:p-8 overflow-auto h-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 mt-20">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-600">
              Manage user accounts and client project access.
            </p>
          </div>
          {/* --- MODIFIED: Use handler/setter from hook --- */}
          <Button
            // onClick={openCreateUserDialog} // Option 1: Use explicit open handler
            onClick={() => setIsCreateUserDialogOpen(true)} // Option 2: Use direct setter
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New User
          </Button>
          {/* --- END MODIFIED --- */}
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
                                Email service is not configured. Magic links must be shared manually. Set <code className="bg-amber-100 p-0.5 rounded">MAILERSEND_API_KEY</code> (or MailerSend equivalent) to enable automatic email delivery.
                            </AlertDescription>
                            </Alert>
                        )}
                        </CardHeader>
                        <CardContent className="px-0 sm:px-6">
                            <div className="overflow-x-auto">
                                {/* --- MODIFIED: Pass handlers from hook --- */}
                                <UserListTable
                                    users={users}
                                    currentUser={currentUser}
                                    isLoading={usersLoading}
                                    onSelectClient={handleSelectClient} // Keep local handler
                                    onEditUser={openEditUserDialog} // Pass edit handler from hook
                                    onResetPassword={openResetPasswordDialog} // Pass handler from hook
                                    onDeleteUser={openDeleteUserDialog} // Pass handler from hook
                                />
                                {/* --- END MODIFIED --- */}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'client-projects' && selectedClient && (
                    <ClientProjectsView client={selectedClient} />
                )}
            </div>

        </Tabs>


        {/* --- MODIFIED: Use state and setters from hook --- */}
        <CreateUserDialog
            isOpen={isCreateUserDialogOpen}
            onOpenChange={setIsCreateUserDialogOpen} // Use setter from hook
            emailConfigured={emailConfig?.configured ?? false}
            userToEdit={userToEdit} // Pass user to edit
            onDeleteUser={openDeleteUserDialog} // Pass delete handler
        />

        <ResetPasswordDialog
            isOpen={isResetPasswordDialogOpen}
            onOpenChange={setIsResetPasswordDialogOpen} // Use setter from hook
            userToManage={userToManage} // Pass user from hook state
        />

        <DeleteUserDialog
            isOpen={isDeleteUserDialogOpen}
            onOpenChange={setIsDeleteDialogOpen} // Use setter from hook
            userToManage={userToManage} // Pass user from hook state
        />
        {/* --- END MODIFIED --- */}

      </main>
    </div>
  );
}