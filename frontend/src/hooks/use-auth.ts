import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/useAuthStore';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

export function useAuthGuard() {
  const { 
    isAuthenticated, 
    user, 
    access_token, 
    refresh_token, 
    isTokenExpired, 
    logout, 
    setTokens,
    setLoading 
  } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated || !user) {
        router.push('/signin');
        return;
      }

      // Check if token is expired
      if (isTokenExpired()) {
        await refreshToken();
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    // Token refresh functionality removed - no longer needed
    logout();
    router.push('/signin');
  }, [logout, router]);

  // Auto-refresh token before it expires
  useEffect(() => {
    if (!access_token || !isAuthenticated) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired()) {
        refreshToken();
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkTokenExpiry, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [access_token, isAuthenticated, isTokenExpired, refreshToken]);

  return {
    isAuthenticated,
    user,
    isLoading: false, // You can add loading state from auth store
    logout,
    refreshToken,
  };
}

// Hook for protecting specific components
export function useRequireAuth(redirectTo = '/signin') {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return {
    isAuthenticated,
    user,
    isLoading,
  };
} 