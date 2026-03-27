'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  BookOpen, Rocket, BarChart3, Workflow, Filter,
  Zap, Code2, CreditCard, ShieldCheck, KeyRound,
  LayoutDashboard, Building2, Users, Settings
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
      { title: 'Analytics', id: 'analytics', icon: BarChart3 },
      { title: 'Funnels', id: 'funnels', icon: Filter },
      { title: 'Automations', id: 'automations', icon: Workflow },
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
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(id);
        },
        { rootMargin: '-20% 0px -70% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <LandingHeader />
      <div className="flex flex-1 pt-16 sm:pt-20">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card/30 backdrop-blur-md hidden md:flex flex-col fixed top-16 sm:top-20 bottom-0 left-0 z-40 overflow-hidden">
          <nav className="flex-1 overflow-y-auto p-4 space-y-8">
            {sidebarGroups.map(group => (
              <div key={group.title} className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-3 mb-2">
                  {group.title}
                </h4>
                {group.items.map(item => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all duration-200 group',
                      activeId === item.id
                        ? 'bg-primary/10 text-primary font-bold shadow-sm'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn(
                      'w-4 h-4 transition-colors',
                      activeId === item.id ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                    )} />
                    {item.title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 relative min-h-screen">
          <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 md:py-16">
            {children}
          </div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -mr-48 -mt-48 pointer-events-none" />
        </main>
      </div>
    </div>
  );
}
