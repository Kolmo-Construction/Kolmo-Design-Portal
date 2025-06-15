import { useAuth } from '@/hooks/use-auth-unified';
import { useLocation } from 'wouter';
import ProjectManagerNavigation from './ProjectManagerNavigation';

interface ProjectManagerLayoutProps {
  children: React.ReactNode;
}

export function ProjectManagerLayout({ children }: ProjectManagerLayoutProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Only render project manager layout for project manager users
  if (!user || user.role !== 'projectManager') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectManagerNavigation />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}