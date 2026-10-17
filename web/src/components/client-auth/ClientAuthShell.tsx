'use client';

import type { CSSProperties, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { brandColorVars, brandLogo } from '@/features/client-mode/brand';
import type { ClientBrand } from '@/features/client-mode/types';
import { useOnCustomHost } from '@/lib/seentics-host';

/**
 * The frame of the client sign-in pages: the auth app's single narrow column (auth/web
 * `AuthShell`), wearing the agency's brand — its logo or initial, its name and its colour as the
 * page's primary. With `hide_seentics`, no Seentics mark anywhere; without a brand, ours — except
 * on an agency's own domain, which never shows our mark (only "Powered by Seentics", as text).
 */
export function ClientAuthShell({ brand, title, subtitle, children, footer }: {
  brand: ClientBrand | null;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const logo = brandLogo(brand);
  const style = brandColorVars(brand?.primary_color) as CSSProperties;
  const customHost = useOnCustomHost();

  return (
    <main
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10"
      style={style}
      data-testid="client-auth-shell"
    >
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-[420px] sm:max-w-[464px]">
        <div className="mb-7 flex items-center justify-center gap-2.5" data-testid="client-auth-brand">
          {brand ? (
            logo ? (
              <img src={logo} alt="" className="h-7 w-7 rounded-md object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                {(brand.brand_name || '?').slice(0, 1).toUpperCase()}
              </span>
            )
          ) : customHost ? null : (
            <Logo size="md" />
          )}
          {(brand || !customHost) && (
            <span className="text-lg font-semibold tracking-tight text-foreground">{brand?.brand_name || 'Seentics'}</span>
          )}
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-[var(--panel-edge)] sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}

        {(brand?.footer_text || (brand && !brand.hide_seentics)) && (
          <div className="mt-6 space-y-1 text-center text-xs leading-relaxed text-muted-foreground/80">
            {brand.footer_text && <p>{brand.footer_text}</p>}
            {!brand.hide_seentics && <p data-testid="powered-by-seentics">Powered by Seentics</p>}
          </div>
        )}
      </div>
    </main>
  );
}

export function ClientAuthError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** A small spinner while the page works out which agency it is for. */
export function ClientAuthLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4" aria-busy="true">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </main>
  );
}
