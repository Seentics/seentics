import { redirect } from 'next/navigation';
import { config } from '@/lib/config';

/** OAuth callback now lives in auth/web (auth.seentics.com) — see signin/page.tsx. */
export default async function AuthCallbackRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const qs = params.toString();
  redirect(`${config.authUrl}/auth/callback${qs ? `?${qs}` : ''}`);
}
