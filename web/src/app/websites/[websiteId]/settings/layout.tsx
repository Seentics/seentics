'use client';

import React from 'react';
import { useAuth } from '@/stores/useAuthStore';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowLeft, CreditCard, Goal, Settings, Shield, Users, Code2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { isEnterprise } from '@/lib/features';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const { user, isLoading } = useAuth();

  const links = [
    { href: `/websites/${websiteId}/settings`, label: 'Overview', icon: Settings },
    { href: `/websites/${websiteId}/settings/tracking`, label: 'Tracking', icon: Code2 },
    { href: `/websites/${websiteId}/settings/goals`, label: 'Goals', icon: Goal },
    { href: `/websites/${websiteId}/settings/privacy`, label: 'Privacy', icon: Shield },
    { href: `/websites/${websiteId}/settings/team`, label: 'Team', icon: Users, enterpriseOnly: true },
    { href: `/websites/${websiteId}/settings/billing`, label: 'Billing', icon: CreditCard, enterpriseOnly: true },
  ];

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/signin');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <div className={cn(websiteWorkspaceShellClass, 'flex gap-6')}>
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 rounded-2xl border border-border/60 bg-card p-4">
            <Button asChild variant="outline" className="mb-4 h-10 w-full justify-start gap-2 rounded-lg text-sm font-medium">
              <Link href={`/websites/${websiteId}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to Analytics
              </Link>
            </Button>

            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Settings
            </p>

            <nav className="space-y-1">
              {links
                .filter((item) => !item.enterpriseOnly || isEnterprise)
                .map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden">
            <Button asChild variant="outline" className="h-10 rounded-lg px-3 text-sm font-medium">
              <Link href={`/websites/${websiteId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Analytics
              </Link>
            </Button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
