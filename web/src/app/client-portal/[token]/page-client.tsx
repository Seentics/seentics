'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Link2Off, Loader2 } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { setEmbedToken } from '@/lib/api';
import { PortalTokenError, hexToHslTriple, validatePortalToken } from '@/features/agency/portal';
import type { PortalBrand, PortalSession } from '@/features/agency/types';
import { EmbedDashboard } from '@/components/embed/EmbedDashboard';

/**
 * An agency's client portal: `/client-portal/<token>`, on Seentics' host or on the agency's own
 * domain (functions/_middleware.ts serves only this there).
 *
 * The token is the credential: validated once for the client, its websites and the agency's brand,
 * then sent with every read to the embed API, which scopes it to that client's websites, read-only
 * (`setEmbedToken`). Nothing here links into the dashboard, which needs a Seentics login. The brand
 * replaces Seentics' — name, logo, colour, footer — and "Powered by Seentics" goes when the agency
 * hides it. Every refusal reads the same, as Core answers it: invalid or expired.
 */

/** Core's portal tokens all carry this prefix; anything else is refused without asking. */
const PORTAL_TOKEN_PREFIX = 'scp_';

type PortalState =
  | { status: 'loading' }
  | { status: 'valid'; session: PortalSession }
  | { status: 'invalid' }
  | { status: 'error' };

/** The agency's colour as the theme's primary, for the whole document (menus render outside the page). */
function useBrandColor(color: string | undefined) {
  useEffect(() => {
    const hsl = color ? hexToHslTriple(color) : null;
    if (!hsl) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', hsl);
    return () => { root.style.removeProperty('--primary'); };
  }, [color]);
}

/** The tab says the agency's name and shows its logo, not Seentics'. */
function useBrandHead(title: string | undefined, logoUrl: string | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
  useEffect(() => {
    if (!logoUrl) return;
    const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    const previous = icons.map(l => l.href);
    if (icons.length === 0) {
      const link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
      icons.push(link);
    }
    icons.forEach(l => { l.href = logoUrl; });
    return () => icons.forEach((l, i) => { if (previous[i]) l.href = previous[i]!; });
  }, [logoUrl]);
}

function BrandMark({ brand, name }: { brand: PortalBrand; name: string }) {
  const [failed, setFailed] = useState(false);
  if (brand.logoUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logoUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-md object-contain" onError={() => setFailed(true)} />;
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6">{children}</div>;
}

export default function ClientPortalPage() {
  const token = usePathSegment(1);
  const [state, setState] = useState<PortalState>({ status: 'loading' });
  const session = state.status === 'valid' ? state.session : null;
  const brandName = session ? session.brand.brandName || session.client.name : undefined;

  useBrandColor(session?.brand.primaryColor);
  useBrandHead(brandName, session?.brand.logoUrl || undefined);

  useEffect(() => {
    if (token === null) return;
    if (!token.startsWith(PORTAL_TOKEN_PREFIX)) {
      setState({ status: 'invalid' });
      return;
    }
    let cancelled = false;
    validatePortalToken(token)
      .then(s => {
        if (cancelled) return;
        // Before the dashboard renders, so its very first read already carries the token.
        setEmbedToken(token);
        setState({ status: 'valid', session: s });
      })
      .catch(e => { if (!cancelled) setState({ status: e instanceof PortalTokenError ? 'invalid' : 'error' }); });
    return () => { cancelled = true; };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  if (state.status === 'invalid' || state.status === 'error') {
    return (
      <Centered>
        <div className="surface flex max-w-sm flex-col items-center gap-2 px-6 py-10 text-center" data-testid="portal-invalid">
          <Link2Off className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">
            {state.status === 'invalid' ? 'This link is invalid or has expired' : 'This page couldn’t load'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state.status === 'invalid'
              ? 'Ask whoever sent it to you for a new link.'
              : 'Please try again in a moment.'}
          </p>
        </div>
      </Centered>
    );
  }

  const { client, brand } = state.session;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-4 py-3 md:px-6">
          <BrandMark brand={brand} name={brandName!} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground" data-testid="portal-brand">{brandName}</p>
            {brand.brandName && <p className="truncate text-xs text-muted-foreground">{client.name}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 md:px-2">
        <EmbedDashboard
          id={client.id}
          token={token!}
          clientMode
          invalid={{ title: 'This link is no longer valid', body: 'Ask whoever sent it to you for a new link.' }}
        />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground md:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {brand.footerText && <span data-testid="portal-footer">{brand.footerText}</span>}
            {brand.supportEmail && (
              <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground">{brand.supportEmail}</a>
            )}
            <span>Read-only · link works until {format(new Date(state.session.expiresAt), 'MMM d, yyyy')}</span>
          </div>
          {!brand.hideSeentics && <span>Powered by Seentics</span>}
        </div>
      </footer>
    </div>
  );
}
