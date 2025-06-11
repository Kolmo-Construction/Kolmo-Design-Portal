import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useParams, Link, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Home, Loader2, Shield, Users, MessageSquare, FileText, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema } from "@shared/schema";
import kolmoLogo from "@assets/kolmo-logo (1).png";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

interface AuthPageProps {
  isMagicLink?: boolean;
  isPasswordReset?: boolean;
}

export default function AuthPage({ isMagicLink = false, isPasswordReset = false }: AuthPageProps) {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [, navigate] = useLocation();
  const [magicLinkStatus, setMagicLinkStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [magicLinkError, setMagicLinkError] = useState<string>('');
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSubmitting, setForgotPasswordSubmitting] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { token } = useParams<{ token: string }>();
  const { user, isLoading: authLoading, isFetching, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Handle magic link verification
  useEffect(() => {
    if (isMagicLink && token) {
      verifyMagicLink(token);
    }
  }, [isMagicLink, token]);

  const verifyMagicLink = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/verify-magic-link/${token}`, {
        method: 'POST',
      });

      if (response.ok) {
        setMagicLinkStatus('success');
        await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        setTimeout(() => navigate('/'), 2000);
      } else {
        const error = await response.text();
        setMagicLinkError(error || 'Invalid or expired magic link');
        setMagicLinkStatus('error');
      }
    } catch (error) {
      setMagicLinkError('Failed to verify magic link');
      setMagicLinkStatus('error');
    }
  };

  const onLogin = (data: LoginFormValues) => {
    console.log('[AuthPage] [onLogin] Starting login with direct mutation callbacks');
    
    loginMutation.mutate(data, {
      onSuccess: (loggedInUser) => {
        console.log('[AuthPage] [onLogin] [onSuccess] Login successful, updating cache and navigating');
        
        // Step 1: Manually update the cache with the data we just received from the login
        queryClient.setQueryData(['/api/user'], loggedInUser);
        
        // Step 2: Now that the local state is correct, navigate to the dashboard
        navigate('/');

        toast({
          title: "Login Successful",
          description: `Welcome back, ${loggedInUser.firstName}!`,
        });
      },
      onError: (error) => {
        console.error('[AuthPage] [onLogin] [onError] Login failed:', error.message);
        
        // Handle login errors directly here
        loginForm.setError("root", {
          type: "manual",
          message: error.message || "Login failed due to an unknown error.",
        });
      },
    });
  };

  const onRegister = async (data: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync(data);
    } catch (error: any) {
      console.error("Registration failed:", error);
      registerForm.setError("root", {
        type: "manual",
        message: error.message || "Registration failed",
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) return;
    
    setForgotPasswordSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });

      if (response.ok) {
        setForgotPasswordSuccess(true);
      } else {
        const error = await response.text();
        console.error('Forgot password failed:', error);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
    } finally {
      setForgotPasswordSubmitting(false);
    }
  };

  // While the initial authentication status is being checked, show a full-page loader.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#3d4552] mx-auto" />
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // After loading, if the user object exists (meaning they are logged in),
  // show a loading state while redirecting.
  if (user && !isMagicLink && !isPasswordReset && !loginMutation.isPending && !isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#3d4552] mx-auto" />
          <p className="text-gray-600 text-lg">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Magic link loading/success/error states
  if (isMagicLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 flex items-center justify-center bg-blue-100 rounded-full">
              {magicLinkStatus === 'loading' && <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />}
              {magicLinkStatus === 'success' && <CheckCircle2 className="h-8 w-8 text-green-600" />}
              {magicLinkStatus === 'error' && <AlertCircle className="h-8 w-8 text-red-600" />}
            </div>
            <CardTitle className="text-xl font-semibold text-slate-900">
              {magicLinkStatus === 'loading' && 'Verifying Access...'}
              {magicLinkStatus === 'success' && 'Access Granted!'}
              {magicLinkStatus === 'error' && 'Access Denied'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {magicLinkStatus === 'loading' && (
              <p className="text-slate-600">Please wait while we verify your access link...</p>
            )}
            {magicLinkStatus === 'success' && (
              <div className="space-y-2">
                <p className="text-green-700 font-medium">You have been successfully logged in!</p>
                <p className="text-slate-600 text-sm">Redirecting you to the portal...</p>
              </div>
            )}
            {magicLinkStatus === 'error' && (
              <div className="space-y-4">
                <p className="text-red-700">{magicLinkError}</p>
                <Button onClick={() => navigate('/auth')} className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Return to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Column - Branding & Features */}
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-[#3d4552] to-[#4a6670] text-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-black/10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 50%),
                               radial-gradient(circle at 80% 70%, rgba(255,255,255,0.08) 0%, transparent 50%)`
            }} />
          </div>
          
          <div className="relative z-10 max-w-lg">
            {/* Logo */}
            <div className="mb-8">
              <img 
                src={kolmoLogo} 
                alt="Kolmo Logo" 
                className="h-20 w-auto filter brightness-0 invert"
              />
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl font-bold mb-6 leading-tight">
              Your Dream Home
              <span className="text-[#db973c] block">Starts Here</span>
            </h1>

            <p className="text-xl mb-12 text-gray-200 leading-relaxed">
              Track your construction project's progress, access documents, 
              and stay connected with your contractor every step of the way.
            </p>

            {/* Feature Grid */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#db973c]/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#db973c]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Project Progress</h3>
                  <p className="text-gray-300">Real-time updates on your construction</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#db973c]/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-[#db973c]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Direct Communication</h3>
                  <p className="text-gray-300">Chat directly with your contractor</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#db973c]/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[#db973c]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Secure & Private</h3>
                  <p className="text-gray-300">Your data is protected and encrypted</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Authentication Forms */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center">
              <img 
                src={kolmoLogo} 
                alt="Kolmo Logo" 
                className="h-16 w-auto mx-auto mb-6"
              />
            </div>

            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-3xl font-bold text-[#3d4552]">Welcome Back</CardTitle>
                <CardDescription className="text-[#4a6670] text-lg">
                  Access your construction project portal
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-8">
                    <TabsTrigger value="login" className="text-sm font-medium">Sign In</TabsTrigger>
                    <TabsTrigger value="register" className="text-sm font-medium">Register</TabsTrigger>
                  </TabsList>

                  {/* Login Tab */}
                  <TabsContent value="login" className="space-y-6">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                        {loginForm.formState.errors.root && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {loginForm.formState.errors.root.message}
                            </AlertDescription>
                          </Alert>
                        )}

                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#3d4552] font-medium">Username</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="Enter your username"
                                  className="h-12 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#3d4552] font-medium">Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    {...field} 
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    className="h-12 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c] pr-12"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={loginForm.formState.isSubmitting || loginMutation.isPending}
                          className="w-full h-12 bg-[#db973c] hover:bg-[#db973c]/90 text-white font-medium transition-all duration-200"
                          onClick={() => {
                            console.log('[AuthPage] [Login Button] Button clicked, form state:', {
                              isSubmitting: loginForm.formState.isSubmitting,
                              isPending: loginMutation.isPending,
                              formValues: loginForm.getValues(),
                              timestamp: new Date().toISOString()
                            });
                          }}
                        >
                          {loginForm.formState.isSubmitting || loginMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Signing in...
                            </>
                          ) : (
                            "Sign In"
                          )}
                        </Button>

                        <div className="text-center">
                          <Button
                            type="button"
                            variant="link"
                            onClick={() => setForgotPasswordDialogOpen(true)}
                            className="text-[#4a6670] hover:text-[#3d4552] text-sm"
                          >
                            Forgot your password?
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>

                  {/* Register Tab */}
                  <TabsContent value="register" className="space-y-6">
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                        {registerForm.formState.errors.root && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {registerForm.formState.errors.root.message}
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#3d4552] font-medium">First Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="First name"
                                    className="h-11 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={registerForm.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#3d4552] font-medium">Last Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Last name"
                                    className="h-11 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c]"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#3d4552] font-medium">Username</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="Choose a username"
                                  className="h-11 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#3d4552] font-medium">Email</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="email"
                                  placeholder="Enter your email"
                                  className="h-11 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#3d4552] font-medium">Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    {...field} 
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a password"
                                    className="h-11 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c] pr-12"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#3d4552] font-medium">Confirm Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    {...field} 
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    className="h-11 border-gray-300 focus:border-[#db973c] focus:ring-[#db973c] pr-12"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    {showConfirmPassword ? (
                                      <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={registerForm.formState.isSubmitting || registerMutation.isPending}
                          className="w-full h-12 bg-[#db973c] hover:bg-[#db973c]/90 text-white font-medium transition-all duration-200"
                        >
                          {registerForm.formState.isSubmitting || registerMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordDialogOpen} onOpenChange={setForgotPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {forgotPasswordSuccess ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  If an account with that email exists, we've sent a reset link.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="h-11"
                />
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setForgotPasswordDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleForgotPassword}
                    disabled={forgotPasswordSubmitting || !forgotPasswordEmail}
                    className="bg-[#db973c] hover:bg-[#db973c]/90"
                  >
                    {forgotPasswordSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}