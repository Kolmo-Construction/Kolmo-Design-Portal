import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useParams, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Home, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { insertUserSchema } from "@shared/schema";

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
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const { 
    user, 
    loginMutation, 
    registerMutation, 
    verifyMagicLinkMutation 
  } = useAuth();
  const [regSuccess, setRegSuccess] = useState(false);

  // Get token from URL if in magic link mode
  const params = useParams();
  const token = isMagicLink ? params.token : null;

  // Process magic link token
  useEffect(() => {
    if (isMagicLink && token) {
      verifyMagicLinkMutation.mutate(token, {
        onSuccess: (data) => {
          setMagicLinkStatus('success');
          // If there's a redirect, navigate there
          if (data.redirect) {
            navigate(data.redirect);
          } else {
            // Otherwise go to dashboard after short delay
            setTimeout(() => {
              navigate("/");
            }, 2000);
          }
        },
        onError: (error) => {
          setMagicLinkStatus('error');
          setMagicLinkError(error.message || "Invalid or expired magic link");
        }
      });
    }
  }, [isMagicLink, token, verifyMagicLinkMutation, navigate]);

  // If user is already logged in, redirect to home page
  if (user && !isMagicLink) {
    navigate("/");
    return null;
  }

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
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: "client",
    },
  });

  const onLoginSubmit = (values: LoginFormValues) => {
    // Call the login API directly
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(values)
    })
    .then(res => {
      if (!res.ok) throw new Error('Login failed');
      return res.json();
    })
    .then(userData => {
      console.log("Login successful, redirecting to dashboard", userData);
      
      // Force clear and update query cache
      queryClient.clear();
      queryClient.setQueryData(["/api/user"], userData);
      
      // Navigate to dashboard
      window.location.href = '/';
    })
    .catch(err => {
      console.error("Login error:", err);
      loginForm.setError("root", { 
        type: "manual",
        message: "Invalid username or password" 
      });
    });
  };

  const onRegisterSubmit = (values: RegisterFormValues) => {
    // Remove confirmPassword as it's not needed in the API
    const { confirmPassword, ...registerData } = values;
    
    registerMutation.mutate(registerData, {
      onSuccess: () => {
        setRegSuccess(true);
        setTimeout(() => {
          navigate("/");
        }, 2000);
      },
    });
  };

  // Define password reset schema
  const resetPasswordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // State for password reset form
  const [resetPasswordStatus, setResetPasswordStatus] = useState<'loading' | 'verifying' | 'ready' | 'success' | 'error'>('loading');
  const [resetPasswordError, setResetPasswordError] = useState<string>('');
  const resetToken = isPasswordReset ? params.token : null;

  // Check if token is valid for password reset
  useEffect(() => {
    if (isPasswordReset && resetToken) {
      setResetPasswordStatus('verifying');
      
      // Verify the token is valid
      fetch(`/api/verify-reset-token/${resetToken}`)
        .then(res => {
          if (!res.ok) throw new Error('Invalid or expired reset link');
          return res.json();
        })
        .then(() => {
          setResetPasswordStatus('ready');
        })
        .catch(err => {
          console.error('Error verifying reset token:', err);
          setResetPasswordStatus('error');
          setResetPasswordError(err.message || 'Invalid or expired reset link');
        });
    }
  }, [isPasswordReset, resetToken]);

  // Handle password reset submission
  const onResetPasswordSubmit = (values: ResetPasswordFormValues) => {
    if (!resetToken) return;
    
    setResetPasswordStatus('loading');
    
    // Submit new password
    fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password: values.password })
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to reset password');
      return res.json();
    })
    .then(() => {
      setResetPasswordStatus('success');
      // Auto-redirect to login after delay
      setTimeout(() => {
        navigate('/auth');
      }, 3000);
    })
    .catch(err => {
      console.error('Error resetting password:', err);
      setResetPasswordStatus('error');
      setResetPasswordError(err.message || 'Failed to reset password. Please try again.');
    });
  };

  // Render password reset UI
  if (isPasswordReset) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-2xl font-bold">BuildPortal</span>
            </div>
            <CardTitle className="text-2xl">Reset Your Password</CardTitle>
            <CardDescription>
              {resetPasswordStatus === 'loading' || resetPasswordStatus === 'verifying'
                ? 'Verifying your reset link...'
                : resetPasswordStatus === 'ready'
                  ? 'Please enter a new password for your account.'
                  : resetPasswordStatus === 'success'
                    ? 'Your password has been reset successfully!'
                    : 'Reset link verification failed'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(resetPasswordStatus === 'loading' || resetPasswordStatus === 'verifying') && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-center text-muted-foreground">
                  Please wait while we verify your reset link...
                </p>
              </div>
            )}
            
            {resetPasswordStatus === 'ready' && (
              <Form {...resetPasswordForm}>
                <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={resetPasswordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter your new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={resetPasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm your new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">Reset Password</Button>
                </form>
              </Form>
            )}
            
            {resetPasswordStatus === 'success' && (
              <>
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div className="ml-3">
                    <AlertDescription className="text-green-700 font-medium">
                      Your password has been reset successfully!
                    </AlertDescription>
                    <p className="text-sm mt-1">Redirecting you to login page...</p>
                  </div>
                </Alert>
                <div className="text-center mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate("/auth")}
                    className="mx-auto"
                  >
                    Go to Login
                  </Button>
                </div>
              </>
            )}
            
            {resetPasswordStatus === 'error' && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="ml-2">
                    {resetPasswordError || "There was an error verifying your reset link"}
                  </AlertDescription>
                </Alert>
                <div className="text-center mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate("/auth")}
                    className="mx-auto"
                  >
                    Return to Login
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render magic link verification UI if in magic link mode
  if (isMagicLink) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-2xl font-bold">BuildPortal</span>
            </div>
            <CardTitle className="text-2xl">Magic Link Authentication</CardTitle>
            <CardDescription>
              {magicLinkStatus === 'loading' 
                ? 'Verifying your secure access link...' 
                : magicLinkStatus === 'success' 
                  ? 'Authentication successful!' 
                  : 'Authentication failed'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {magicLinkStatus === 'loading' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-center text-muted-foreground">
                  Please wait while we verify your access link...
                </p>
              </div>
            )}
            
            {magicLinkStatus === 'success' && (
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="ml-3">
                  <AlertDescription className="text-green-700 font-medium">
                    You have been successfully authenticated.
                  </AlertDescription>
                  <p className="text-sm mt-1">Redirecting you to your dashboard...</p>
                </div>
              </Alert>
            )}
            
            {magicLinkStatus === 'error' && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="ml-2">
                    {magicLinkError || "There was an error verifying your magic link"}
                  </AlertDescription>
                </Alert>
                <div className="text-center mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate("/auth")}
                    className="mx-auto"
                  >
                    Return to Login
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle forgot password submission
  const handleForgotPassword = () => {
    setForgotPasswordError('');
    setForgotPasswordSubmitting(true);
    
    // Basic validation
    if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
      setForgotPasswordError('Please enter a valid email address');
      setForgotPasswordSubmitting(false);
      return;
    }
    
    // Submit request to API
    fetch('/api/password-reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotPasswordEmail })
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to send reset link');
      return res.json();
    })
    .then(() => {
      setForgotPasswordSuccess(true);
      // Keep dialog open to show success message
    })
    .catch(err => {
      console.error('Error requesting password reset:', err);
      setForgotPasswordError('Failed to send reset link. Please try again.');
    })
    .finally(() => {
      setForgotPasswordSubmitting(false);
    });
  };
  
  // Reset forgot password dialog state when closed
  const handleForgotPasswordDialogClose = () => {
    setForgotPasswordDialogOpen(false);
    // Reset the state after a delay to avoid visual glitches
    setTimeout(() => {
      setForgotPasswordEmail('');
      setForgotPasswordError('');
      setForgotPasswordSuccess(false);
      setForgotPasswordSubmitting(false);
    }, 300);
  };

  // Regular auth form for non-magic link access
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Auth Form */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <img 
                src="/assets/kolmo-logo.png" 
                alt="Kolmo Constructions Logo" 
                className="h-20 object-contain"
              />
            </div>
            <CardTitle className="text-2xl text-center">Kolmo Constructions</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your construction project portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="hidden">
                <TabsTrigger value="login">Login</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your username" {...field} />
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {(loginMutation.isError || loginForm.formState.errors.root) && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {loginForm.formState.errors.root?.message || 
                           loginMutation.error?.message || 
                           "Invalid username or password"}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                    <div className="mt-2 text-center">
                      <Button 
                        variant="link" 
                        className="text-sm text-primary hover:text-primary-600 p-0"
                        type="button"
                        onClick={() => setForgotPasswordDialogOpen(true)}
                      >
                        Forgot your password?
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
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
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Smith" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john.smith@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="phone"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <FormLabel>Phone (optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="(123) 456-7890" 
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a password" {...field} />
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
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirm your password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {registerMutation.isError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {registerMutation.error?.message || "Registration failed. Please try again."}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {regSuccess && (
                      <Alert className="bg-green-50 text-green-800 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-700">
                          Registration successful! Redirecting to dashboard...
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={registerMutation.isPending || regSuccess}>
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registering...
                        </>
                      ) : regSuccess ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Registered!
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
          <CardFooter className="flex flex-col gap-2 items-center">
            <p className="text-sm text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
            {import.meta.env.DEV && (
              <Link href="/dev-tools">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                  Dev Tools
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
        
        {/* Forgot Password Dialog */}
        <Dialog open={forgotPasswordDialogOpen} onOpenChange={setForgotPasswordDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Your Password</DialogTitle>
              <DialogDescription>
                {!forgotPasswordSuccess 
                  ? "Enter your email address and we'll send you a link to reset your password." 
                  : "Password reset link sent!"}
              </DialogDescription>
            </DialogHeader>
            
            {!forgotPasswordSuccess ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                handleForgotPassword();
              }}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter className="sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleForgotPasswordDialogClose}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={forgotPasswordSubmitting || !forgotPasswordEmail}>
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
              </form>
            ) : (
              <div className="space-y-4 py-4">
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700">
                    We've sent a password reset link to your email if an account exists with that address.
                    {import.meta.env.DEV && (
                      <p className="mt-1 text-sm italic">
                        (In development mode: Check the server console for the reset link)
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button 
                    type="button" 
                    onClick={handleForgotPasswordDialogClose}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Info Section */}
        <div className="hidden md:flex flex-col space-y-8 p-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-800">Your Construction Projects at Your Fingertips</h2>
            <p className="text-slate-600">
              BuildPortal gives you a transparent, real-time view of your construction and remodeling projects.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary-100 text-primary-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Track Project Progress</h3>
                <p className="text-sm text-slate-600">Stay updated with the latest developments on your projects.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary-100 text-primary-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Access Documents</h3>
                <p className="text-sm text-slate-600">Easily view and download all project-related documents.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary-100 text-primary-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Communicate with Your Team</h3>
                <p className="text-sm text-slate-600">Message your project team members directly through the portal.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary-100 text-primary-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Monitor Finances</h3>
                <p className="text-sm text-slate-600">View detailed financial information including invoices and payments.</p>
              </div>
            </div>
          </div>
          
          <div className="pt-4">
            <Button variant="outline" className="gap-2" onClick={() => setActiveTab("login")}>
              <Home className="h-4 w-4" />
              Login to get started
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
