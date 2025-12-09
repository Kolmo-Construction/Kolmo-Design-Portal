import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import TopNavBar from "@/components/TopNavBar";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
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
import { useToast } from "@/hooks/use-toast";
import { User, DollarSign, Edit, Save, X, Users } from "lucide-react";

interface UserData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  hourlyRate: string | null;
  createdAt: string;
}

export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users
  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Update hourly rate mutation
  const updateHourlyRateMutation = useMutation({
    mutationFn: async ({ userId, hourlyRate }: { userId: number; hourlyRate: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/hourly-rate`, {
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Hourly Rate Updated",
        description: "The user's hourly rate has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUserId(null);
      setEditHourlyRate("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update hourly rate",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (user: UserData) => {
    setEditingUserId(user.id);
    setEditHourlyRate(user.hourlyRate || "");
  };

  const handleSaveClick = (userId: number) => {
    updateHourlyRateMutation.mutate({ userId, hourlyRate: editHourlyRate });
  };

  const handleCancelClick = () => {
    setEditingUserId(null);
    setEditHourlyRate("");
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      admin: "bg-purple-100 text-purple-800",
      projectManager: "bg-blue-100 text-blue-800",
      contractor: "bg-green-100 text-green-800",
      client: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={roleColors[role] || "bg-gray-100 text-gray-800"}>
        {role === "projectManager" ? "Project Manager" : role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  // Calculate statistics
  const stats = {
    totalUsers: users.length,
    withRates: users.filter(u => u.hourlyRate).length,
    avgRate: users.filter(u => u.hourlyRate).length > 0
      ? (users.reduce((sum, u) => sum + Number(u.hourlyRate || 0), 0) / users.filter(u => u.hourlyRate).length).toFixed(2)
      : "0.00",
    contractors: users.filter(u => u.role === "contractor" || u.role === "projectManager").length,
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <TopNavBar open={sidebarOpen} setOpen={setSidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-20 overflow-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Users className="h-6 w-6" />
            User Management
          </h1>
          <p className="text-slate-600">Manage users and set hourly rates for labor cost tracking</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">With Hourly Rates</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.withRates}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Average Rate</p>
                  <p className="text-2xl font-bold text-slate-900">${stats.avgRate}/hr</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Workers</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.contractors}</p>
                </div>
                <User className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users & Hourly Rates
            </CardTitle>
            <CardDescription>
              Set hourly rates for workers to automatically calculate labor costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-500">Loading users...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">Failed to load users</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            {user.firstName} {user.lastName}
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          {editingUserId === user.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editHourlyRate}
                                onChange={(e) => setEditHourlyRate(e.target.value)}
                                className="w-24"
                                placeholder="0.00"
                              />
                              <span className="text-slate-600">/hr</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {user.hourlyRate ? (
                                <span className="font-semibold text-green-600">
                                  ${Number(user.hourlyRate).toFixed(2)}/hr
                                </span>
                              ) : (
                                <span className="text-slate-400">Not set</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingUserId === user.id ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveClick(user.id)}
                                disabled={updateHourlyRateMutation.isPending}
                                className="gap-1"
                              >
                                <Save className="h-4 w-4" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelClick}
                                disabled={updateHourlyRateMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(user)}
                              className="gap-1"
                            >
                              <Edit className="h-4 w-4" />
                              Edit Rate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <DollarSign className="h-5 w-5" />
              About Hourly Rates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              <strong>Hourly rates are used to automatically calculate labor costs</strong> when workers clock in and out of projects.
            </p>
            <p>
              When a worker with an hourly rate clocks out, the system automatically calculates:
              <span className="block mt-1 ml-4 font-mono text-slate-700">
                Labor Cost = (Duration in Hours) × (Hourly Rate)
              </span>
            </p>
            <p>
              <strong>Example:</strong> If a worker with a $45/hr rate works for 8.5 hours, the labor cost is automatically calculated as $382.50.
            </p>
            <p className="pt-2 border-t">
              <strong>Note:</strong> Hourly rates are typically set for contractors and project managers who perform billable work.
              Clients and admins usually don't need hourly rates.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
