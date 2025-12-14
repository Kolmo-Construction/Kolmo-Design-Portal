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
  DollarSign,
  Settings
} from 'lucide-react';
import kolmoLogo from '@/assets/kolmo-logo.png';

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
          {/* Kolmo Logo */}
          <Link to="/client-portal">
            <div className="hover:opacity-95 transition-opacity cursor-pointer">
              <div className="bg-white rounded-lg px-3 py-2 shadow-md hover:shadow-lg transition-shadow">
                <img
                  src={kolmoLogo}
                  alt="Kolmo Constructions"
                  className="h-9 w-auto object-contain"
                  style={{ minWidth: '130px' }}
                />
              </div>
            </div>
          </Link>

          {/* Navigation Links - Streamlined */}
          <div className="flex items-center gap-3 md:gap-6">
            <Link to="/projects">
              <Button
                variant={location.startsWith('/projects') || location.includes('/project-details') ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location.startsWith('/projects') || location.includes('/project-details') ? 'bg-accent text-white' : ''
                }`}
              >
                <Building className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Projects</span>
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
                <MessageSquare className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Messages</span>
              </Button>
            </Link>

            <Link to="/invoices">
              <Button
                variant={location === '/invoices' || location.includes('/invoices') ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/invoices' || location.includes('/invoices') ? 'bg-accent text-white' : ''
                }`}
              >
                <DollarSign className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Invoices</span>
              </Button>
            </Link>

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-destructive/90 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden lg:inline">Sign Out</span>
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

            <Link to="/client/account">
              <Button 
                variant={location === '/client/account' ? 'secondary' : 'ghost'}
                size="sm"
                className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                  location === '/client/account' ? 'bg-accent text-white' : ''
                }`}
              >
                <Settings className="h-4 w-4 mr-1" />
                Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}