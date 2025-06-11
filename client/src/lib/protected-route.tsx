import { useAuth } from "@/hooks/use-auth-unified";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import React from "react"; // Import React for ComponentType

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  // It's more conventional to use React.ComponentType for component props
  component: React.ComponentType;
}) {
  const { user, isLoading } = useAuth();

  return (
    <Route path={path}>
      {() => {
        console.log('[ProtectedRoute] Auth check:', {
          path,
          user: user ? `User ID ${user.id}` : 'No user',
          isLoading,
          shouldShowLoader: isLoading,
          shouldRedirect: !isLoading && !user,
          timestamp: new Date().toISOString()
        });

        // Show loading state while checking authentication
        if (isLoading) {
          console.log('[ProtectedRoute] Showing loader for path:', path);
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        // Check if user should be redirected to login
        if (!user) {
          console.log('[ProtectedRoute] Redirecting to auth from path:', path);
          return <Redirect to="/auth" />;
        }

        // Render the protected component
        console.log('[ProtectedRoute] Rendering component for authenticated user on path:', path);
        return <Component />;
      }}
    </Route>
  );
}