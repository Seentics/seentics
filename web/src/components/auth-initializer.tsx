'use client';

import { useEffect } from 'react';
import { useAuth } from '@/stores/useAuthStore';

export default function AuthInitializer() {
  const { initializeAuth, access_token, isTokenExpired } = useAuth();

  useEffect(() => {
    // Initialize auth state after component mounts
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    // Check if token is expired and handle accordingly
    if (access_token && isTokenExpired()) {
      // Token is expired, could implement refresh logic here
      console.log('Token expired, user should re-authenticate');
    }
  }, [access_token, isTokenExpired]);

  return null; // This component doesn't render anything
} 