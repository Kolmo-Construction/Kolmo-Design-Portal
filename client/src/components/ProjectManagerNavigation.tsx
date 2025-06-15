import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-unified';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Building2, 
  MessageSquare, 
  FileText, 
  Settings, 
  User,
  LogOut
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export function ProjectManagerNavigation() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/logout');
      logout();
    } catch (error) {
      console.error('Logout error:', error);
      logout(); // Force logout even if API call fails
    }
  };

  if (!user) return null;

  return (
    <nav className="bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Kolmo</h1>
              <p className="text-xs text-primary-foreground/70">Project Manager Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-2">
            <Link to="/project-manager">
              <Button 
                variant={location === '/project-manager' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/project-manager' ? 'bg-accent text-white' : ''
                }`}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>

            <Link to="/project-manager/projects">
              <Button 
                variant={location === '/project-manager/projects' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/project-manager/projects' ? 'bg-accent text-white' : ''
                }`}
              >
                <Building2 className="h-4 w-4 mr-2" />
                My Projects
              </Button>
            </Link>

            <Link to="/project-manager/messages">
              <Button 
                variant={location === '/project-manager/messages' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/project-manager/messages' ? 'bg-accent text-white' : ''
                }`}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </Button>
            </Link>

            <Link to="/project-manager/documents">
              <Button 
                variant={location === '/project-manager/documents' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/project-manager/documents' ? 'bg-accent text-white' : ''
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </Button>
            </Link>

            <Link to="/project-manager/settings">
              <Button 
                variant={location === '/project-manager/settings' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/project-manager/settings' ? 'bg-accent text-white' : ''
                }`}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-primary-foreground">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-primary-foreground/70">
                  Project Manager
                </div>
              </div>
              <div className="bg-accent rounded-full p-2">
                <User className="h-4 w-4 text-white" />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}