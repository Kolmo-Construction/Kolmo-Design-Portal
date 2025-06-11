import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  verifyMagicLinkMutation: UseMutationResult<MagicLinkResponse, Error, string>;
  setupProfileMutation: UseMutationResult<ProfileSetupResponse, Error, ProfileSetupData>;
  createMagicLinkMutation: UseMutationResult<MagicLinkCreationResponse, Error, MagicLinkCreationData>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

type ProfileSetupData = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

type ProfileSetupResponse = {
  message: string;
  user: Omit<SelectUser, "password" | "magicLinkToken" | "magicLinkExpiry">;
};

type MagicLinkResponse = {
  user?: Partial<SelectUser>;
  redirect?: string;
};

type MagicLinkCreationData = {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  projectIds?: number[];
};

type MagicLinkCreationResponse = {
  message: string;
  magicLink?: string;
  warning?: string;
  user: {
    id: number;
    email: string;
  };
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    isFetching,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0, // Always consider data stale to allow immediate updates
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (unauthorized) - user is not logged in
      if (error?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      return await apiRequest("POST", "/api/login", credentials);
    },
    onSuccess: async (userData) => {
      console.log('[LoginMutation] onSuccess called with userData:', userData);
      
      // Set the user data immediately from the login response
      queryClient.setQueryData(["/api/user"], userData);
      console.log('[LoginMutation] User data set in cache');
      
      // Force an immediate refetch instead of just invalidating
      await queryClient.refetchQueries({ queryKey: ["/api/user"] });
      console.log('[LoginMutation] Queries refetched');
    },
    onError: (error: Error) => {
      console.log('[LoginMutation] onError called:', error);
      
      // Clear any stale user data on login failure
      queryClient.setQueryData(["/api/user"], null);
      
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      return await apiRequest("POST", "/api/register", credentials);
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Clear user data cache
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Invalidate all other protected routes data
      queryClient.invalidateQueries();
      
      toast({
        title: "Logged out successfully",
        description: "You have been securely logged out of your account.",
      });
    },
    onError: (error: Error) => {
      // Even if the server logout failed, clear local cache to prevent UI confusion
      queryClient.setQueryData(["/api/user"], null);
      
      toast({
        title: "Logout issue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMagicLinkMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest("GET", `/api/auth/magic-link/${token}`);
    },
    onSuccess: (data: MagicLinkResponse) => {
      if (data.user) {
        queryClient.setQueryData(["/api/user"], data.user);
        toast({
          title: "Authentication successful",
          description: "You have been securely logged in.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Magic link authentication failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const setupProfileMutation = useMutation({
    mutationFn: async (data: ProfileSetupData) => {
      return await apiRequest("POST", "/api/auth/setup-profile", data);
    },
    onSuccess: (data: ProfileSetupResponse) => {
      queryClient.setQueryData(["/api/user"], data.user);
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

  const createMagicLinkMutation = useMutation({
    mutationFn: async (data: MagicLinkCreationData) => {
      return await apiRequest("POST", "/api/admin/create-magic-link", data);
    },
    onSuccess: (data: MagicLinkCreationResponse) => {
      if (data.warning) {
        toast({
          title: "Magic link created but not emailed",
          description: "Email service is not configured. The magic link must be manually shared with the user.",
          variant: "default",
        });
      } else {
        toast({
          title: "Magic link created",
          description: "A magic link has been created and emailed to the user.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Magic link creation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isFetching,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        verifyMagicLinkMutation,
        setupProfileMutation,
        createMagicLinkMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
