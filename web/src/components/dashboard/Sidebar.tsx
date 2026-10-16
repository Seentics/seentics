'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, GitBranch,
  Video, Flame, Bot, Settings,
  LogOut, PanelLeftClose, Menu,
  User, CreditCard, LifeBuoy, Banknote,
  Code2, Bug, Sparkles, Radio, ArrowUpRight,
} from 'lucide-react';
import { Logo } from '../ui/logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/stores/useAuthStore';
import { useEntitlements } from '@/features/suite/queries';
import { workspaceIncludes } from '@/features/suite/workspace';
import { config } from '@/lib/config';

interface SuiteNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Matches billing/entitlements.ts `Product*` constants in gateway. */
  product: string;
}

// Each app's console, not its root: observe.seentics.com/
// is a public landing page with a "Sign in" button, which read as being signed out.
// Every website is also an Observe project, so Observability opens this site's own.
function buildSuiteProducts(websiteId: string): SuiteNavItem[] {
  return [
    { label: 'Observability', href: `${config.observeUrl}/projects/${websiteId}`, icon: Radio, product: 'observe' },
  ];
}

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

function buildMainNav(websiteId: string): NavItem[] {
  return [
    // `?dashboard=1`: picking Overview means the dashboard, even where AI mode is the default.
    { label: 'Overview',    href: `/websites/${websiteId}?dashboard=1`, icon: LayoutDashboard },
    // What a visitor did, where they clicked and where they dropped out, then what to do
    // about it; errors last, beside the developer tools that follow.
    { label: 'Recording',   href: `/websites/${websiteId}/replays`,     icon: Video },
    { label: 'Heatmaps',    href: `/websites/${websiteId}/heatmaps`,    icon: Flame },
    { label: 'Funnels',     href: `/websites/${websiteId}/funnels`,     icon: GitBranch },
    { label: 'Automations', href: `/websites/${websiteId}/automations`, icon: Bot },
    { label: 'Revenue',     href: `/websites/${websiteId}/revenue`,     icon: Banknote },
    { label: 'AI Reports',  href: `/websites/${websiteId}/ai-reports`,  icon: Sparkles },
    { label: 'Errors',      href: `/websites/${websiteId}/errors`,      icon: Bug },
  ];
}

function buildSecondaryNav(websiteId: string): NavItem[] {
  return [
    // Account-wide, not this site's: clients, and the management and data APIs.
    { label: 'Developers', href: `/websites/${websiteId}/agency`, icon: Code2 },
    { label: 'Settings', href: `/websites/${websiteId}/settings`, icon: Settings },
  ];
}

function isNavActive(hrefWithQuery: string, pathname: string): boolean {
  const href = hrefWithQuery.split('?')[0];
  if (/^\/websites\/[^/]+$/.test(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ websiteId }: { websiteId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const mainNav = buildMainNav(websiteId);
  const secondNav = buildSecondaryNav(websiteId);
  const [accountOpen, setAccountOpen] = useState(false);
  const { data: entitlements } = useEntitlements();
  // Suite plans only, free included (features/suite/workspace.ts): a customer
  // who bought Analytics alone is not offered the other apps.
  const suiteNav = entitlements
    ? buildSuiteProducts(websiteId).filter((item) => workspaceIncludes(entitlements, item.product))
    : [];

  const initials = useMemo(() => {
    if (!user) return '?';
    const n = user.name?.trim();
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return n.slice(0, 2).toUpperCase();
    }
    const e = user.email?.trim();
    return e ? e[0]!.toUpperCase() : '?';
  }, [user]);

  const [collapsedPref, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const persist = (v: boolean) => {
    setCollapsed(v);
    localStorage.setItem('sidebar-collapsed', String(v));
  };

  // Phones get the same navigation as a drawer behind a top bar; it closes once a link
  // has taken them somewhere.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const renderItem = (item: NavItem, collapsed: boolean) => {
    const active = isNavActive(item.href, pathname);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg transition-colors',
            collapsed ? 'justify-center h-10 w-10 mx-auto' : 'h-10 px-3',
            active
              ? 'bg-accent text-foreground'
              : 'text-foreground/60 hover:text-foreground hover:bg-muted/50',
          )}
        >
          <item.icon className="h-[17px] w-[17px] shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
          )}
        </Link>
      </li>
    );
  };

  // Plain `<a>`, not `<Link>` — this crosses subdomains (uptime.seentics.com,
  // observe.seentics.com), so it's a real navigation, not client-side routing.
  // The shared Domain=.seentics.com session cookie (see Phase 1 SSO) means
  // the destination is already authenticated, no token-passing needed.
  const renderSuiteItem = (item: SuiteNavItem, collapsed: boolean) => (
    <li key={item.href}>
      <a
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg transition-colors',
          collapsed ? 'justify-center h-10 w-10 mx-auto' : 'h-10 px-3',
          'text-foreground/60 hover:text-foreground hover:bg-muted/50',
        )}
      >
        <item.icon className="h-[17px] w-[17px] shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
          </>
        )}
      </a>
    </li>
  );

  const panel = (collapsed: boolean, inDrawer: boolean) => (
    <aside className={cn(
      'flex-col shrink-0 overflow-hidden select-none',
      inDrawer ? 'flex h-full w-full' : 'hidden md:flex h-screen',
      // bg-sidebar, not bg-card: the sidebar is app chrome and belongs on the
      // deepest layer. On bg-card it sat level with the panels it frames, which
      // collapsed sidebar, page and cards into one flat surface.
      // No edge of its own on desktop: the page's frame draws the line between them.
      'bg-sidebar',
      'transition-[width] duration-200 ease-in-out',
      !inDrawer && (collapsed ? 'w-[64px]' : 'w-[216px]'),
    )}>

      {/* Header: expanded = logo + title + collapse; collapsed = single logo control to expand */}
      <div
        className={cn(
          'flex h-[60px] shrink-0 items-center gap-2',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => persist(false)}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Logo size="sm" className="shrink-0" />
          </button>
        ) : (
          <div className='flex items-center justify-between w-full'>
          <Link href="/" className="flex items-center gap-2.5 w-full">
            <Logo size="sm" className="shrink-0" />
            <span className="flex-1 text-[16px] font-bold tracking-tight text-foreground">Seentics</span>
          </Link>
            {!inDrawer && <button
              type="button"
              onClick={() => persist(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>}
           </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 py-2', collapsed ? 'px-2' : 'px-3')}>
        <ul className="space-y-0.5">
          {mainNav.map((item) => renderItem(item, collapsed))}
          {secondNav.map((item) => renderItem(item, collapsed))}
        </ul>
      </nav>

      {/* Workspace — the suite's other apps, each on its own subdomain.
          Rendered only when another app is offered (enterprise mode, a Suite
          plan or free), so OSS and Analytics-only accounts never see it. */}
      {suiteNav.length > 0 && (
        <div className={cn('shrink-0 border-t border-sidebar-border pt-3 pb-2 dark:border-border/60', collapsed ? 'px-2' : 'px-3')}>
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">Workspace</p>
          )}
          <ul className="space-y-0.5">
            {suiteNav.map((item) => renderSuiteItem(item, collapsed))}
          </ul>
        </div>
      )}

      {/* Account */}
      <div className={cn('shrink-0 pb-6 ', collapsed ? 'px-2' : 'px-3')}>
        <Popover open={accountOpen} onOpenChange={setAccountOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={user?.name || user?.email || 'Account'}
              aria-label="Account menu"
              className={cn(
                'flex items-center gap-3 rounded-lg transition-colors w-full',
                'text-foreground hover:bg-muted/50',
                collapsed ? 'justify-center h-10 w-10 mx-auto' : 'h-10 px-2',
              )}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border/60"
                />
              ) : (
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    'bg-primary/12 text-[11px] font-semibold text-primary ring-1 ring-border/40',
                  )}
                >
                  {initials}
                </div>
              )}
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-foreground/90">
                  {user?.name?.trim() || user?.email || 'Account'}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 border border-border bg-card p-0 shadow-md"
            side={inDrawer ? 'top' : 'right'}
            align="end"
            sideOffset={10}
            collisionPadding={12}
          >
            <div className="border-b border-border bg-muted/25 px-3 py-3">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name?.trim() || 'Account'}</p>
              {user?.email ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
              ) : null}
            </div>
            <nav className="flex flex-col p-1.5">
              <Link
                href={`/websites/${websiteId}/settings/profile`}
                onClick={() => setAccountOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-foreground/80 hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <User className="h-4 w-4 shrink-0 opacity-70" />
                Profile
              </Link>
              <Link
                href={`/websites/${websiteId}/settings/billing`}
                onClick={() => setAccountOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-foreground/80 hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <CreditCard className="h-4 w-4 shrink-0 opacity-70" />
                Billing
              </Link>
              <Link
                href={`/websites/${websiteId}/settings/support`}
                onClick={() => setAccountOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-foreground/80 hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <LifeBuoy className="h-4 w-4 shrink-0 opacity-70" />
                Support
              </Link>
            </nav>
            <Separator className="bg-border/60" />
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  logout();
                  router.push('/signin');
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-destructive/90 hover:bg-destructive/10 hover:text-destructive',
                )}
              >
                <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                Log out
              </button>
            </div>
          </PopoverContent>
        </Popover>
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
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" className="shrink-0" />
          <span className="text-[16px] font-bold tracking-tight text-foreground">Seentics</span>
        </Link>
      </div>
      {panel(collapsedPref, false)}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[264px] max-w-[85vw] border-sidebar-border bg-sidebar p-0 md:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {panel(false, true)}
        </SheetContent>
      </Sheet>
    </>
  );
}
