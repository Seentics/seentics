'use client';

import { useEffect } from 'react';
import { config } from '@/lib/config';

/**
 * Password reset now lives in auth/web (auth.seentics.com) — see signin/page.tsx.
 *
 * Used to be a Server Component reading `searchParams` — static export has
 * no server left to do that per-request, and `await searchParams` is
 * unsupported under output: 'export' outright (query params aren't known at
 * build time). Reads the real query string from the browser instead.
 */
export default function ResetPasswordRedirect() {
  useEffect(() => {
    window.location.replace(`${config.authUrl}/reset-password${window.location.search}`);
  }, []);

  return null;
}
