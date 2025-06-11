import { useEffect } from "react";
import { useLocation } from "wouter";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuthV2 } from "@/hooks/use-auth-v2";
import { Shield, Building2, Users, CheckCircle } from "lucide-react";


export default function AuthPageV2() {
  const [, navigate] = useLocation();
  const { authState } = useAuthV2();

  // Redirect if already authenticated
  useEffect(() => {
    if (authState === "authenticated") {
      navigate("/");
    }
  }, [authState, navigate]);

  // Don't render anything while checking auth state
  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-pulse">
          <img src={kolmoLogo} alt="Kolmo" className="h-16 w-auto mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="flex min-h-screen">
        {/* Left Column - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 text-white relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 flex flex-col justify-between w-full">
            {/* Logo & Header */}
            <div>
              <img src={kolmoLogo} alt="Kolmo Logo" className="h-20 w-auto mb-8" />
              <h1 className="text-4xl font-bold mb-4">
                Welcome to Kolmo
              </h1>
              <p className="text-xl text-blue-100 mb-12">
                Your comprehensive construction project management platform
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-100" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Project Management</h3>
                  <p className="text-blue-200">Track progress, manage tasks, and stay organized</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-100" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Team Collaboration</h3>
                  <p className="text-blue-200">Real-time communication and file sharing</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-100" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Quality Control</h3>
                  <p className="text-blue-200">Ensure standards and track milestones</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-100" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Secure & Reliable</h3>
                  <p className="text-blue-200">Enterprise-grade security and data protection</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-blue-200 text-sm">
              © 2025 Kolmo. All rights reserved.
            </div>
          </div>
        </div>

        {/* Right Column - Authentication Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <img src={kolmoLogo} alt="Kolmo Logo" className="h-16 w-auto mx-auto" />
            </div>

            <LoginForm 
              onSuccess={() => navigate("/")}
              redirectTo="/"
            />

            {/* Additional Links */}
            <div className="mt-8 text-center space-y-4">
              <div className="text-sm text-gray-500">
                Need help? Contact your system administrator
              </div>
              
              <div className="text-xs text-gray-400">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}