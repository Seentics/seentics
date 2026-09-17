'use client';

import { useEffect } from 'react';
import { config } from '@/lib/config';

/**
 * Signin now lives in auth/web (auth.seentics.com) so every product in the
 * suite shares one login UI. This stub exists so bookmarks and any link this
 * codebase forgot to update still land somewhere real, rather than 404ing.
 *
 * Used to be a Server Component reading `searchParams` — static export has
 * no server left to do that per-request, and `await searchParams` is
 * unsupported under output: 'export' outright (query params aren't known at
 * build time). Reads the real query string from the browser instead.
 */
export default function SignInRedirect() {
  useEffect(() => {
    window.location.replace(`${config.authUrl}/signin${window.location.search}`);
  }, []);

  return null;
}
