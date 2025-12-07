import { User, UserRole } from "@shared/schema"; // ADDED UserRole
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Building2, Key, Trash2, Pencil } from "lucide-react";
// ADDED Imports from utils
import { getUserRoleLabel, getUserRoleBadgeVariant, getUserStatusBadgeClasses } from "@/lib/utils";

interface UserListTableProps {
  users: User[];
  currentUser: User | null;
  isLoading: boolean;
  onSelectClient: (userId: number) => void;
  onResetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onEditUser: (user: User) => void;
}

// REMOVED: Local getRoleBadgeVariant helper function
// REMOVED: Local getRoleLabel helper function
// REMOVED: Local getStatusBadgeClasses helper function

export function UserListTable({
  users,
  currentUser,
  isLoading,
  onSelectClient,
  onResetPassword,
  onDeleteUser,
  onEditUser,
}: UserListTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
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

              <TableCell>{user.username || <span className="text-slate-400 italic">N/A</span>}</TableCell>
              <TableCell>
                <Badge variant={getUserRoleBadgeVariant(user.role as UserRole)}> {/* USE Imported helper */}
                    {getUserRoleLabel(user.role as UserRole)} {/* USE Imported helper */}
                </Badge>
              </TableCell>

              <TableCell>
                 <Badge variant="outline" className={getUserStatusBadgeClasses(user.isActivated)}> {/* USE Imported helper */}
                    {user.isActivated ? "Active" : "Pending Setup"}

                 </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1 whitespace-nowrap">
                {user.role === "client" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectClient(user.id)}
                    className="gap-1 text-xs"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    View Projects
                  </Button>
                )}
                {/* Don't allow actions on own account */}
                {user.id !== currentUser?.id && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditUser(user)}
                      className="gap-1 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResetPassword(user)}
                      className="gap-1 text-xs"
                    >
                      <Key className="h-3.5 w-3.5" />
                      Reset Password
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteUser(user)}
                      className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))

        ) : (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
              No users found. Create a new user to get started.

            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
