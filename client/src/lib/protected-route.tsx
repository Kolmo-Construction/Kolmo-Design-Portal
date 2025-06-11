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
        // 1. First, and most importantly, handle the loading state.
        //    While loading or fetching initial auth state, show a spinner and do nothing else.
        if (isLoading || (isFetching && user === undefined)) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-border" />
            </div>
          );
        }

        // 2. AFTER loading is complete, check for the user.
        //    If there is no user, we can now safely redirect.
        if (!user) {
          return <Redirect to="/auth" />;
        }

        // 3. If we've reached this point, it means isLoading is false AND we have a user.
        //    Render the requested component.
        return <Component />;
      }}
    </Route>
  );
}