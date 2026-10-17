'use client';

import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BarChart3, Code2, Globe, LayoutDashboard, Menu, Palette, Users } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { dashboardHref, useHomeWebsite } from './use-home-website';

interface Item {
  label: string;
  href: string;
  icon: ElementType;
}

export const AGENCY_NAV: Item[] = [
  { label: 'Overview', href: '/agency', icon: LayoutDashboard },
  { label: 'Clients', href: '/agency/clients', icon: Users },
  { label: 'Websites', href: '/agency/websites', icon: Globe },
  { label: 'Branding', href: '/agency/branding', icon: Palette },
  { label: 'Usage', href: '/agency/usage', icon: BarChart3 },
  { label: 'API', href: '/agency/api', icon: Code2 },
];

export function isAgencyNavActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  if (href === '/agency') return path === '/agency';
  return path === href || path.startsWith(`${href}/`);
}

/** The workspace's navigation: the dashboard sidebar's look, with the agency's pages. */
export function AgencySidebar() {
  const pathname = usePathname() ?? '';
  const home = useHomeWebsite();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const panel = (inDrawer: boolean) => (
    <aside
      aria-label="Agency"
      className={cn('flex-col shrink-0 overflow-hidden bg-sidebar select-none', inDrawer ? 'flex h-full w-full' : 'hidden h-screen w-[216px] md:flex')}
    >
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-4">
        <Link href="/agency" className="flex min-w-0 items-center gap-2.5">
          <Logo size="sm" className="shrink-0" />
          <span className="text-[16px] font-bold tracking-tight text-foreground">Seentics</span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-primary">Agency</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {AGENCY_NAV.map(item => {
            const active = isAgencyNavActive(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-3 rounded-lg px-3 transition-colors',
                    active
                      ? 'bg-card text-foreground shadow-[0_0_0_1px_rgb(15_15_20/0.07),0_1px_2px_rgb(15_15_20/0.06)] dark:bg-accent dark:shadow-none'
                      : 'text-foreground/60 hover:bg-black/[0.045] hover:text-foreground dark:hover:bg-muted/50',
                  )}
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" />
                  <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-3 pb-6 pt-3 dark:border-border/60">
        <Link
          href={dashboardHref(home)}
          className="flex h-9 items-center gap-3 rounded-lg px-3 text-foreground/60 transition-colors hover:bg-black/[0.045] hover:text-foreground dark:hover:bg-muted/50"
        >
          <ArrowLeft className="h-[17px] w-[17px] shrink-0" />
          <span className="text-[13.5px] font-medium">Back to dashboard</span>
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 md:hidden dark:border-border/40">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/agency" className="flex items-center gap-2">
          <Logo size="sm" className="shrink-0" />
          <span className="text-[16px] font-bold tracking-tight text-foreground">Agency</span>
        </Link>
      </div>
      {panel(false)}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[264px] max-w-[85vw] border-sidebar-border bg-sidebar p-0 md:hidden">
          <SheetTitle className="sr-only">Agency navigation</SheetTitle>
          {panel(true)}
        </SheetContent>
      </Sheet>
    </>
  );
}
