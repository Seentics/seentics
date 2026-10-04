'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Crisp live chat: customers message us from any dashboard. Loaded only when
 * NEXT_PUBLIC_CRISP_WEBSITE_ID is set (deploy/pages.sh sets it for production), after
 * the page is interactive, so it never holds up the app. Who is signed in is passed to
 * Crisp, so a conversation arrives with the customer's name and email instead of an
 * anonymous visitor we have to ask.
 */
const WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

type CrispWindow = Window & { $crisp?: unknown[][]; CRISP_WEBSITE_ID?: string };

function loadCrisp(): boolean {
  if (!WEBSITE_ID || typeof window === 'undefined') return false;
  const w = window as CrispWindow;
  if (w.$crisp) return true;
  w.$crisp = [];
  w.CRISP_WEBSITE_ID = WEBSITE_ID;
  const script = document.createElement('script');
  script.src = 'https://client.crisp.chat/l.js';
  script.async = true;
  document.head.appendChild(script);
  return true;
}

/** Queued: Crisp reads `$crisp` once it loads, so this works before and after. */
function identify(user: { email?: string | null; name?: string | null } | null | undefined): void {
  const w = window as CrispWindow;
  if (!user || !w.$crisp) return;
  if (user.email) w.$crisp.push(['set', 'user:email', [user.email]]);
  if (user.name) w.$crisp.push(['set', 'user:nickname', [user.name]]);
}

/** Shared dashboards are read by the site owner's audience, not our customers: no chat there. */
const isPublicPage = (path: string | null) => Boolean(path && /^\/(public|share)\//.test(path));

export default function CrispChat() {
  const user = useAuth((state) => state.user);
  const publicPage = isPublicPage(usePathname());
  useEffect(() => {
    if (!publicPage && loadCrisp()) identify(user);
  }, [user, publicPage]);
  return null;
}
