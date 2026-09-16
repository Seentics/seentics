import { redirect } from 'next/navigation';
import { config } from '@/lib/config';

/** Invite acceptance now lives in auth/web (auth.seentics.com) — see signin/page.tsx. */
export default async function AcceptInviteRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const qs = params.toString();
  redirect(`${config.authUrl}/accept-invite${qs ? `?${qs}` : ''}`);
}
