import { useAuth } from "@/hooks/use-auth-unified";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import React from "react"; // Import React for ComponentType

export function ProtectedRoute({
  path,
  component: Component,
  adminOnly = false,
  projectManagerOnly = false,
}: {
  path: string;
  component: React.ComponentType;
  adminOnly?: boolean;
  projectManagerOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();

  return (
    <Route path={path}>
      {() => {
        // Show loading state while checking authentication
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        // Check if user should be redirected to login
        if (!user) {
          return <Redirect to="/auth" />;
        }

        // Check admin access for admin-only routes
        if (adminOnly && user.role !== 'admin') {
          // Redirect users to their appropriate dashboard based on role
          if (user.role === 'client') {
            return <Redirect to="/client-portal" />;
          } else if (user.role === 'projectManager') {
            return <Redirect to="/project-manager" />;
          } else {
            return <Redirect to="/client-portal" />;
          }
        }

        // Check project manager access for project manager-only routes
        if (projectManagerOnly && user.role !== 'projectManager') {
          // Redirect users to their appropriate dashboard based on role
          if (user.role === 'client') {
            return <Redirect to="/client-portal" />;
          } else if (user.role === 'admin') {
            return <Redirect to="/" />;
          } else {
            return <Redirect to="/client-portal" />;
          }
        }

        // Auto-redirect clients to their portal from main dashboard
        if (path === "/" && user.role === 'client') {
          return <Redirect to="/client-portal" />;
        }

        // Auto-redirect project managers to their dashboard from main admin dashboard
        if (path === "/" && user.role === 'projectManager') {
          return <Redirect to="/project-manager" />;
        }

        // Render the protected component
        return <Component />;
      }}
    </Route>
  );
}