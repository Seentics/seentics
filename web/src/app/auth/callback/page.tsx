'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      // Set tokens in auth store
      // We also need user details, so we'll fetch them from the /user/auth/me or similar endpoint
      // based on the existing implementation, normally tokens are returned with user info.
      // For Google OAuth, we'll fetch profile after setting tokens.
      
      const finalizeAuth = async () => {
        try {
          // Set initial auth state with tokens
          setAuth({
            user: null as any, // Temporary null until we fetch details
            access_token: accessToken,
            refresh_token: refreshToken,
            rememberMe: true
          });

          // Fetch current user details
          const response = await api.get('/user/auth/me');
          if (response.data?.data?.user) {
             setAuth({
                user: response.data.data.user,
                access_token: accessToken,
                refresh_token: refreshToken,
                rememberMe: true
              });

              toast({
                title: "Welcome!",
                description: "Successfully signed in with Google.",
              });

              router.push('/websites');
          } else {
              throw new Error("Failed to fetch user profile");
          }
        } catch (error: any) {
          console.error('OAuth callback error:', error);
          toast({
            title: "Authentication Failed",
            description: "Could not finalize Google sign-in. Please try again.",
            variant: "destructive",
          });
          router.push('/signin');
        }
      };

      finalizeAuth();
    } else {
      router.push('/signin');
    }
  }, [searchParams, setAuth, router, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#020617]">
      <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
      <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
        Finalizing authentication...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
    }>
      <AuthCallback />
    </Suspense>
  );
}
