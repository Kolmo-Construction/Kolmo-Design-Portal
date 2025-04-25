import { useAuth } from "@/hooks/use-auth";
import { Menu, Bell, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavBarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function TopNavBar({ open, setOpen }: TopNavBarProps) {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    // First, call the server to logout
    fetch("/api/logout", { 
      method: "POST",
      credentials: "include" 
    })
    .then(() => {
      // Force clear all query cache
      queryClient.clear();
      
      // Reset user data in context
      queryClient.setQueryData(["/api/user"], null);
      
      // IMPORTANT: Use full page reload to clear all React state and force a complete reset
      console.log("Logout successful, redirecting to auth page");
      window.location.href = '/auth';
    })
    .catch(err => {
      console.error("Logout error:", err);
      // Even on error, clear cache and redirect to ensure user can log out
      queryClient.setQueryData(["/api/user"], null);
      window.location.href = '/auth';
    });
  };

  return (
    <header className="bg-white shadow-sm fixed top-0 w-full z-20">
      <div className="flex justify-between items-center px-4 py-3 lg:px-8">
        {/* Logo & Menu Button */}
        <div className="flex items-center">
          <Button
            id="menu-toggle"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(!open)}
            className="p-2 rounded-md lg:hidden text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
          <div 
            onClick={() => window.location.href = "/"}
            className="flex items-center ml-2 lg:ml-0 cursor-pointer"
          >
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
              <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-xl font-semibold text-slate-800">BuildPortal</span>
          </div>
        </div>
        
        {/* Right Navigation Items */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="p-2 rounded-full hover:bg-slate-100">
            <Bell className="h-6 w-6 text-slate-600" />
            <span className="sr-only">Notifications</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=3b82f6&color=fff`} alt={`${user?.firstName} ${user?.lastName}`} />
                  <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
