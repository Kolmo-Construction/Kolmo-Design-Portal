import { useAuth } from '@/hooks/use-auth-unified';
import { useLocation } from 'wouter';
import { ClientNavigation } from './ClientNavigation';
import ProjectManagerNavigation from './ProjectManagerNavigation';

interface UniversalLayoutProps {
  children: React.ReactNode;
}

export function UniversalLayout({ children }: UniversalLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Check if this is a public route that doesn't need authentication
  const isPublicRoute = location.startsWith('/quote/') || 
                       location.startsWith('/customer/quote/') || 
                       location.startsWith('/quote-payment/') ||
                       location.startsWith('/payment/') ||
                       location.startsWith('/auth');

  // Skip layout for public routes
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Return appropriate layout based on user role
  if (user?.role === 'client') {
    return (
      <div className="min-h-screen bg-gray-50">
        <ClientNavigation />
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  if (user?.role === 'projectManager') {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProjectManagerNavigation />
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  // For admin users or no user, return children without specific navigation
  return <>{children}</>;
}