import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
// Removed insertUserSchema import as it's not directly used for login/register types here
import { User as SelectUser, InsertUser } from "@shared/schema"; // Keep User types
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Define context type, adjust mutation types as needed
type AuthContextType = {
  user: SelectUser | null; // Use SelectUser from schema
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>; // Use SelectUser
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>; // Use InsertUser
  verifyMagicLinkMutation: UseMutationResult<MagicLinkResponse, Error, string>;
  setupProfileMutation: UseMutationResult<ProfileSetupResponse, Error, ProfileSetupData>;
  createMagicLinkMutation: UseMutationResult<MagicLinkCreationResponse, Error, MagicLinkCreationData>;
};

// Define specific types for mutation payloads and responses
type LoginData = Pick<InsertUser, "username" | "password">; // Use InsertUser fields

type ProfileSetupData = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

type ProfileSetupResponse = {
  message: string;
  user: Omit<SelectUser, "password" | "magicLinkToken" | "magicLinkExpiry">; // Use SelectUser
};

type MagicLinkResponse = {
  user?: Partial<SelectUser>; // Use SelectUser
  redirect?: string;
};

type MagicLinkCreationData = {
  email: string;
  firstName: string;
  lastName: string;
  role?: string; // Role should match schema enum if possible
  projectIds?: number[]; // Assuming IDs are numbers
};

type MagicLinkCreationResponse = {
  message: string;
  magicLink?: string;
  warning?: string;
  user: {
    id: number; // Assuming ID is number based on schema
    email: string;
  };
};

// Create context
export const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Fetch authenticated user data
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({ // Use SelectUser | undefined
    queryKey: ["/api/user"], // Endpoint to get current user
    queryFn: getQueryFn({ on401: "returnNull" }), // Handle 401 by returning null
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Use apiRequest helper for consistency
      const res = await apiRequest("POST", "/api/login", credentials);
      // apiRequest should throw on non-ok status, so just parse JSON
      return await res.json() as SelectUser; // Assume response is the User object
    },
    onSuccess: (loggedInUser: SelectUser) => {
      // Update the user query cache on successful login
      queryClient.setQueryData(["/api/user"], loggedInUser);
      // No toast here, handled by component typically
    },
    onError: (error: Error) => {
      // Toast handled by component using mutation state
      console.error("Login mutation error:", error);
      // Optionally clear cache on error? Depends on desired behavior.
      // queryClient.setQueryData(["/api/user"], null);
    },
  });

  // Register mutation (example, adjust API endpoint and payload if needed)
  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => { // Use InsertUser type
      const res = await apiRequest("POST", "/api/register", credentials); // Adjust endpoint if needed
      return await res.json() as SelectUser;
    },
    onSuccess: (registeredUser: SelectUser) => {
      queryClient.setQueryData(["/api/user"], registeredUser);
      toast({ title: "Registration Successful", description: "Welcome!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Use apiRequest helper
      await apiRequest("POST", "/api/logout");
      // No need to parse JSON for logout typically
    },
    onSuccess: () => {
      // Clear user data cache immediately
      queryClient.setQueryData(["/api/user"], null);
      // Invalidate all queries to clear potentially protected data
      queryClient.invalidateQueries();
      toast({
        title: "Logged out successfully",
        description: "You have been securely logged out.",
      });
      // Redirect handled by component or effect after seeing user is null
    },
    onError: (error: Error) => {
      // Even if server logout failed, clear local cache
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries();
      toast({
        title: "Logout issue",
        description: error.message,
        variant: "destructive",
      });
      // Redirect handled by component or effect
    },
  });

  // Verify Magic Link mutation
  const verifyMagicLinkMutation = useMutation({
    mutationFn: async (token: string) => {
      // Use apiRequest helper
      const res = await apiRequest("GET", `/api/auth/magic-link/${token}`); // Adjust endpoint if needed
      return await res.json() as MagicLinkResponse;
    },
    onSuccess: (data: MagicLinkResponse) => {
      if (data.user) {
        // Update user cache with partial or full user data from response
        queryClient.setQueryData(["/api/user"], (oldUser: SelectUser | undefined) => ({
            ...(oldUser || {}), // Keep existing data if any
            ...data.user // Overwrite with new data
        }));
        toast({
          title: "Authentication successful",
          description: "You have been securely logged in.",
        });
      }
      // Redirect logic (if any) handled by the component calling the mutation
    },
    onError: (error: Error) => {
      toast({
        title: "Magic link authentication failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Setup Profile mutation
  const setupProfileMutation = useMutation({
    mutationFn: async (data: ProfileSetupData) => {
      // Use apiRequest helper
      const res = await apiRequest("POST", "/api/auth/setup-profile", data); // Adjust endpoint if needed
      return await res.json() as ProfileSetupResponse;
    },
    onSuccess: (data: ProfileSetupResponse) => {
      // Update user cache with the full user profile returned
      queryClient.setQueryData(["/api/user"], data.user);
      toast({
        title: "Profile setup completed",
        description: "Your account has been activated successfully.",
      });
      // Redirect logic handled by the component
    },
    onError: (error: Error) => {
      toast({
        title: "Profile setup failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create Magic Link mutation (Admin action)
  const createMagicLinkMutation = useMutation({
    mutationFn: async (data: MagicLinkCreationData) => {
      // Use apiRequest helper
      const res = await apiRequest("POST", "/api/admin/create-magic-link", data); // Adjust endpoint if needed
      return await res.json() as MagicLinkCreationResponse;
    },
    onSuccess: (data: MagicLinkCreationResponse) => {
      // Toast handled by the component calling the mutation based on response
      if (data.warning) {
        toast({
          title: "Magic link created (Manual Share Needed)",
          description: data.warning, // Use warning from response
          variant: "default", // Or "warning" if you add that variant
        });
      } else {
        toast({
          title: "Magic link created",
          description: "Invitation email sent successfully.",
        });
      }
      // Invalidate user list if needed
      // queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Magic link creation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Provide context value
  return (
    <AuthContext.Provider
      value={{
        user: user ?? null, // Provide null if user is undefined (initial load or error)
        isLoading,
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

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
