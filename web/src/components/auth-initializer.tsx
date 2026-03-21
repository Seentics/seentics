'use client';

import { useEffect } from 'react';
import { useAuth } from '@/stores/useAuthStore';

export default function AuthInitializer() {
  const { initializeAuth } = useAuth();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return null;
}
