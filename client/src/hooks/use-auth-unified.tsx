import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useQueryClient, useMutation, UseMutationResult } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type AuthState = "loading" | "authenticated" | "unauthenticated" | "error";

type ProfileSetupData = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

type ProfileSetupResponse = {
  message: string;
  user: Omit<User, "password" | "magicLinkToken" | "magicLinkExpiry">;
};

interface AuthContextType {
  user: User | null;
  authState: AuthState;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => void;
  setupProfileMutation: UseMutationResult<ProfileSetupResponse, Error, ProfileSetupData>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if this is a public route that doesn't need authentication
  const isPublicRoute = location.startsWith('/quote/') || 
                       location.startsWith('/customer/quote/') || 
                       location.startsWith('/quote-payment/') ||
                       location.startsWith('/payment/') ||
                       location.startsWith('/auth');

  const {
    data: user,
    isLoading: userQueryLoading,
    refetch: refetchUser,
    error
  } = useQuery<User | null>({
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
    enabled: !isPublicRoute, // Don't run authentication query on public routes
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || failureCount >= 2) {
        return false;
      }
      return true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: false,
    networkMode: 'online',
  });

  // Update auth state based on query results
  useEffect(() => {
    if (isPublicRoute) {
      // For public routes, set auth state to unauthenticated to avoid loading states
      setAuthState("unauthenticated");
    } else if (userQueryLoading) {
      setAuthState("loading");
    } else if (error && error.message !== "Authentication check failed") {
      setAuthState("error");
    } else if (user) {
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  }, [user, userQueryLoading, error, isPublicRoute]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      await apiRequest("POST", "/api/login", { username, password });
    },
    onSuccess: () => {
      // Refetch user data after successful login
      refetchUser();
      setAuthState("authenticated");
    },
    onError: (error: Error) => {
      setAuthState("unauthenticated");
      throw error; // Re-throw so the component can handle it
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

  // Setup profile mutation (for magic link users completing their profile)
  const setupProfileMutation = useMutation({
    mutationFn: async (data: ProfileSetupData) => {
      return await apiRequest("POST", "/api/auth/setup-profile", data);
    },
    onSuccess: (data: ProfileSetupResponse) => {
      queryClient.setQueryData(["/api/user"], data.user);
      setAuthState("authenticated");
      toast({
        title: "Profile setup completed",
        description: "Your account has been activated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Profile setup failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const login = async (username: string, password: string): Promise<void> => {
    await loginMutation.mutateAsync({ username, password });
  };

  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  const contextValue: AuthContextType = {
    user: user || null,
    authState,
    isLoading: userQueryLoading,
    login,
    logout,
    refetchUser,
    setupProfileMutation,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}