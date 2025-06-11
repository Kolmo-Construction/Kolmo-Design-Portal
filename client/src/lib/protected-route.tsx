import { useAuth } from "@/hooks/use-auth";
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
  const { user, isLoading, isFetching } = useAuth();

  return (
    <Route path={path}>
      {() => {
        console.log('[ProtectedRoute] Auth check:', {
          path,
          user: user ? `User ID ${user.id}` : 'No user',
          isLoading,
          isFetching,
          shouldShowLoader: isLoading || isFetching,
          shouldRedirect: !isLoading && !isFetching && !user,
          timestamp: new Date().toISOString()
        });

        // Show loading state while checking authentication or during any fetch operations
        // This prevents premature redirects during login success cache updates
        if (isLoading || isFetching) {
          console.log('[ProtectedRoute] Showing loader for path:', path);
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        // Only redirect when we're certain there's no user and not in a loading state
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