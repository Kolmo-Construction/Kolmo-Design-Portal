import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthState = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthContextType = {
  user: SelectUser | null;
  authState: AuthState;
  isLoading: boolean;
  error: Error | null;
  login: (credentials: LoginCredentials) => Promise<SelectUser>;
  logout: () => Promise<void>;
  refreshAuth: () => void;
};

type LoginCredentials = {
  username: string;
  password: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // User query with improved error handling
  const {
    data: user,
    error,
    isLoading,
    refetch: refreshAuth,
  } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user", {
          credentials: "include",
        });
        
        if (response.status === 401) {
          return null; // User not authenticated
        }
        
        if (!response.ok) {
          throw new Error(`Authentication check failed: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("[AuthProvider] User query error:", error);
        throw error;
      }
    },
    retry: (failureCount, error: any) => {
      // Don't retry on 401 or network errors
      if (error?.status === 401 || failureCount >= 2) {
        return false;
      }
      return true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Update auth state based on query results
  useEffect(() => {
    if (isLoading) {
      setAuthState("loading");
    } else if (error && error.message !== "Authentication check failed") {
      setAuthState("error");
    } else if (user) {
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  }, [user, isLoading, error]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<SelectUser> => {
      const response = await apiRequest("POST", "/api/login", credentials);
      return response;
    },
    onSuccess: (userData) => {
      // Update cache with fresh user data
      queryClient.setQueryData(["/api/user"], userData);
      setAuthState("authenticated");
      
      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${userData.firstName} ${userData.lastName}`,
      });
    },
    onError: (error: Error) => {
      setAuthState("unauthenticated");
      
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      setAuthState("unauthenticated");
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      // Even if server logout fails, clear local state
      queryClient.clear();
      setAuthState("unauthenticated");
      
      toast({
        title: "Logout completed",
        description: "Local session cleared",
      });
    },
  });

  // Simplified login function
  const login = async (credentials: LoginCredentials): Promise<SelectUser> => {
    return loginMutation.mutateAsync(credentials);
  };

  // Simplified logout function
  const logout = async (): Promise<void> => {
    return logoutMutation.mutateAsync();
  };

  const contextValue: AuthContextType = {
    user: user || null,
    authState,
    isLoading,
    error,
    login,
    logout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthV2() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthV2 must be used within an AuthProvider");
  }
  return context;
}

// Helper hooks for specific auth states
export function useIsAuthenticated() {
  const { authState } = useAuthV2();
  return authState === "authenticated";
}

export function useAuthUser() {
  const { user, authState } = useAuthV2();
  return authState === "authenticated" ? user : null;
}

export function useAuthLoading() {
  const { authState } = useAuthV2();
  return authState === "loading";
}