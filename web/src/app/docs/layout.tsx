'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  BookOpen, Rocket, BarChart3, Workflow, Filter,
  Zap, Code2, CreditCard, ShieldCheck, KeyRound,
  LayoutDashboard, Building2, Users, Settings,
  Video, Flame
} from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';

const sidebarGroups = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', id: 'introduction', icon: BookOpen },
      { title: 'Quick Start', id: 'quick-start', icon: Rocket },
    ],
  },
  {
    title: 'Core Features',
    items: [
      { title: 'Analytics',        id: 'analytics',        icon: BarChart3 },
      { title: 'Session Replays',  id: 'session-replays',  icon: Video },
      { title: 'Heatmaps',         id: 'heatmaps',         icon: Flame },
      { title: 'Funnels',          id: 'funnels',          icon: Filter },
      { title: 'Automations',      id: 'automations',      icon: Workflow },
    ],
  },
  {
    title: 'Integration',
    items: [
      { title: 'Tracker Script', id: 'tracker', icon: Zap },
      { title: 'API Reference', id: 'api-reference', icon: Code2 },
      { title: 'API Keys', id: 'api-keys', icon: KeyRound },
      { title: 'UI Blocks', id: 'ui-blocks', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Agency',
    items: [
      { title: 'Agency Overview', id: 'agency-overview', icon: Building2 },
      { title: 'Client Management', id: 'client-management', icon: Users },
      { title: 'Programmatic API', id: 'agency-api', icon: Code2 },
      { title: 'White Label', id: 'white-label', icon: Settings },
    ],
  },
  {
    title: 'Platform',
    items: [
      { title: 'Billing & Plans', id: 'billing', icon: CreditCard },
      { title: 'Privacy & Security', id: 'privacy', icon: ShieldCheck },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState('introduction');

  useEffect(() => {
    const allIds = sidebarGroups.flatMap(g => g.items.map(i => i.id));
    const observers: IntersectionObserver[] = [];

    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id); },
        { rootMargin: '-20% 0px -70% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <LandingHeader alwaysBordered />
      <div className="flex flex-1 pt-16 sm:pt-20">

        {/* Sidebar — no hard border, uses soft shadow line */}
        <aside className="w-60 hidden md:flex flex-col fixed top-16 sm:top-20 bottom-0 left-0 z-40 overflow-hidden"
          style={{ boxShadow: '1px 0 0 0 hsl(var(--border) / 0.3)' }}>
          <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-5">
            {sidebarGroups.map(group => (
              <div key={group.title}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-3 mb-2">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setActiveId(item.id)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                        activeId === item.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <item.icon className={cn(
                        'w-3.5 h-3.5 shrink-0',
                        activeId === item.id ? 'text-primary' : 'text-muted-foreground/60'
                      )} />
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-60 relative min-h-screen">
          <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 md:py-16">
            {children}
          </div>
          <div className="pointer-events-none absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[160px] rounded-lg-full -mr-64 -mt-64" />
        </main>

      </div>
    </div>
  );
}
