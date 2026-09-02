'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import { DOCS_NAV, docsNeighbours } from '@/components/docs/nav';
import { cn } from '@/lib/utils';

/**
 * The docs shell.
 *
 * Three things changed. The sidebar linked only to `#hash` anchors on a single
 * index page, which left eleven route pages unreachable — and worse, from
 * `/docs/analytics` the "Analytics" link took you to `/docs#analytics`, a different
 * page with different text on the same topic. It now links to routes and marks the
 * active one from the pathname, so the scroll-spy `IntersectionObserver` that drove
 * the old highlight is gone with it.
 *
 * There was also no navigation at all below `md`: the sidebar was `hidden md:flex`
 * with nothing in its place, so on a phone the docs were fourteen pages with no way
 * between them. A disclosure at the top of the content handles that.
 *
 * And the main column floated a 600x600 `blur-[160px]` primary glow behind the text,
 * which is decoration a reference document does not need.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { prev, next } = docsNeighbours(pathname);

  const nav = (onNavigate?: () => void) => (
    <nav className="space-y-6">
      {DOCS_NAV.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <item.icon
                      className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground/60')}
                    />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader alwaysBordered />

      <div className="flex flex-1 pt-16 sm:pt-20">
        {/* Desktop sidebar. A real border, not a faked one via box-shadow. */}
        <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-border px-3 py-8 sm:top-20 lg:flex">
          {nav()}
        </aside>

        <main className="min-w-0 flex-1 lg:ml-64">
          {/* Mobile nav — the sidebar has no place to go below `lg`. */}
          <div className="border-b border-border lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              className="flex w-full items-center justify-between px-6 py-3.5 text-sm font-medium text-foreground"
            >
              <span className="flex items-center gap-2">
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                Documentation
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', mobileOpen && 'rotate-180')} />
            </button>
            {mobileOpen && (
              <div className="max-h-[60dvh] overflow-y-auto border-t border-border px-3 py-4">
                {nav(() => setMobileOpen(false))}
              </div>
            )}
          </div>

          <div className="mx-auto max-w-3xl px-6 py-10 md:px-10 md:py-14">
            {children}

            {/* Previous / next. Fourteen separate pages need a way through them
                that is not the sidebar. */}
            {(prev || next) && (
              <div className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
                {prev ? (
                  <Link
                    href={prev.href}
                    className="group flex flex-col gap-1 rounded-lg border border-border p-4 transition-colors hover:border-primary/40"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Previous
                    </span>
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link
                    href={next.href}
                    className="group flex flex-col items-end gap-1 rounded-lg border border-border p-4 text-right transition-colors hover:border-primary/40 sm:col-start-2"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Next
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {next.title}
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
