'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Activity, GitBranch,
  Video, Flame, Bot, Settings,
  LogOut, PanelLeftClose,
  User, CreditCard, LifeBuoy, Banknote,
} from 'lucide-react';
import { Logo } from '../ui/logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/stores/useAuthStore';

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

function buildMainNav(websiteId: string): NavItem[] {
  return [
    { label: 'Overview',    href: `/websites/${websiteId}`,             icon: LayoutDashboard },
    { label: 'Automations', href: `/websites/${websiteId}/automations`, icon: Bot },
    { label: 'Realtime',    href: `/websites/${websiteId}/realtime`,    icon: Activity },
    { label: 'Recording',   href: `/websites/${websiteId}/replays`,     icon: Video },
    { label: 'Heatmaps',    href: `/websites/${websiteId}/heatmaps`,    icon: Flame },
    { label: 'Funnels',     href: `/websites/${websiteId}/funnels`,     icon: GitBranch },
    { label: 'Revenue',     href: `/websites/${websiteId}/revenue`,     icon: Banknote },
  ];
}

function buildSecondaryNav(websiteId: string): NavItem[] {
  return [
    { label: 'Settings', href: `/websites/${websiteId}/settings`, icon: Settings },
  ];
}

function isNavActive(href: string, pathname: string): boolean {
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

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const persist = (v: boolean) => {
    setCollapsed(v);
    localStorage.setItem('sidebar-collapsed', String(v));
  };

  const renderItem = (item: NavItem) => {
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
              ? 'bg-primary/10 text-primary dark:bg-accent dark:text-foreground'
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

  return (
    <aside className={cn(
      'flex flex-col h-screen shrink-0 overflow-hidden select-none',
      // bg-sidebar, not bg-card: the sidebar is app chrome and belongs on the
      // deepest layer. On bg-card it sat level with the panels it frames, which
      // collapsed sidebar, page and cards into one flat surface.
      'bg-sidebar border-r border-sidebar-border',
      'transition-[width] duration-200 ease-in-out',
      collapsed ? 'w-[64px]' : 'w-[248px]',
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
          <Link href="/" className="flex items-center gap-2.5 w-full">
            <Logo size="sm" className="shrink-0" />
            <span className="flex-1 text-[16px] font-bold tracking-tight text-primary">Seentics</span>
            <button
              type="button"
              onClick={() => persist(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 py-2', collapsed ? 'px-2' : 'px-3')}>
        <ul className="space-y-0.5">
          {mainNav.map(renderItem)}
          {secondNav.map(renderItem)}
        </ul>
      </nav>

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
            side="right"
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
}
