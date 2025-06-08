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

export default function AuthPageNew({ isMagicLink = false, isPasswordReset = false }: AuthPageProps) {
  console.log("🚀 NEW AUTH PAGE COMPONENT LOADED - COMPLETELY FRESH VERSION!");
  const [activeTab, setActiveTab] = useState<string>("login");
  const [, navigate] = useLocation();
  const [magicLinkStatus, setMagicLinkStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [magicLinkError, setMagicLinkError] = useState<string>('');
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSubmitting, setForgotPasswordSubmitting] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);

  const { token } = useParams<{ token: string }>();
  const { login, register, user, loading: authLoading } = useAuth();

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

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !isMagicLink && !isPasswordReset) {
      navigate("/");
    }
  }, [user, navigate, isMagicLink, isPasswordReset]);

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
        // Invalidate auth queries to refresh user state
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

  const onLogin = async (data: LoginFormValues) => {
    try {
      await login(data);
      navigate("/");
    } catch (error: any) {
      console.error("Login failed:", error);
      loginForm.setError("root", {
        type: "manual",
        message: error.message || "Login failed",
      });
    }
  };

  const onRegister = async (data: RegisterFormValues) => {
    try {
      await register(data);
      navigate("/");
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

  // Magic link loading/success/error states
  if (isMagicLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Column - Branding & Features */}
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
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
                className="h-12 w-auto filter brightness-0 invert"
              />
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl font-bold mb-6 leading-tight">
              Professional Construction
              <span className="text-blue-200 block">Project Management</span>
            </h1>

            <p className="text-xl mb-12 text-blue-100 leading-relaxed">
              Streamline your construction projects with intelligent tools, 
              real-time collaboration, and comprehensive project oversight.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Secure Portal</h3>
                    <p className="text-sm text-blue-200">Enterprise-grade security</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Smart Quotes</h3>
                    <p className="text-sm text-blue-200">AI-powered estimates</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Team Collaboration</h3>
                    <p className="text-sm text-blue-200">Real-time updates</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Quality Assurance</h3>
                    <p className="text-sm text-blue-200">Professional standards</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 pt-8 border-t border-white/20">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-300 fill-current" />
                  <span className="text-sm font-medium">Trusted by 500+ contractors</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-green-300" />
                  <span className="text-sm font-medium">99.9% uptime</span>
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
                className="h-10 w-auto mx-auto mb-4"
              />
            </div>

            <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-slate-900">Welcome to Kolmo Portal</CardTitle>
                <CardDescription className="text-slate-600">
                  Access your construction project dashboard
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                    <TabsTrigger value="login" className="data-[state=active]:bg-white">Sign In</TabsTrigger>
                    <TabsTrigger value="register" className="data-[state=active]:bg-white">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4 mt-6">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700">Username</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="text"
                                  placeholder="Enter your username"
                                  className="bg-white border-slate-200 focus:border-blue-500"
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
                              <FormLabel className="text-slate-700">Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Enter your password"
                                  className="bg-white border-slate-200 focus:border-blue-500"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {loginForm.formState.errors.root && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {loginForm.formState.errors.root.message}
                            </AlertDescription>
                          </Alert>
                        )}

                        <Button
                          type="submit"
                          disabled={loginForm.formState.isSubmitting || authLoading}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                        >
                          {loginForm.formState.isSubmitting || authLoading ? (
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
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Forgot your password?
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="register" className="space-y-4 mt-6">
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700">First Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="First name"
                                    className="bg-white border-slate-200 focus:border-blue-500"
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
                                <FormLabel className="text-slate-700">Last Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Last name"
                                    className="bg-white border-slate-200 focus:border-blue-500"
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
                              <FormLabel className="text-slate-700">Username</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Choose a username"
                                  className="bg-white border-slate-200 focus:border-blue-500"
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
                              <FormLabel className="text-slate-700">Email</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder="your@email.com"
                                  className="bg-white border-slate-200 focus:border-blue-500"
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
                              <FormLabel className="text-slate-700">Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Create a strong password"
                                  className="bg-white border-slate-200 focus:border-blue-500"
                                />
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
                              <FormLabel className="text-slate-700">Confirm Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Confirm your password"
                                  className="bg-white border-slate-200 focus:border-blue-500"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {registerForm.formState.errors.root && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {registerForm.formState.errors.root.message}
                            </AlertDescription>
                          </Alert>
                        )}

                        <Button
                          type="submit"
                          disabled={registerForm.formState.isSubmitting || authLoading}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                        >
                          {registerForm.formState.isSubmitting || authLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating account...
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

              <CardFooter className="text-center pt-4">
                <p className="text-sm text-slate-500">
                  Secure access powered by Kolmo Construction Solutions
                </p>
              </CardFooter>
            </Card>

            {/* Footer Links */}
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-600">
                Need help accessing your account?
              </p>
              <div className="flex justify-center space-x-4 text-xs text-slate-500">
                <span>Contact Support</span>
                <span>•</span>
                <span>Privacy Policy</span>
                <span>•</span>
                <span>Terms of Service</span>
              </div>
            </div>
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
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            {forgotPasswordSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  If an account with that email exists, we've sent a password reset link.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleForgotPassword}
              disabled={forgotPasswordSubmitting || !forgotPasswordEmail}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}