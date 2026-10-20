'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, LockKeyhole } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useClientMode } from './ClientMode';
import { canEditAccess, canView, editOnlyFallback, firstAllowedPath } from './routes';

/**
 * Keeps a client user on the pages their agency allowed. A page whose feature is off (or an
 * account-only page such as Developers or Billing) sends them to the first page they may open on
 * this website; a website that is not theirs, to their first website. An account passes straight
 * through. Must sit inside `ClientModeProvider`.
 */
export function FeatureGate({ children }: { children: ReactNode }) {
  const ctx = useClientMode();
  const t = useT().agency.clientMode;
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const target = (() => {
    if (!ctx || !ctx.access.isClient || ctx.access.isLoading || !ctx.websiteId) return null;
    const { site, websites } = ctx.access;
    if (!site) {
      for (const w of websites) {
        const path = firstAllowedPath(w.id, w.features);
        if (path) return path;
      }
      return 'none';
    }
    if (ctx.feature && canView(site.features[ctx.feature])) {
      // A create-only page (a new automation) when the client may only view: back to the list.
      return canEditAccess(site.features[ctx.feature]) ? null : editOnlyFallback(pathname, site.id);
    }
    return firstAllowedPath(site.id, site.features) ?? 'none';
  })();

  useEffect(() => {
    if (target && target !== 'none') router.replace(target);
  }, [target, router]);

  if (!ctx || !ctx.access.isClient) return <>{children}</>;
  if (ctx.access.isLoading || !ctx.websiteId) {
    return (
      <div className="flex flex-1 items-center justify-center py-24" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (target === 'none') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center" data-testid="client-nothing-shared">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LockKeyhole className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">{t.nothingTitle}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {t.nothingBody}
        </p>
      </div>
    );
  }
  if (target) return null;
  return <>{children}</>;
}
