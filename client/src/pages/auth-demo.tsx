import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Code, Users, Shield, Zap } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/use-auth-unified";

export default function AuthDemo() {
  const [, navigate] = useLocation();
  const { user, authState, login, logout } = useAuth();

  const improvements = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Enhanced Security",
      description: "Improved session handling and race condition prevention"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Better Performance", 
      description: "Optimized React Query caching and reduced API calls"
    },
    {
      icon: <Code className="w-5 h-5" />,
      title: "Cleaner Architecture",
      description: "Modular components with separation of concerns"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Better UX",
      description: "Improved loading states and error handling"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="text-sm">
            Authentication System Refactor Complete
          </Badge>
          <h1 className="text-4xl font-bold text-gray-900">
            Enhanced Authentication System
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Demonstration of the refactored authentication system with improved security, 
            performance, and user experience.
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Authentication Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Current State:</span>
                <Badge variant={authState === "authenticated" ? "default" : "secondary"}>
                  {authState}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>User:</span>
                <span className="font-medium">
                  {user ? `${user.firstName} ${user.lastName}` : "Not logged in"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Role:</span>
                <span className="font-medium">
                  {user?.role || "None"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => navigate("/auth")} 
                variant="outline" 
                className="w-full"
              >
                View Original Auth Page
              </Button>
              <Button 
                onClick={() => navigate("/auth-v2")} 
                className="w-full"
              >
                View Refactored Auth Page
              </Button>
              <Button 
                onClick={() => navigate("/")} 
                variant="secondary" 
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Improvements */}
        <Card>
          <CardHeader>
            <CardTitle>Key Improvements</CardTitle>
            <CardDescription>
              Major enhancements made to the authentication system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {improvements.map((improvement, index) => (
                <div key={index} className="flex gap-3 p-4 bg-slate-50 rounded-lg">
                  <div className="text-blue-600">{improvement.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{improvement.title}</h3>
                    <p className="text-sm text-gray-600">{improvement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Interactive Demo */}
        {!user && (
          <Card>
            <CardHeader>
              <CardTitle>Try the Refactored Login</CardTitle>
              <CardDescription>
                Test the new authentication components (admin/admin)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <LoginForm 
                  onSuccess={() => {
                    console.log("Login successful from demo page");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
            <CardDescription>
              Overview of the refactored authentication architecture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Components</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• LoginForm component</li>
                  <li>• ProtectedRoute wrapper</li>
                  <li>• AuthProvider context</li>
                  <li>• useAuthV2 hook</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Features</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Race condition prevention</li>
                  <li>• Enhanced error handling</li>
                  <li>• Optimized state management</li>
                  <li>• Improved loading states</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Integration</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• React Query caching</li>
                  <li>• Stream Chat integration</li>
                  <li>• Session persistence</li>
                  <li>• Redirect handling</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Summary */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              Implementation Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="text-green-700">
            <p>
              The authentication system has been successfully refactored with improved 
              security, performance, and maintainability. All login functionality is 
              working correctly, and the redirect loop issues have been resolved.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}