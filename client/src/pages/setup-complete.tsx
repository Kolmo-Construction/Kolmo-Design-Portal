import { CheckCircle2, Smartphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth-unified";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SetupComplete() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to appropriate page if user shouldn't be here
  useEffect(() => {
    if (user) {
      const accessScope = user.accessScope || 'both';
      // If user has web access, redirect to portal
      if (accessScope === 'web' || accessScope === 'both') {
        navigate("/");
      }
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Account Setup Complete!</CardTitle>
          <CardDescription>
            Your account has been successfully configured
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Smartphone className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">
                  Use the Mobile App
                </h3>
                <p className="text-sm text-blue-800">
                  Your account is configured for mobile app access. Please download
                  and login to the Kolmo mobile app using your email and the password
                  you just created.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              Your Login Credentials:
            </h4>
            <div className="bg-slate-100 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-mono text-sm">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="text-sm">The password you just created</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This account does not have access to the web
              portal. All features are available through the mobile application.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              // Logout and return to login page
              window.location.href = "/auth";
            }}
          >
            Return to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
