import React from "react";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useAuthV2 } from "@/hooks/use-auth-v2";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  path, 
  component: Component, 
  fallback 
}: ProtectedRouteProps) {
  const { authState, user } = useAuthV2();

  return (
    <Route path={path}>
      {() => {
        // Show loading spinner while checking authentication
        if (authState === "loading") {
          return fallback || (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Verifying authentication...</p>
              </div>
            </div>
          );
        }

        // Show error state if authentication check failed
        if (authState === "error") {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <p className="text-red-600 mb-4">Authentication error occurred</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          );
        }

        // Redirect to login if not authenticated
        if (authState === "unauthenticated" || !user) {
          return <Redirect to="/auth" />;
        }

        // Render the protected component
        return <Component />;
      }}
    </Route>
  );
}

// Higher-order component version for easier use
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { authState, user } = useAuthV2();

    if (authState === "loading") {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }

    if (authState === "unauthenticated" || !user) {
      window.location.href = "/auth";
      return null;
    }

    return <Component {...props} />;
  };
}