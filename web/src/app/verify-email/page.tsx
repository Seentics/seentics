'use client';

import { useEffect } from 'react';
import { config } from '@/lib/config';

/**
 * Email confirmation lives in auth/web, like password reset — see
 * reset-password/page.tsx. The link in the welcome email points here.
 */
export default function VerifyEmailRedirect() {
  useEffect(() => {
    window.location.replace(`${config.authUrl}/verify-email${window.location.search}`);
  }, []);

  return null;
}
