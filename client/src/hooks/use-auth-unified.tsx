import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type AuthState = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextType {
  user: User | null;
  authState: AuthState;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    if (userQueryLoading) {
      setAuthState("loading");
    } else if (error && error.message !== "Authentication check failed") {
      setAuthState("error");
    } else if (user) {
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  }, [user, userQueryLoading, error]);

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