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
  ChevronRight,
  PanelLeft,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
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
        { label: 'Overview',  href: `/websites/${websiteId}`,          icon: BarChart3 },
        { label: 'Realtime',  href: `/websites/${websiteId}/realtime`,  icon: Activity },
        { label: 'Goals',     href: `/websites/${websiteId}/goals`,     icon: Target },
        { label: 'Funnels',   href: `/websites/${websiteId}/funnels`,   icon: GitBranch },
        { label: 'Events',    href: `/websites/${websiteId}/events`,    icon: Zap },
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
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      defaultOpen: false,
      items: [
        { label: 'General',  href: `/websites/${websiteId}/settings`,         icon: Settings },
        { label: 'Goals',    href: `/websites/${websiteId}/settings/goals`,    icon: Target },
        { label: 'Team',     href: `/websites/${websiteId}/settings/team`,     icon: Activity },
        { label: 'Privacy',  href: `/websites/${websiteId}/settings/privacy`,  icon: AlertTriangle },
        { label: 'Tracking', href: `/websites/${websiteId}/settings/tracking`, icon: BarChart3 },
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

  // Auto-open the group containing the active route
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
        'flex flex-col h-screen sticky top-0 border-r border-border/60 bg-card/50 transition-all duration-200 shrink-0',
        collapsed ? 'w-[52px]' : 'w-[220px]',
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 py-3 border-b border-border/40">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <PanelLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {groups.map(group => (
          <div key={group.id}>
            {/* Group header */}
            <button
              onClick={() => !collapsed && toggleGroup(group.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
                collapsed && 'justify-center',
              )}
              title={collapsed ? group.label : undefined}
            >
              <group.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{group.label}</span>
                  {openGroups[group.id]
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                </>
              )}
            </button>

            {/* Group items */}
            {(openGroups[group.id] || collapsed) && (
              <div className={cn('space-y-0.5', !collapsed && 'pl-2 mt-0.5')}>
                {group.items.map(item => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                        collapsed && 'justify-center',
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function isActive(href: string, pathname: string): boolean {
  // Exact match for the root analytics page to avoid matching everything
  if (href.match(/\/websites\/[^/]+$/)) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
