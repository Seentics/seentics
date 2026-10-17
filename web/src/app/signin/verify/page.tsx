'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientAuthError, ClientAuthShell } from '@/components/client-auth/ClientAuthShell';
import { ClientAuthError as VerifyError, getClientBrand, getClientMe, verifyMagicLink } from '@/features/client-mode/api';
import { CLIENT_ME_KEY } from '@/features/client-mode/useClientAccess';
import { firstAllowedPath } from '@/features/client-mode/routes';
import { clientSignInHref, rememberClientAgency, rememberedClientAgency } from '@/features/client-mode/session';
import type { ClientBrand, ClientMe } from '@/features/client-mode/types';
import { forgetWebsite } from '@/lib/last-website';
import { onCustomHost } from '@/lib/seentics-host';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Where a client user's email link lands: `/signin/verify#t=<token>`. The token is in the
 * fragment so it never reaches a server log or a Referer; it is read here, taken off the address,
 * and traded once (`POST /client-auth/verify`) for a session stored exactly as an account's
 * (`useAuth().setAuth`, the API client's bearer token). Then on to the client's first website.
 * On an agency's own domain the tokens come in the body only (no cookies), so that stored session
 * is the only one.
 */

/** The first page the client may open, on the first website that has one. */
function landingFor(me: ClientMe): string {
  for (const site of me.websites) {
    const path = firstAllowedPath(site.id, site.features);
    if (path) return path;
  }
  return '/websites';
}

function readToken(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return hash.get('t') || new URLSearchParams(window.location.search).get('t');
}

type Phase = 'verifying' | 'invalid' | 'error';

export default function VerifyClientLinkPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('verifying');
  const [message, setMessage] = useState('');
  const [slug, setSlug] = useState<string | null>(null);
  const [brand, setBrand] = useState<ClientBrand | null>(null);
  const token = useRef<string | null>(null);
  const started = useRef(false);

  const verify = async () => {
    const value = token.current;
    if (!value) {
      setPhase('invalid');
      return;
    }
    setPhase('verifying');
    try {
      const session = await verifyMagicLink(value);
      token.current = null;
      // A new person in this browser: nothing of the previous session's cache or last site.
      queryClient.clear();
      forgetWebsite();
      useAuth.getState().setAuth({ user: session.user, access_token: session.access_token, refresh_token: session.refresh_token });
      if (session.agency.slug) rememberClientAgency(session.agency.slug);
      let target = '/websites';
      try {
        const me = await getClientMe();
        queryClient.setQueryData(CLIENT_ME_KEY, me);
        target = landingFor(me);
      } catch {
        // /websites finds the client's first website itself.
      }
      router.replace(target);
    } catch (err) {
      if (err instanceof VerifyError && err.code !== 'invalid_link') {
        setMessage(err.message);
        setPhase('error');
      } else {
        token.current = null;
        setPhase('invalid');
      }
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    token.current = readToken();
    // Off the address bar and out of history: the link works once anyway.
    window.history.replaceState(null, '', window.location.pathname);
    // On an agency's own domain the domain names the agency: its brand is asked with no slug.
    const custom = onCustomHost();
    const remembered = custom ? null : rememberedClientAgency();
    setSlug(remembered);
    if (remembered || custom) getClientBrand(remembered).then(setBrand).catch(() => undefined);
    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestNew = (
    <Button asChild className="w-full font-semibold">
      <Link href={clientSignInHref(slug)}>Request a new link</Link>
    </Button>
  );

  if (phase === 'invalid') {
    return (
      <ClientAuthShell
        brand={brand}
        title="This link is invalid or has expired"
        subtitle="Sign-in links work once and expire after 15 minutes. Request a new one and use it on this device."
      >
        <div className="flex flex-col items-center text-center" data-testid="client-link-invalid">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LinkIcon className="h-5 w-5" />
          </span>
          {requestNew}
        </div>
      </ClientAuthShell>
    );
  }

  if (phase === 'error') {
    return (
      <ClientAuthShell brand={brand} title="We could not sign you in" subtitle="Your link has not been used. Try again in a moment.">
        <div className="space-y-3">
          <ClientAuthError>{message}</ClientAuthError>
          <Button className="w-full font-semibold" onClick={() => void verify()}>Try again</Button>
        </div>
      </ClientAuthShell>
    );
  }

  return (
    <ClientAuthShell brand={brand} title="Signing you in…" subtitle="One moment while we check your link.">
      <div className="flex justify-center py-2" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </ClientAuthShell>
  );
}
