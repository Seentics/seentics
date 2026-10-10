'use client';

import { useEffect } from 'react';
import { getApiUrl } from '@/lib/config';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Wait for persisted auth to rehydrate before clearing `isLoading`, so layouts and API calls
 * see `user` / tokens together (avoids transient 401s from firing queries too early).
 *
 * When nothing was persisted, ask the gateway before concluding the visitor is signed out.
 * Sign-in lives in its own app on another origin (auth/web), which stores its tokens in its
 * own localStorage — unreadable here — and leaves the session in the gateway's cookie. This
 * app used to trust only its own localStorage, so a fresh browser that had just signed in
 * was sent straight back to the sign-in page, round and round. The cookie session is read
 * with a plain fetch, not the api client: that one redirects to sign-in on a 401, which
 * would bounce every signed-out visitor off the public pages this runs on too.
 */
export default function AuthInitializer() {
  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      // An embed (`/embed/…`, inside someone else's page) has no use for a session and should not
      // probe the visitor's: it reads through its own link.
      const embedded = window.location.pathname.startsWith('/embed/');
      if (!embedded && !useAuth.getState().user) {
        try {
          const res = await fetch(getApiUrl('/user/auth/me'), { credentials: 'include' });
          if (res.ok) {
            const body = (await res.json()) as { data?: { user?: Parameters<ReturnType<typeof useAuth.getState>['setUser']>[0] } };
            const user = body.data?.user;
            if (user && !cancelled) useAuth.setState({ user, isAuthenticated: true });
          }
        } catch {
          // Offline or the gateway unreachable: carry on as signed out.
        }
      }
      if (!cancelled) useAuth.setState({ isLoading: false });
    };

    const unsub = useAuth.persist.onFinishHydration(() => void finish());
    if (useAuth.persist.hasHydrated()) void finish();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return null;
}
