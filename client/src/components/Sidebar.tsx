import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  HomeIcon, 
  Building2, 
  FileText, 
  CreditCard, 
  MessageSquare, 
  Image, 
  Calendar, 
  CheckSquare, 
  Settings, 
  LogOut,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    // First, call the server to logout
    fetch("/api/logout", { 
      method: "POST",
      credentials: "include" 
    })
    .then(() => {
      // Force clear all query cache and redirect
      console.log("Logout successful, redirecting to auth page");
      window.location.href = '/auth';
    })
    .catch(err => {
      console.error("Logout error:", err);
      window.location.href = '/auth';
    });
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    }
  };

  const navLinks = [
    { href: "/", icon: <HomeIcon className="h-5 w-5 mr-3" />, label: "Dashboard" },
    { href: "/projects", icon: <Building2 className="h-5 w-5 mr-3" />, label: "Projects" },
    { href: "/documents", icon: <FileText className="h-5 w-5 mr-3" />, label: "Documents" },
    { href: "/financials", icon: <CreditCard className="h-5 w-5 mr-3" />, label: "Financials" },
    { href: "/messages", icon: <MessageSquare className="h-5 w-5 mr-3" />, label: "Messages" },
    { href: "/progress-updates", icon: <Image className="h-5 w-5 mr-3" />, label: "Progress Updates" },
    { href: "/schedule", icon: <Calendar className="h-5 w-5 mr-3" />, label: "Schedule" },
    { href: "/selections", icon: <CheckSquare className="h-5 w-5 mr-3" />, label: "Selections & Approvals" },
  ];

  return (
    <aside 
      className={cn(
        "fixed inset-y-0 left-0 w-64 pt-14 bg-white z-10 border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="h-full flex flex-col">
        {/* User Info */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center">
            <Avatar>
              <AvatarImage src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=3b82f6&color=fff`} />
              <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-800">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
        </div>
      
        {/* Navigation Links */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {navLinks.map((link) => (
              <div 
                key={link.href}
                onClick={() => {
                  closeSidebarOnMobile();
                  window.location.href = link.href;
                }}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  location === link.href 
                    ? "bg-primary-50 text-primary-600 border-l-2 border-primary-600" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {link.icon}
                {link.label}
              </div>
            ))}
            
            <Separator className="my-2" />
            
            {user?.role === "admin" && (
              <>
                <div 
                  onClick={() => {
                    closeSidebarOnMobile();
                    window.location.href = "/project-management";
                  }}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    location === "/project-management" 
                      ? "bg-primary-50 text-primary-600 border-l-2 border-primary-600" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Building2 className="h-5 w-5 mr-3" />
                  Project Management
                </div>
                
                <div 
                  onClick={() => {
                    closeSidebarOnMobile();
                    window.location.href = "/user-management";
                  }}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    location === "/user-management" 
                      ? "bg-primary-50 text-primary-600 border-l-2 border-primary-600" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Users className="h-5 w-5 mr-3" />
                  User Management
                </div>
              </>
            )}
            
            <div
              onClick={() => {
                closeSidebarOnMobile();
                window.location.href = "/settings";
              }}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                location === "/settings" 
                  ? "bg-primary-50 text-primary-600 border-l-2 border-primary-600" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
            </div>
            
            <Button 
              variant="ghost" 
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 justify-start"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-5 w-5 mr-3" />
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </nav>
        </ScrollArea>
      </div>
    </aside>
  );
}
