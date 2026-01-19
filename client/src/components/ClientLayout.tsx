import { useAuth } from '@/hooks/use-auth-unified';
import { useLocation } from 'wouter';
import { ClientNavigation } from './ClientNavigation';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth(); // Always call hooks at the top level
  
  // Check if this is a public route that doesn't need authentication
  const isPublicRoute = location.startsWith('/quote/') ||
                       location.startsWith('/customer/quote/') ||
                       location.startsWith('/quote-payment/') ||
                       location.startsWith('/payment/') ||
                       location.startsWith('/design-proposal/') ||
                       location.startsWith('/auth');

  // Skip authentication for public routes
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Only render client layout for client users
  if (!user || user.role !== 'client') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientNavigation />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}