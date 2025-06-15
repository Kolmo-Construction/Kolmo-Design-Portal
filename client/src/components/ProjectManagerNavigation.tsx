import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FolderOpen, 
  FileText, 
  MessageSquare, 
  Settings,
  Calendar,
  CheckSquare,
  Users,
  BarChart3
} from "lucide-react";

const ProjectManagerNavigation = () => {
  const [location] = useLocation();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/project-manager/dashboard",
      icon: LayoutDashboard,
      description: "Overview of all projects"
    },
    {
      name: "Projects",
      href: "/project-manager/projects",
      icon: FolderOpen,
      description: "Manage assigned projects"
    },
    {
      name: "Tasks",
      href: "/project-manager/tasks",
      icon: CheckSquare,
      description: "Track project tasks"
    },
    {
      name: "Schedule",
      href: "/project-manager/schedule",
      icon: Calendar,
      description: "Project timelines"
    },
    {
      name: "Reports",
      href: "/project-manager/reports",
      icon: BarChart3,
      description: "Project analytics"
    },
    {
      name: "Team",
      href: "/project-manager/team",
      icon: Users,
      description: "Manage team members"
    },
    {
      name: "Documents",
      href: "/project-manager/documents",
      icon: FileText,
      description: "Project documents"
    },
    {
      name: "Messages",
      href: "/project-manager/messages",
      icon: MessageSquare,
      description: "Communication hub"
    },
    {
      name: "Settings",
      href: "/project-manager/settings",
      icon: Settings,
      description: "Account settings"
    }
  ];

  const isActive = (href: string) => {
    if (href === "/project-manager/dashboard") {
      return location === href || location === "/project-manager";
    }
    return location.startsWith(href);
  };

  return (
    <nav className="space-y-2">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        
        return (
          <Link key={item.name} href={item.href}>
            <Button
              variant={active ? "default" : "ghost"}
              className={`w-full justify-start h-12 text-left font-normal ${
                active 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.name}</div>
                <div className="text-xs opacity-75 truncate">{item.description}</div>
              </div>
            </Button>
          </Link>
        );
      })}
    </nav>
  );
};

export default ProjectManagerNavigation;