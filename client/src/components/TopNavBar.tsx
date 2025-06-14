import { useAuth } from "@/hooks/use-auth-unified";
import { Menu, Bell, Loader2, Search, MessageSquare, Home, CheckCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TopNavBarProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function TopNavBar({ open, setOpen }: TopNavBarProps) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  // Quick navigation links for the top bar
  const quickLinks = [
    { href: "/", icon: <Home className="h-4 w-4" />, label: "Home" },
    { href: "/messages", icon: <MessageSquare className="h-4 w-4" />, label: "Messages" },
    { href: "/selections", icon: <CheckCircle className="h-4 w-4" />, label: "Approvals" }
  ];

  return (
    <header className="bg-white border-b border-slate-200 fixed top-0 w-full z-50">
      <div className="h-16 px-4 lg:px-8 max-w-screen-2xl mx-auto flex items-center justify-between">
        {/* Left section: Logo & Menu Button */}
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(!open)}
            className="p-2 rounded-md lg:hidden text-slate-600 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
          
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div className="flex items-center lg:ml-0 shrink-0">
              <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="ml-2 text-lg font-semibold text-slate-800 hidden md:inline-block">BuildPortal</span>
            </div>
          </Link>
          
          {/* Desktop quick nav links */}
          <div className="hidden md:flex items-center ml-6 gap-1">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={cn(
                    "h-9 text-sm gap-2 px-3",
                    location === link.href 
                      ? "bg-primary-50 text-primary-600" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {link.icon}
                  <span className="hidden lg:inline">{link.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
        
        {/* Right Navigation Items */}
        <div className="flex items-center gap-2">
          {/* Search (hidden on small screens) */}
          <div className="hidden md:flex items-center relative max-w-xs">
            <Input
              type="text"
              placeholder="Search..."
              className="h-9 w-[200px] lg:w-[280px] bg-slate-50 border-slate-200 rounded-full text-sm pl-9 focus-visible:ring-primary-500"
            />
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
          
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-slate-100 relative">
            <Bell className="h-5 w-5 text-slate-600" />
            <span className="sr-only">Notifications</span>
            <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>
          </Button>
          
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 rounded-full pl-1 pr-2 hover:bg-slate-100 flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage 
                    src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=3b82f6&color=fff`} 
                    alt={`${user?.firstName} ${user?.lastName}`} 
                  />
                  <AvatarFallback>{user?.firstName?.[0]}{user?.lastName?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-slate-700 hidden lg:inline-block truncate max-w-[100px]">
                  {user?.firstName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  {user?.role && (
                    <Badge variant="outline" className="mt-1 text-xs font-normal w-fit">
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">Help & Support</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="text-red-600 focus:text-red-600"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
