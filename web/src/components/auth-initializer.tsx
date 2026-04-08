'use client';

import { useEffect } from 'react';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Wait for persisted auth to rehydrate before clearing `isLoading`, so layouts and API calls
 * see `user` / tokens together (avoids transient 401s from firing queries too early).
 */
export default function AuthInitializer() {
  useEffect(() => {
    const finish = () => useAuth.setState({ isLoading: false });
    const unsub = useAuth.persist.onFinishHydration(finish);
    if (useAuth.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  return null;
}
