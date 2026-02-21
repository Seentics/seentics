'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function GoogleAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast({
        title: "Authentication Failed",
        description: `Error from Google: ${error}`,
        variant: "destructive",
      });
      router.push('/signin');
      return;
    }

    if (code) {
      const exchangeCode = async () => {
        try {
          const response = await api.get(`/user/auth/google/callback?code=${code}`);
          const data = response.data;

          if (data.data?.tokens && data.data?.user) {
            setAuth({
              user: data.data.user,
              access_token: data.data.tokens.accessToken,
              refresh_token: data.data.tokens.refreshToken,
              rememberMe: true
            });

            toast({
              title: "Welcome back!",
              description: "Successfully signed in with Google.",
            });

            router.push('/websites');
          } else if (response.status === 307 || response.status === 302) {
             // If the backend returned a redirect (which it shouldn't if called via API, 
             // but just in case it was a direct hit that the proxy handled)
             // We'll follow it or handle the tokens from the URL if they are there.
             const url = new URL(response.headers.location, window.location.origin);
             const accessToken = url.searchParams.get('accessToken');
             const refreshToken = url.searchParams.get('refreshToken');
             if (accessToken && refreshToken) {
                 window.location.href = `/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
             }
          }
        } catch (error: any) {
          console.error('Google OAuth exchange error:', error);
          toast({
            title: "Sign In Failed",
            description: error.response?.data?.error || "Failed to exchange Google code",
            variant: "destructive",
          });
          router.push('/signin');
        }
      };

      exchangeCode();
    } else {
      // If no code, maybe it's the backend redirecting us with tokens already?
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      if (accessToken && refreshToken) {
          router.push(`/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
      } else {
          router.push('/signin');
      }
    }
  }, [searchParams, setAuth, router, toast]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#020617]">
      <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
      <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
        Authenticating with Google...
      </p>
    </div>
  );
}

export default function page() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center">
            <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
    }>
      <GoogleAuthCallback />
    </Suspense>
  );
}
