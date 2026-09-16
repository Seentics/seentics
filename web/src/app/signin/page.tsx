import { redirect } from 'next/navigation';
import { config } from '@/lib/config';

/**
 * Signin now lives in auth/web (auth.seentics.com) so every product in the
 * suite shares one login UI. This stub exists so bookmarks and any link this
 * codebase forgot to update still land somewhere real, rather than 404ing.
 */
export default async function SignInRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const qs = params.toString();
  redirect(`${config.authUrl}/signin${qs ? `?${qs}` : ''}`);
}
