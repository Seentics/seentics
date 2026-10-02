import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Notice' },
  { href: '/dpa', label: 'Data Processing Agreement' },
  { href: '/subprocessors', label: 'Subprocessors' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/refund-policy', label: 'Refund Policy' },
];

/**
 * The frame every legal page shares: a title, the date the text last changed — a fixed
 * date, never today's, which a reader would take as a change that did not happen —
 * and the other legal pages one click away.
 */
export function LegalPage({
  title,
  intro,
  updated,
  current,
  children,
}: {
  title: string;
  intro: ReactNode;
  /** When the substance last changed, e.g. "1 October 2026". */
  updated: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Seentics
        </Link>
        <header className="mt-8 mb-10 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
          <div className="text-base text-muted-foreground leading-relaxed">{intro}</div>
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        </header>
        <article className="legal-prose space-y-10 text-[15px] leading-7 text-muted-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p+p]:mt-3 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:py-2 [&_th]:pr-4 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_tr]:border-b [&_tr]:border-border">
          {children}
        </article>
        <nav aria-label="Legal" className="mt-16 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? 'page' : undefined}
              className={link.href === current ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** A table that scrolls on its own at phone width rather than widening the page. */
export function LegalTable({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4"><table>{children}</table></div>;
}
