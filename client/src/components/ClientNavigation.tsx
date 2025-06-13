import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-unified';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  MessageSquare, 
  FileText, 
  User,
  LogOut,
  Home,
  DollarSign
} from 'lucide-react';

export function ClientNavigation() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  
  // Detect if we're in project context to show project-specific navigation
  const projectMatch = location.match(/\/project-details\/(\d+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-lg border-b border-primary/20">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Kolmo Logo and Brand */}
          <Link to="/client-portal">
            <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="bg-accent rounded-lg p-2">
                <Building className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-primary-foreground">Kolmo</div>
                <div className="text-xs text-primary-foreground/70">Client Portal</div>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/client-portal">
              <Button 
                variant={location === '/client-portal' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/client-portal' ? 'bg-accent text-white' : ''
                }`}
              >
                <Home className="h-4 w-4 mr-2" />
                My Dashboard
              </Button>
            </Link>

            <Link to="/projects">
              <Button 
                variant={location.startsWith('/projects') ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location.startsWith('/projects') ? 'bg-accent text-white' : ''
                }`}
              >
                <Building className="h-4 w-4 mr-2" />
                My Projects
              </Button>
            </Link>

            <Link to="/client/messages">
              <Button 
                variant={location === '/client/messages' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/client/messages' ? 'bg-accent text-white' : ''
                }`}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </Button>
            </Link>

            <Link to="/documents">
              <Button 
                variant={location === '/documents' ? 'secondary' : 'ghost'}
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/documents' ? 'bg-accent text-white' : ''
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </Button>
            </Link>

            {/* Show project-specific invoices link when in project context */}
            {projectId ? (
              <Link to={`/project-details/${projectId}/invoices`}>
                <Button 
                  variant={location.includes('/invoices') ? 'secondary' : 'ghost'}
                  className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                    location.includes('/invoices') ? 'bg-accent text-white' : ''
                  }`}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Invoices
                </Button>
              </Link>
            ) : (
              <Link to="/invoices">
                <Button 
                  variant={location === '/invoices' ? 'secondary' : 'ghost'}
                  className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                    location === '/invoices' ? 'bg-accent text-white' : ''
                  }`}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Invoices
                </Button>
              </Link>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-primary-foreground">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-primary-foreground/70">
                    Client Portal
                  </div>
                </div>
                <div className="bg-accent rounded-full p-2">
                  <User className="h-4 w-4 text-white" />
                </div>
              </div>
            )}

            <Button 
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex flex-wrap gap-2">
            <Link to="/client-portal">
              <Button 
                variant={location === '/client-portal' ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/client-portal' ? 'bg-accent text-white' : ''
                }`}
              >
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </Link>

            <Link to="/projects">
              <Button 
                variant={location.startsWith('/projects') ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location.startsWith('/projects') ? 'bg-accent text-white' : ''
                }`}
              >
                <Building className="h-4 w-4 mr-1" />
                Projects
              </Button>
            </Link>

            <Link to="/client/messages">
              <Button 
                variant={location === '/client/messages' ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/client/messages' ? 'bg-accent text-white' : ''
                }`}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Messages
              </Button>
            </Link>

            <Link to="/documents">
              <Button 
                variant={location === '/documents' ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/documents' ? 'bg-accent text-white' : ''
                }`}
              >
                <FileText className="h-4 w-4 mr-1" />
                Documents
              </Button>
            </Link>

            {/* Show project-specific invoices link when in project context */}
            {projectId ? (
              <Link to={`/project-details/${projectId}/invoices`}>
                <Button 
                  variant={location.includes('/invoices') ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                    location.includes('/invoices') ? 'bg-accent text-white' : ''
                  }`}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Invoices
                </Button>
              </Link>
            ) : (
              <Link to="/invoices">
                <Button 
                  variant={location === '/invoices' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                    location === '/invoices' ? 'bg-accent text-white' : ''
                  }`}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Invoices
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}