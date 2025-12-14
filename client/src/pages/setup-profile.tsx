import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-unified";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Setup profile form schema - password is optional for magic-link users
const setupProfileSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  setupPassword: z.boolean().optional(), // Checkbox to enable password setup
}).superRefine((data, ctx) => {
  // Only validate password fields if user opted to set up password
  if (data.setupPassword) {
    if (!data.username || data.username.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Username must be at least 3 characters",
        path: ["username"],
      });
    }
    if (!data.password || data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password must be at least 8 characters",
        path: ["password"],
      });
    }
    if (!data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please confirm your password",
        path: ["confirmPassword"],
      });
    }
    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords don't match",
        path: ["confirmPassword"],
      });
    }
  }
});

type SetupProfileFormValues = z.infer<typeof setupProfileSchema>;

export default function SetupProfile() {
  const [, navigate] = useLocation();
  const { user, setupProfileMutation } = useAuth();
  const [showPassword, setShowPassword] = useState({
    password: false,
    confirm: false
  });
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [wantsPasswordSetup, setWantsPasswordSetup] = useState(false);

  // If the user is already activated, redirect to home
  useEffect(() => {
    if (user && user.isActivated) {
      navigate("/");
    }
  }, [user, navigate]);

  // If there's no user at all (not even a partial one from magic link), redirect to auth
  if (!user) {
    navigate("/auth");
    return null;
  }

  const form = useForm<SetupProfileFormValues>({
    resolver: zodResolver(setupProfileSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      setupPassword: false,
    },
  });

  const onSubmit = (values: SetupProfileFormValues) => {
    setupProfileMutation.mutate(values, {
      onSuccess: (data) => {
        setSetupSuccess(true);
        setTimeout(() => {
          // Check user's access scope to determine redirect
          const userAccessScope = data.user.accessScope || 'both';
          if (userAccessScope === 'mobile') {
            // Mobile-only users should use the mobile app
            navigate("/setup-complete");
          } else {
            // Web or both access users go to web portal
            navigate("/");
          }
        }, 2000);
      }
    });
  };

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
          <CardTitle className="text-2xl">Complete Your Account Setup</CardTitle>
          <CardDescription>
            Create a username and password to access your construction project portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                control={form.control}
                name="phone"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
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

              {/* Login Method Information */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Quick Login:</strong> You can login anytime using just your email address - no password needed!
                </p>
                <p className="text-xs text-blue-600">
                  We'll send you a login link via email whenever you want to access your account.
                </p>
              </div>

              {/* Optional Password Setup Checkbox */}
              <FormField
                control={form.control}
                name="setupPassword"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1"
                        checked={field.value}
                        onChange={(e) => {
                          field.onChange(e.target.checked);
                          setWantsPasswordSetup(e.target.checked);
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-base font-medium cursor-pointer">
                        Also set up password login (optional)
                      </FormLabel>
                      <FormDescription>
                        Add a username and password as an alternative way to login. Only recommended if you prefer traditional login.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Conditionally show username and password fields */}
              {wantsPasswordSetup && (
                <>
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Choose a username" {...field} />
                        </FormControl>
                        <FormDescription>
                          This will be used to log in with password
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input 
                          type={showPassword.password ? "text" : "password"} 
                          placeholder="Create a secure password" 
                          {...field} 
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowPassword({...showPassword, password: !showPassword.password})}
                      >
                        {showPassword.password ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormDescription>
                      Password must be at least 8 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input 
                          type={showPassword.confirm ? "text" : "password"} 
                          placeholder="Confirm your password" 
                          {...field} 
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowPassword({...showPassword, confirm: !showPassword.confirm})}
                      >
                        {showPassword.confirm ? (
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
                </>
              )}

              {setupProfileMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {setupProfileMutation.error?.message || "There was an error setting up your account. Please try again."}
                  </AlertDescription>
                </Alert>
              )}
              
              {setupSuccess && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700">
                    Account setup complete! Redirecting to dashboard...
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={setupProfileMutation.isPending || setupSuccess}
              >
                {setupProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Up Account...
                  </>
                ) : setupSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Account Set Up!
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}