'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientAuthError, ClientAuthLoading, ClientAuthShell } from '@/components/client-auth/ClientAuthShell';
import { ClientAuthError as RequestError, getClientBrand, requestMagicLink } from '@/features/client-mode/api';
import { rememberClientAgency } from '@/features/client-mode/session';
import type { ClientBrand } from '@/features/client-mode/types';
import { config } from '@/lib/config';
import { hardRedirect } from '@/lib/hard-redirect';
import { onCustomHost } from '@/lib/seentics-host';

/**
 * Two sign-ins share this address.
 *
 * - `/signin?agency=<slug>`: an agency's client users sign in here by email link, on a page
 *   wearing the agency's brand (`GET /client-auth/brand`). The answer never says whether the
 *   email belongs to a client user.
 * - Anything else (no `agency`, or no agency by that name): account sign-in, which lives in the
 *   auth app (auth.seentics.com) so every product in the suite shares one login UI. The query
 *   string goes along, so bookmarks and old links still land somewhere real.
 *
 * On an agency's own domain (reports.agency.com) only the first exists, and needs no `agency`:
 * the brand is asked with no slug and the gateway answers for the agency owning the domain.
 * Account sign-in is never offered there.
 *
 * Static export has no server to read the query per request, so the page reads it in the browser.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toAccountSignIn() {
  const params = new URLSearchParams(window.location.search);
  params.delete('agency');
  const query = params.toString();
  hardRedirect(`${config.authUrl}/signin${query ? `?${query}` : ''}`);
}

type Phase = 'resolving' | 'form' | 'sent';

export default function SignInPage() {
  const [phase, setPhase] = useState<Phase>('resolving');
  const [slug, setSlug] = useState('');
  const [brand, setBrand] = useState<ClientBrand | null>(null);
  const [expired, setExpired] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const custom = onCustomHost();
    const agency = custom ? '' : params.get('agency')?.trim().toLowerCase() ?? '';
    if (!agency && !custom) {
      toAccountSignIn();
      return;
    }
    let cancelled = false;
    setSlug(agency);
    setExpired(params.get('expired') === 'true');
    getClientBrand(agency || null)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          // On the agency's own domain there is no account sign-in to fall back to.
          if (custom) setPhase('form');
          else toAccountSignIn();
          return;
        }
        setBrand(found);
        setPhase('form');
      })
      .catch(() => {
        // The brand could not be read (offline, a hiccup): sign-in still works without the look.
        if (!cancelled) setPhase('form');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await requestMagicLink(address, slug || null);
      // The link opens /signin/verify, which sends an expired one back to this agency's page.
      if (slug) rememberClientAgency(slug);
      setPhase('sent');
    } catch (err) {
      setError(err instanceof RequestError ? err.message : 'We could not send a link just now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (phase === 'resolving') return <ClientAuthLoading />;

  const name = brand?.brand_name || 'your agency';

  if (phase === 'sent') {
    return (
      <ClientAuthShell
        brand={brand}
        title="Check your email"
        subtitle={<>If <span className="font-medium text-foreground">{email.trim()}</span> can sign in to {name}, a sign-in link is on its way.</>}
        footer={brand?.support_email ? <>Trouble signing in? <a className="font-medium text-foreground underline-offset-4 hover:underline" href={`mailto:${brand.support_email}`}>Contact {name}</a></> : undefined}
      >
        <div className="flex flex-col items-center text-center" data-testid="client-signin-sent">
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Open the link on this device. It works once and expires in 15 minutes. Nothing arrived? Check your spam folder, or ask
            {' '}{name} to invite this address.
          </p>
          <Button variant="outline" className="mt-6 w-full font-medium" onClick={() => setPhase('form')}>
            Use another email
          </Button>
        </div>
      </ClientAuthShell>
    );
  }

  return (
    <ClientAuthShell
      brand={brand}
      title={brand ? `Sign in to ${brand.brand_name}` : 'Sign in to your dashboard'}
      subtitle="Enter your email and we will send you a link to sign in. No password needed."
      footer={brand?.support_email ? <>Need access? <a className="font-medium text-foreground underline-offset-4 hover:underline" href={`mailto:${brand.support_email}`}>Contact {name}</a></> : undefined}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {expired && !error && <ClientAuthError>Your session has ended. Sign in again to continue.</ClientAuthError>}
        {error && <ClientAuthError>{error}</ClientAuthError>}
        <div className="space-y-1.5">
          <label htmlFor="client-email" className="text-sm font-medium text-foreground">Email</label>
          <Input
            id="client-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            autoFocus
            required
          />
        </div>
        <Button type="submit" disabled={sending} className="mt-1 w-full font-semibold">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Email me a sign-in link'}
        </Button>
      </form>
    </ClientAuthShell>
  );
}
