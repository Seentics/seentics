'use client';

import { useEffect } from 'react';
import { useAuth } from '@/stores/useAuthStore';

export default function AuthInitializer() {
  const { initializeAuth, access_token, isTokenExpired, isAuthenticated, user, refresh_token, rememberMe } = useAuth();

  useEffect(() => {
    // Initialize auth state after component mounts
    initializeAuth();
  }, [initializeAuth]);

  // Sync zustand store to cookies for middleware support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const state = {
        state: {
          user,
          access_token,
          refresh_token,
          isAuthenticated,
          rememberMe
        },
        version: 0
      };

      // Set cookie with 7 day expiry if rememberMe, else session
      const expiry = rememberMe ? "; max-age=604800" : "";
      document.cookie = `auth-storage=${encodeURIComponent(JSON.stringify(state))}; path=/${expiry}; samesite=lax`;
    }
  }, [user, access_token, refresh_token, isAuthenticated, rememberMe]);

  useEffect(() => {
    // Check if token is expired and handle accordingly
    if (access_token && isTokenExpired()) {
      // Token is expired, could implement refresh logic here
      console.log('Token expired, user should re-authenticate');
    }
  }, [access_token, isTokenExpired]);

  return null; // This component doesn't render anything
}