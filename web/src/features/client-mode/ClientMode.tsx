'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { brandColorVars, brandLogo } from './brand';
import { featureForPath } from './routes';
import { useClientAccess, type ClientAccess } from './useClientAccess';
import { useOnCustomHost } from '@/lib/seentics-host';
import type { ClientBrand, FeatureId } from './types';

/**
 * Client mode for one website's dashboard: what the client may see and change there, the page's
 * feature, and the agency's brand. Provided by `app/websites/[websiteId]/layout.tsx`; outside it
 * (an account's pages, tests rendering a component alone) every hook here reads as "may edit".
 */

interface ClientModeValue {
  access: ClientAccess;
  websiteId: string;
  /** The open page's feature; `null` for an account-only page. */
  feature: FeatureId | null;
  /** A client on a page whose feature is `view`: nothing on it may be changed. */
  readOnly: boolean;
  brand: ClientBrand | null;
}

const ClientModeContext = createContext<ClientModeValue | null>(null);

export function ClientModeProvider({ websiteId, children }: { websiteId: string; children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const access = useClientAccess(websiteId);
  const feature = featureForPath(pathname, websiteId);
  const readOnly = access.isClient && !(feature && access.canEdit(feature));
  const brand = access.isClient ? access.me?.brand ?? null : null;
  // On an agency's own domain `CustomHostBrand` (root layout) already wears the brand everywhere.
  const customHost = useOnCustomHost();
  return (
    <ClientModeContext.Provider value={{ access, websiteId, feature, readOnly, brand }}>
      {brand && !customHost && <BrandEffects brand={brand} />}
      {children}
    </ClientModeContext.Provider>
  );
}

export const useClientMode = (): ClientModeValue | null => useContext(ClientModeContext);

/** Read-only page: a client on a page set to View. `usePermissions` folds this into `canEdit`. */
export const useReadOnly = (): boolean => useContext(ClientModeContext)?.readOnly ?? false;

/** Whether the person may change things of `feature` on this website (always, for an account). */
export function useCanEditFeature(feature: FeatureId): boolean {
  const ctx = useContext(ClientModeContext);
  return ctx ? ctx.access.canEdit(feature) : true;
}

/** Whether the person may see `feature` on this website (always, for an account). */
export function useCanSeeFeature(feature: FeatureId): boolean {
  const ctx = useContext(ClientModeContext);
  return ctx ? ctx.access.canSee(feature) : true;
}

/** The agency's brand while a client is signed in; `null` for an account or an unbranded agency. */
export const useClientBrand = (): ClientBrand | null => useContext(ClientModeContext)?.brand ?? null;

/**
 * Create, edit and delete controls of a feature a client may only view: hidden (the default) or,
 * with `mode="disable"`, shown but disabled — a whole settings form inside a disabled fieldset.
 */
export function EditGuard({ feature, mode = 'hide', fallback = null, children }: {
  feature: FeatureId;
  mode?: 'hide' | 'disable';
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const allowed = useCanEditFeature(feature);
  if (allowed) return <>{children}</>;
  if (mode === 'hide') return <>{fallback}</>;
  return (
    <fieldset disabled data-read-only="true" aria-disabled="true" className="m-0 min-w-0 border-0 p-0">
      {fallback}
      {children}
    </fieldset>
  );
}

/** A line above a read-only page's controls, so a disabled form explains itself. */
export function ReadOnlyNote({ feature, className }: { feature: FeatureId; className?: string }) {
  const allowed = useCanEditFeature(feature);
  if (allowed) return null;
  return (
    <p role="note" className={className ?? 'mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground'}>
      You can view this page. Ask your agency if you need to change anything here.
    </p>
  );
}

/**
 * The agency's look on the dashboard: its colour as `--primary`, its name as the tab title and its
 * logo as the favicon. Everything is put back when the client signs out (the provider unmounts).
 */
export function BrandEffects({ brand }: { brand: ClientBrand }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const vars = brandColorVars(brand.primary_color);
    const previous = Object.keys(vars).map(k => [k, root.style.getPropertyValue(k)] as const);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const [k, v] of previous) {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      }
    };
  }, [brand.primary_color]);

  useEffect(() => {
    if (!brand.brand_name) return;
    // Pages set their own titles as they load; the brand replaces ours on every one.
    const t = setTimeout(() => {
      const next = document.title.replace(/seentics/gi, brand.brand_name);
      document.title = next.includes(brand.brand_name) ? next : brand.brand_name;
    }, 0);
    return () => clearTimeout(t);
  }, [brand.brand_name, pathname]);

  useEffect(() => {
    const logo = brandLogo(brand);
    if (!logo) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = logo;
    link.dataset.brand = 'true';
    const others = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]:not([data-brand])'));
    others.forEach(l => l.setAttribute('data-brand-hidden', l.rel));
    others.forEach(l => (l.rel = 'brand-hidden-icon'));
    document.head.appendChild(link);
    return () => {
      link.remove();
      others.forEach(l => (l.rel = l.getAttribute('data-brand-hidden') || 'icon'));
    };
  }, [brand]);

  return null;
}
