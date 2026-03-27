'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Activity, Target, GitBranch,
  Flame, Video, Bot, Code2, Settings,
  LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { Logo } from '../ui/logo';

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
}

function buildMainNav(websiteId: string): NavItem[] {
  return [
    { label: 'Overview',        href: `/websites/${websiteId}`,             icon: LayoutDashboard },
    { label: 'Realtime',        href: `/websites/${websiteId}/realtime`,    icon: Activity },
    { label: 'Goals',           href: `/websites/${websiteId}/goals`,       icon: Target },
    { label: 'Funnels',         href: `/websites/${websiteId}/funnels`,     icon: GitBranch },
    { label: 'Heatmaps',        href: `/websites/${websiteId}/heatmaps`,    icon: Flame },
    { label: 'Session Replays', href: `/websites/${websiteId}/replays`,     icon: Video },
    { label: 'Automations',     href: `/websites/${websiteId}/automations`, icon: Bot },
  ];
}

function buildSecondaryNav(websiteId: string): NavItem[] {
  return [
    { label: 'Developers', href: `/websites/${websiteId}/developers`, icon: Code2 },
    { label: 'Settings',   href: `/websites/${websiteId}/settings`,   icon: Settings },
  ];
}

function isActive(href: string, pathname: string): boolean {
  if (href.match(/\/websites\/[^/]+$/)) return pathname === href;
  return pathname.startsWith(href);
}

export function Sidebar({ websiteId }: { websiteId: string }) {
  const pathname  = usePathname();
  const mainNav   = buildMainNav(websiteId);
  const secondNav = buildSecondaryNav(websiteId);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const persist = (v: boolean) => {
    setCollapsed(v);
    localStorage.setItem('sidebar-collapsed', String(v));
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href, pathname);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md transition-colors',
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
      'bg-card',
      'transition-[width] duration-200 ease-in-out',
      collapsed ? 'w-[64px]' : 'w-[248px]',
    )}>

      {/* Header: Logo + collapse toggle */}
      <div className={cn(
        'flex items-center h-[60px] shrink-0 gap-2',
        collapsed ? 'justify-center px-2' : 'px-4',
      )}>
        <Logo size="sm" className="shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-[16px] font-bold text-primary tracking-tight">
              Seentics
            </span>
            <button
              onClick={() => persist(true)}
              title="Collapse sidebar"
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
        {collapsed && (
          <button
            onClick={() => persist(false)}
            title="Expand sidebar"
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 py-2', collapsed ? 'px-2' : 'px-3')}>
        <ul className="space-y-0.5">
          {mainNav.map(renderItem)}
        </ul>

        <div className="my-2 mx-3 h-px bg-border/50" />

        <ul className="space-y-0.5">
          {secondNav.map(renderItem)}
        </ul>
      </nav>

      {/* Log out */}
      <div className={cn('shrink-0 pb-3', collapsed ? 'px-2' : 'px-3')}>
        <button
          className={cn(
            'flex items-center gap-3 rounded-md transition-colors w-full',
            'text-foreground/45 hover:text-foreground hover:bg-muted/50',
            collapsed ? 'justify-center h-10 w-10 mx-auto' : 'h-10 px-3',
          )}
          title="Log out"
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" />
          {!collapsed && <span className="text-[13.5px] font-medium">Log out</span>}
        </button>
      </div>
    </aside>
  );
}
