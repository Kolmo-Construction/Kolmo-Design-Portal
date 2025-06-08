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
import { AlertCircle, CheckCircle2, Home, Loader2, Shield, Award, Star, Users, MessageSquare, FileText, CreditCard } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { insertUserSchema } from "@shared/schema";
import kolmoLogo from "@assets/kolmo-logo (1).png";
// Force reload to clear cache

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

  // Get reset token for password reset
  const resetToken = isPasswordReset ? params.token : null;
  const [resetPasswordStatus, setResetPasswordStatus] = useState<'loading' | 'verifying' | 'ready' | 'success' | 'error'>('verifying');
  const [resetPasswordError, setResetPasswordError] = useState<string>('');

  // Password reset form schema
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

  // Handle password reset token verification
  useEffect(() => {
    if (isPasswordReset && resetToken) {
      setResetPasswordStatus('verifying');
      
      // Verify reset token
      fetch('/api/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken })
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid or expired reset token');
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
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div className="ml-3">
                  <AlertDescription className="text-green-700 font-medium">
                    Your password has been successfully reset.
                  </AlertDescription>
                  <p className="text-sm mt-1">Redirecting you to login...</p>
                </div>
              </Alert>
            )}
            
            {resetPasswordStatus === 'error' && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="ml-2">
                    {resetPasswordError || "There was an error resetting your password"}
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

  // Render magic link UI
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
    loginMutation.mutate(values, {
      onSuccess: () => {
        navigate("/");
      }
    });
  };

  const onRegisterSubmit = (values: RegisterFormValues) => {
    registerMutation.mutate(values, {
      onSuccess: () => {
        setRegSuccess(true);
        setTimeout(() => {
          setActiveTab("login");
          setRegSuccess(false);
        }, 3000);
      }
    });
  };

  // Handle forgot password dialog close
  const handleForgotPasswordDialogClose = () => {
    setForgotPasswordDialogOpen(false);
    setForgotPasswordEmail('');
    setForgotPasswordSuccess(false);
    setForgotPasswordError('');
    setForgotPasswordSubmitting(false);
  };

  // Handle forgot password submission  
  const handleForgotPassword = () => {
    setForgotPasswordSubmitting(true);
    setForgotPasswordError('');
    
    // Simulate API call with timeout
    setTimeout(() => {
      // For demo purposes, always show success
      // In a real app, you'd make an actual API call here
      fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to send reset email');
        }
        return response.json();
      })
      .then(() => {
        setForgotPasswordSuccess(true);
      })
      .catch(err => {
        console.error('Forgot password error:', err);
        setForgotPasswordError('Failed to send reset email. Please try again.');
      })
      .finally(() => {
        setForgotPasswordSubmitting(false);
      });
    }, 1000);
  };

  // Regular auth form for non-magic link access
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Professional Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={kolmoLogo} 
                alt="Kolmo Construction" 
                className="h-10 w-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Kolmo Construction</h1>
                <p className="text-sm text-slate-600">Professional Construction Services</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Licensed & Insured</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-500" />
                <span>EPA Certified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Auth Form */}
          <div className="order-2 lg:order-1">
            <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/95 backdrop-blur">
              <CardHeader className="space-y-6 pb-8">
                <div className="text-center space-y-2">
                  <CardTitle className="text-2xl font-bold text-slate-900">Welcome to Kolmo Portal</CardTitle>
                  <CardDescription className="text-slate-600">
                    Sign in to access your construction project portal
                  </CardDescription>
                </div>
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

                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={loginMutation.isPending}
                          style={{ backgroundColor: '#db973c' }}
                        >
                          {loginMutation.isPending ? (
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
                            variant="link"
                            type="button"
                            onClick={() => setForgotPasswordDialogOpen(true)}
                            className="text-sm text-slate-600 hover:text-slate-900"
                          >
                            Forgot your password?
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Professional Info Section */}
          <div className="order-1 lg:order-2 space-y-8">
            <div className="text-center lg:text-left space-y-4">
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900">
                Your Construction Projects at Your Fingertips
              </h2>
              <p className="text-lg text-slate-600">
                Access your project portal for real-time updates, document management, and seamless communication with your construction team.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 backdrop-blur">
                <div className="p-2 rounded-full bg-emerald-100">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Project Updates</h3>
                  <p className="text-sm text-slate-600">Real-time progress tracking and photo updates</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 backdrop-blur">
                <div className="p-2 rounded-full bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Document Access</h3>
                  <p className="text-sm text-slate-600">Contracts, permits, and project documents</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 backdrop-blur">
                <div className="p-2 rounded-full bg-purple-100">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Team Communication</h3>
                  <p className="text-sm text-slate-600">Direct messaging with project managers</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 backdrop-blur">
                <div className="p-2 rounded-full bg-orange-100">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Financial Tracking</h3>
                  <p className="text-sm text-slate-600">Invoices, payments, and project costs</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Seattle's Premier Builder</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>10+ Years Experience</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}