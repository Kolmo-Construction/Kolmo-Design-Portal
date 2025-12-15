import { useAuth } from "@/hooks/use-auth-unified";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  Building2,
  FileText,
  MessageSquare,
  ImageIcon,
  Calendar,
  CheckSquare,
  Settings,
  LogOut,
  HelpCircle,
  Phone,
  ClipboardList,
  FileTextIcon,
  Users,
  DollarSign,
  Images,
  Bot,
  Key,
  Clock,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setOpen(false);
    }
  };

  // Simplified navigation for clients
  const clientNavLinks = [
    { href: "/client-portal", icon: <HomeIcon className="h-5 w-5 mr-3" />, label: "Home" },
    { href: "/projects", icon: <Building2 className="h-5 w-5 mr-3" />, label: "My Projects" },
    { href: "/progress-updates", icon: <ImageIcon className="h-5 w-5 mr-3" />, label: "Progress Photos" },
    { href: "/schedule", icon: <Calendar className="h-5 w-5 mr-3" />, label: "Schedule" },
    { href: "/documents", icon: <FileText className="h-5 w-5 mr-3" />, label: "Documents" },
    { href: "/selections", icon: <CheckSquare className="h-5 w-5 mr-3" />, label: "Selections" },
    { href: "/client/messages", icon: <MessageSquare className="h-5 w-5 mr-3" />, label: "Messages" },
  ];

  // Full navigation for PMs and admins
  const adminNavLinks = [
    { href: "/", icon: <HomeIcon className="h-5 w-5 mr-3" />, label: "Dashboard" },
    { href: "/projects", icon: <Building2 className="h-5 w-5 mr-3" />, label: "Projects" },
    { href: "/quotes", icon: <FileTextIcon className="h-5 w-5 mr-3" />, label: "Quotes" },
    { href: "/documents", icon: <FileText className="h-5 w-5 mr-3" />, label: "Documents" },
    { href: "/financials", icon: <ClipboardList className="h-5 w-5 mr-3" />, label: "Financials" },
    { href: "/admin/invoices", icon: <ClipboardList className="h-5 w-5 mr-3" />, label: "Invoice Management" },
    { href: "/time-tracking", icon: <Clock className="h-5 w-5 mr-3" />, label: "Time Tracking" },
    { href: "/admin/images", icon: <ImageIcon className="h-5 w-5 mr-3" />, label: "Image Gallery" },
    { href: "/design-proposals", icon: <Images className="h-5 w-5 mr-3" />, label: "Design Proposals" },
    { href: "/messages", icon: <MessageSquare className="h-5 w-5 mr-3" />, label: "Messages" },
    { href: "/progress-updates", icon: <ImageIcon className="h-5 w-5 mr-3" />, label: "Progress Updates" },
    { href: "/schedule", icon: <Calendar className="h-5 w-5 mr-3" />, label: "Schedule" },
    { href: "/selections", icon: <CheckSquare className="h-5 w-5 mr-3" />, label: "Selections & Approvals" },
    { href: "/user-management", icon: <Users className="h-5 w-5 mr-3" />, label: "User Management" },
  ];

  // Use the appropriate navigation links based on user role
  const navLinks = user?.role === "client" ? clientNavLinks : adminNavLinks;

  return (
    <>
      {/* Mobile Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setOpen(false)} 
        />
      )}
    
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 w-64 pt-16 bg-white z-30 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:z-10 lg:shadow-none lg:border-r lg:border-slate-200",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* User Info - Simplified for client */}
          <div className="px-6 py-5 border-b border-slate-200">
            <div className="flex items-center">
              <Avatar className="h-12 w-12">
                <AvatarImage 
                  src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=3b82f6&color=fff&size=128`} 
                  alt={`${user?.firstName} ${user?.lastName}`} 
                />
                <AvatarFallback className="text-lg">{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                
                {user?.role && (
                  <Badge variant="outline" className="mt-1 text-xs font-normal">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        
          {/* Navigation Links - Client-focused */}
          <ScrollArea className="flex-1 pt-6 px-4">
            <nav className="space-y-1.5">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href}
                  onClick={closeSidebarOnMobile}
                >
                  <div
                    className={cn(
                      "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      location === link.href 
                        ? "bg-primary-50 text-primary-600" 
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </div>
                </Link>
              ))}
            </nav>
            
            <Separator className="my-5" />
            
            {/* Help & Support Section for Clients */}
            {user?.role === "client" && (
              <div className="px-4 py-4 mb-4 bg-primary-50 rounded-lg">
                <h3 className="flex items-center text-sm font-medium text-primary-700 mb-2">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Need Help?
                </h3>
                <p className="text-xs text-primary-600 mb-3">
                  Contact your project manager directly for questions about your project.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full border-primary-200 bg-white text-primary-700 text-xs h-8"
                  onClick={() => window.location.href = "/contact"}
                >
                  <Phone className="h-3 w-3 mr-1" />
                  Contact Support
                </Button>
              </div>
            )}
            
            {/* Admin-only sections */}
            {user?.role === "admin" && (
              <div className="space-y-1.5 mb-4">
                <p className="px-4 text-xs font-medium text-slate-400 uppercase tracking-wider mt-4 mb-2">
                  Admin
                </p>
                <Link href="/project-management">
                  <div
                    className={cn(
                      "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      location === "/project-management"
                        ? "bg-primary-50 text-primary-600"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Building2 className="h-5 w-5 mr-3" />
                    Project Management
                  </div>
                </Link>
                <Link href="/agent" onClick={closeSidebarOnMobile}>
                  <div
                    className={cn(
                      "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      location === "/agent"
                        ? "bg-primary-50 text-primary-600"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Bot className="h-5 w-5 mr-3" />
                    AI Agent
                  </div>
                </Link>
                <Link href="/leads" onClick={closeSidebarOnMobile}>
                  <div
                    className={cn(
                      "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      location === "/leads"
                        ? "bg-primary-50 text-primary-600"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Target className="h-5 w-5 mr-3" />
                    Sales Leads
                  </div>
                </Link>
                <Link href="/api-keys" onClick={closeSidebarOnMobile}>
                  <div
                    className={cn(
                      "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                      location === "/api-keys"
                        ? "bg-primary-50 text-primary-600"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <Key className="h-5 w-5 mr-3" />
                    API Keys
                  </div>
                </Link>
              </div>
            )}
            
            {/* Settings & Logout - Common for all users */}
            <div className="space-y-1.5 mb-6">
              <p className="px-4 text-xs font-medium text-slate-400 uppercase tracking-wider mt-4 mb-2">
                Account
              </p>
              <Link href="/settings">
                <div
                  className={cn(
                    "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                    location === "/settings" 
                      ? "bg-primary-50 text-primary-600" 
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Settings
                </div>
              </Link>
              
              <Button 
                variant="ghost" 
                className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 justify-start rounded-lg"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
