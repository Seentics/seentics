'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Paintbrush,
  KeyRound,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',        href: '/agency',                  icon: LayoutDashboard },
  { label: 'Clients',         href: '/agency/clients',          icon: Users },
  { label: 'Client Accounts', href: '/agency/client-users',     icon: UserCheck },
  { label: 'White Label',     href: '/agency/white-label',      icon: Paintbrush },
  { label: 'API Keys',        href: '/agency/api-keys',         icon: KeyRound },
];

function isActive(href: string, pathname: string): boolean {
  if (href === '/agency') return pathname === '/agency';
  return pathname.startsWith(href);
}

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isEnterprise) {
      router.push('/websites');
    }
  }, [router]);

  if (!isEnterprise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Redirecting…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="flex flex-col h-screen w-[220px] shrink-0 bg-card border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between h-[60px] px-4 shrink-0 border-b border-border">
          <span className="text-[15px] font-bold text-foreground tracking-tight">Agency</span>
          <Link
            href="/websites"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Back to websites"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 h-9 px-3 rounded-md transition-colors text-[13px] font-medium',
                      active
                        ? 'bg-primary/10 text-primary dark:bg-accent dark:text-foreground'
                        : 'text-foreground/60 hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto h-screen">
        {children}
      </main>
    </div>
  );
}
