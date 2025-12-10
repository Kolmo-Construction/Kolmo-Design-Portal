import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth-unified";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { theme } from "@/config/theme";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo = "/" }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const magicLinkForm = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password);

      toast({
        title: "Login Successful",
        description: "Welcome back! You have been logged in successfully.",
      });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      } else {
        // Navigate to redirect destination
        navigate(redirectTo);
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onMagicLinkSubmit = async (data: MagicLinkFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      if (response.ok) {
        setMagicLinkSent(true);
        toast({
          title: "Check Your Email",
          description: "If an account exists, we've sent you a login link.",
        });
      } else {
        throw new Error("Failed to send magic link");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const formIsLoading = isLoading || form.formState.isSubmitting || magicLinkForm.formState.isSubmitting;

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg" style={{ borderColor: theme.colors.border }}>
      <CardHeader className="space-y-1" style={{ backgroundColor: theme.colors.surfaceLight }}>
        <CardTitle className="text-2xl font-bold text-center" style={{ color: theme.colors.primary }}>
          {showPasswordLogin ? "Sign In" : "Welcome Back"}
        </CardTitle>
        <CardDescription className="text-center" style={{ color: theme.colors.textMuted }}>
          {showPasswordLogin
            ? "Enter your credentials to access Kolmo"
            : "Enter your email for instant access"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {!showPasswordLogin ? (
          /* Magic Link Login (Primary) */
          magicLinkSent ? (
            <div className="space-y-4">
              <Alert style={{ backgroundColor: theme.colors.surfaceLight, borderColor: theme.colors.accent }}>
                <Mail className="h-4 w-4" style={{ color: theme.colors.accent }} />
                <AlertDescription style={{ color: theme.colors.textDark }}>
                  Check your email for a login link. Click the link to access your account instantly.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMagicLinkSent(false)}
                style={{ color: theme.colors.accent }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </div>
          ) : (
            <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: theme.colors.primary }}>Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={formIsLoading}
                  style={{ borderColor: theme.colors.border, color: theme.colors.textDark }}
                  {...magicLinkForm.register("email")}
                />
                {magicLinkForm.formState.errors.email && (
                  <p className="text-sm" style={{ color: theme.colors.error }}>
                    {magicLinkForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full font-medium text-white"
                style={{ backgroundColor: theme.colors.accent }}
                disabled={formIsLoading}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colors.accentDark)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.colors.accent)}
              >
                {formIsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Login Link
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={() => setShowPasswordLogin(true)}
                  style={{ color: theme.colors.textMuted }}
                >
                  Sign in with password instead
                </Button>
              </div>
            </form>
          )
        ) : (
          /* Password Login (Secondary) */
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="username" style={{ color: theme.colors.primary }}>Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              autoComplete="username"
              disabled={formIsLoading}
              style={{ borderColor: theme.colors.border, color: theme.colors.textDark }}
              {...form.register("username")}
            />
            {form.formState.errors.username && (
              <p className="text-sm" style={{ color: theme.colors.error }}>
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" style={{ color: theme.colors.primary }}>Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={formIsLoading}
                style={{ borderColor: theme.colors.border, color: theme.colors.textDark }}
                {...form.register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={formIsLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" style={{ color: theme.colors.textMuted }} />
                ) : (
                  <Eye className="h-4 w-4" style={{ color: theme.colors.textMuted }} />
                )}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm" style={{ color: theme.colors.error }}>
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              id="rememberMe"
              type="checkbox"
              className="h-4 w-4 rounded"
              style={{ borderColor: theme.colors.border, accentColor: theme.colors.accent }}
              disabled={formIsLoading}
              {...form.register("rememberMe")}
            />
            <Label htmlFor="rememberMe" className="text-sm" style={{ color: theme.colors.textDark }}>
              Remember me for 30 days
            </Label>
          </div>

          {/* Error Display - handled by toast now */}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full font-medium text-white"
            style={{ backgroundColor: theme.colors.accent }}
            disabled={formIsLoading}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colors.accentDark)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.colors.accent)}
          >
            {formIsLoading ? (
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
              className="text-sm"
              onClick={() => setShowPasswordLogin(false)}
              style={{ color: theme.colors.textMuted }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to email login
            </Button>
          </div>
        </form>
        )}
      </CardContent>
    </Card>
  );
}