import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

/**
 * The frame every auth page sits in.
 *
 * There were three of these before — signin/signup shared a two-column layout with a
 * muted marketing panel, while forgot-password and reset-password had their own
 * two-column layout built on hardcoded `slate-*` colours, blurred background blobs and
 * a row of invented customer logos. Four pages, three designs, none of them reading
 * from the app's tokens consistently.
 *
 * Single column, and deliberately narrow. An auth page has one job and the visitor has
 * already decided to do it; a marketing panel beside the form is competing with the
 * thing it is meant to support, and on the sign-in page especially the visitor is a
 * returning customer who needs no pitch at all.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  legal = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** The one link out — "already have an account?", "back to sign in". */
  footer?: ReactNode;
  /**
   * Show the Terms/Privacy line. Off by default: it belongs where an account is
   * being created or a session started, not on the password-reset pages, where
   * "by continuing you agree to our Terms" is asking consent for nothing.
   */
  legal?: boolean;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-muted/30 px-4 py-10 dark:bg-background">
      {/* A single soft wash so the card has something to sit on. No blobs: two
          animated `blur-[120px]` circles cost a permanent compositing layer to say
          nothing a flat tint doesn't. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/[0.06] to-transparent"
      />

      {/* One step up from 420px, not three. 540 was too wide — a four-field form in a
          460px content column starts looking like a settings panel rather than a
          sign-in box. 464 keeps the inputs a comfortable length. */}
      <div className="relative w-full max-w-[420px] sm:max-w-[464px]">
        <Link
          href="/"
          className="mb-7 flex items-center justify-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <Logo size="md" />
          <span className="text-lg font-bold tracking-tight text-foreground">Seentics</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 dark:shadow-none">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}

        {legal && (
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground/80">
            By continuing you agree to our{' '}
            <Link href="/terms" className="underline decoration-border underline-offset-2 hover:text-foreground">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline decoration-border underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
