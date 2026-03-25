'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Activity,
  Target,
  GitBranch,
  Zap,
  Flame,
  Video,
  Route,
  Bot,
  FileText,
  AlertTriangle,
  Network,
  Gauge,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Code2,
  LayoutDashboard,
} from 'lucide-react';

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
  badge?: string;
}

interface NavGroup {
  id:          string;
  label:       string;
  icon:        React.ElementType;
  items:       NavItem[];
  defaultOpen?: boolean;
}

function buildGroups(websiteId: string): NavGroup[] {
  return [
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      defaultOpen: true,
      items: [
        { label: 'Overview',  href: `/websites/${websiteId}`,         icon: LayoutDashboard },
        { label: 'Realtime',  href: `/websites/${websiteId}/realtime`, icon: Activity },
        { label: 'Goals',     href: `/websites/${websiteId}/goals`,    icon: Target },
        { label: 'Funnels',   href: `/websites/${websiteId}/funnels`,  icon: GitBranch },
        { label: 'Events',    href: `/websites/${websiteId}/events`,   icon: Zap },
      ],
    },
    {
      id: 'behavior',
      label: 'Behavior',
      icon: Flame,
      defaultOpen: false,
      items: [
        { label: 'Heatmaps',    href: `/websites/${websiteId}/heatmaps`,    icon: Flame },
        { label: 'Replays',     href: `/websites/${websiteId}/replays`,     icon: Video },
        { label: 'Paths',       href: `/websites/${websiteId}/paths`,       icon: Route },
        { label: 'Automations', href: `/websites/${websiteId}/automations`, icon: Bot },
      ],
    },
    {
      id: 'observability',
      label: 'Observability',
      icon: Network,
      defaultOpen: false,
      items: [
        { label: 'Logs',    href: `/websites/${websiteId}/observability/logs`,    icon: FileText },
        { label: 'Errors',  href: `/websites/${websiteId}/observability/errors`,  icon: AlertTriangle },
        { label: 'Traces',  href: `/websites/${websiteId}/observability/traces`,  icon: Network },
        { label: 'Metrics', href: `/websites/${websiteId}/observability/metrics`, icon: Gauge },
      ],
    },
    {
      id: 'developers',
      label: 'Developers',
      icon: Code2,
      defaultOpen: false,
      items: [
        { label: 'Documentation', href: `/websites/${websiteId}/docs`, icon: BookOpen },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      defaultOpen: false,
      items: [
        { label: 'General',  href: `/websites/${websiteId}/settings`,          icon: Settings },
        { label: 'Goals',    href: `/websites/${websiteId}/settings/goals`,     icon: Target },
        { label: 'Team',     href: `/websites/${websiteId}/settings/team`,      icon: Activity },
        { label: 'Privacy',  href: `/websites/${websiteId}/settings/privacy`,   icon: AlertTriangle },
        { label: 'Tracking', href: `/websites/${websiteId}/settings/tracking`,  icon: BarChart3 },
      ],
    },
  ];
}

interface SidebarProps {
  websiteId: string;
}

export function Sidebar({ websiteId }: SidebarProps) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const groups = buildGroups(websiteId);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    groups.forEach(g => { defaults[g.id] = g.defaultOpen ?? false; });
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sidebar-groups');
        if (stored) return { ...defaults, ...JSON.parse(stored) };
      } catch { /* ignore */ }
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('sidebar-groups', JSON.stringify(openGroups));
  }, [openGroups]);

  // Auto-open the group that contains the active route
  useEffect(() => {
    groups.forEach(group => {
      if (group.items.some(item => isActive(item.href, pathname))) {
        setOpenGroups(prev => ({ ...prev, [group.id]: true }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside
      className={cn(
        'flex flex-col h-screen border-r border-border/50 bg-card transition-all duration-200 shrink-0 overflow-hidden',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center border-b border-border/50 shrink-0',
        collapsed ? 'h-14 justify-center px-0' : 'h-14 gap-3 px-4',
      )}>
        {/* Icon mark */}
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <BarChart3 className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground leading-tight tracking-tight">Seentics</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Analytics & Observability</span>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {groups.map(group => (
          <div key={group.id} className="mb-1">
            {/* Group header */}
            <button
              onClick={() => !collapsed && toggleGroup(group.id)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? group.label : undefined}
            >
              <group.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left tracking-wide uppercase text-[10px]">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-150',
                      openGroups[group.id] && 'rotate-180',
                    )}
                  />
                </>
              )}
            </button>

            {/* Group items */}
            {(openGroups[group.id] || collapsed) && (
              <div className={cn('mt-0.5 space-y-0.5', !collapsed && 'pl-1')}>
                {group.items.map(item => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        collapsed && 'justify-center px-0 py-2.5',
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )}
                    >
                      <item.icon className={cn('shrink-0', collapsed ? 'h-4.5 w-4.5' : 'h-4 w-4')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-semibold bg-primary/15 text-primary rounded-full px-1.5 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle ───────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border/50 p-2">
        <button
          onClick={() => setCollapsed(c => !c)}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen  className="h-4 w-4 shrink-0" />
            : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function isActive(href: string, pathname: string): boolean {
  // Exact match for the root analytics overview page
  if (href.match(/\/websites\/[^/]+$/)) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
