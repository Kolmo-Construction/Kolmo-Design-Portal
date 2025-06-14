import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth-unified';
import { ClientNavigation } from '@/components/ClientNavigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  User, 
  Lock, 
  Mail, 
  Phone, 
  Eye, 
  EyeOff, 
  Building, 
  CheckCircle, 
  AlertCircle,
  RefreshCw 
} from 'lucide-react';

// Form schemas
const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ClientAccount() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Fetch client projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ['/api/client/projects'],
    enabled: !!user && user.role === 'client'
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest('PUT', '/api/client/profile', data);
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Password update mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await apiRequest('PUT', '/api/client/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update password');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully.",
      });
      passwordForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Password Update Failed",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    passwordMutation.mutate(data);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <ClientNavigation />
      
      {/* Header */}
      <div className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 pt-24 pb-12">
          <div className="max-w-4xl">
            <h1 className="text-4xl font-bold mb-4">Account Settings</h1>
            <p className="text-xl opacity-90">
              Manage your profile, password, and project access
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="profile" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="projects">My Projects</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={profileForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={profileForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email Address
                            </FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Phone Number
                            </FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        disabled={profileMutation.isPending}
                        className="w-full md:w-auto"
                      >
                        {profileMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Update Profile
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type={showCurrentPassword ? "text" : "password"}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              >
                                {showCurrentPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type={showNewPassword ? "text" : "password"}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type={showConfirmPassword ? "text" : "password"}
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        disabled={passwordMutation.isPending}
                        className="w-full md:w-auto"
                      >
                        {passwordMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Account Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Status</CardTitle>
                  <CardDescription>
                    Your account information and status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Account Activated</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user.isActivated ? 'Active' : 'Pending'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span>Account Type</span>
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">
                      {user.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-purple-600" />
                      <span>Email</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    My Projects
                  </CardTitle>
                  <CardDescription>
                    View and access your assigned construction projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {projectsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-8">
                      <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
                      <p className="text-muted-foreground">
                        You don't have any assigned projects yet. Projects will appear here once they're created.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {projects.map((project: any) => (
                        <div key={project.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{project.name}</h3>
                              <p className="text-muted-foreground mb-2">{project.description}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Status: <span className="capitalize">{project.status}</span></span>
                                <span>Budget: ${project.totalBudget?.toLocaleString()}</span>
                              </div>
                            </div>
                            <Button asChild size="sm">
                              <a href={`/project-details/${project.id}`}>
                                View Details
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}