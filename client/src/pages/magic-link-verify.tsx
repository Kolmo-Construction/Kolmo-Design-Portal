import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Home, Loader2 } from "lucide-react";

export default function MagicLinkVerifyPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      verifyMagicLink(token);
    }
  }, [token]);

  const verifyMagicLink = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/magic-link/${token}`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setStatus('success');
        
        // Update the authentication cache
        await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        
        // Handle redirect based on server response
        if (data.redirect === '/setup-profile') {
          // New user needs to set up their profile
          setTimeout(() => navigate('/setup-profile'), 2000);
        } else {
          // Existing user, redirect to dashboard
          setTimeout(() => navigate('/'), 2000);
        }
      } else {
        const errorText = await response.text();
        setError(errorText || 'Invalid or expired magic link');
        setStatus('error');
      }
    } catch (error) {
      setError('Failed to verify magic link');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 flex items-center justify-center bg-blue-100 rounded-full">
            {status === 'loading' && <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-8 w-8 text-green-600" />}
            {status === 'error' && <AlertCircle className="h-8 w-8 text-red-600" />}
          </div>
          <CardTitle className="text-xl font-semibold text-slate-900">
            {status === 'loading' && 'Verifying Access...'}
            {status === 'success' && 'Access Granted!'}
            {status === 'error' && 'Access Denied'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <p className="text-slate-600">Please wait while we verify your access link...</p>
          )}
          {status === 'success' && (
            <div className="space-y-2">
              <p className="text-green-700 font-medium">You have been successfully logged in!</p>
              <p className="text-slate-600 text-sm">Redirecting you to the portal...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-red-700">{error}</p>
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