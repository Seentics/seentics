'use client';

import React from 'react';
import { useAuth } from '@/stores/useAuthStore';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { ArrowLeft, CreditCard, Goal, Shield, Users, KeyRound, LifeBuoy, LayoutGrid, User, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { isEnterprise } from '@/lib/features';
import { isDemo } from '@/lib/demo';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const { user, isLoading } = useAuth();

  const links = useMemo(
    () => [
      { href: `/websites/${websiteId}/settings/websites`, label: 'Websites', icon: LayoutGrid },
      { href: `/websites/${websiteId}/settings/features`, label: 'Features', icon: Layers },
      { href: `/websites/${websiteId}/settings/profile`, label: 'Profile', icon: User },
      { href: `/websites/${websiteId}/settings/developers`, label: 'Developers', icon: KeyRound },
      { href: `/websites/${websiteId}/settings/goals`, label: 'Goals', icon: Goal },
      { href: `/websites/${websiteId}/settings/privacy`, label: 'Privacy', icon: Shield },
      { href: `/websites/${websiteId}/settings/team`, label: 'Team', icon: Users, enterpriseOnly: true },
      { href: `/websites/${websiteId}/settings/billing`, label: 'Billing', icon: CreditCard, enterpriseOrDemoBilling: true },
      { href: `/websites/${websiteId}/settings/support`, label: 'Support', icon: LifeBuoy },
    ],
    [websiteId],
  );

  const visibleLinks = useMemo(
    () =>
      links.filter((item) => {
        if ('enterpriseOrDemoBilling' in item && item.enterpriseOrDemoBilling) {
          return isEnterprise || isDemo(websiteId);
        }
        if ('enterpriseOnly' in item && item.enterpriseOnly) return isEnterprise;
        return true;
      }),
    [links, websiteId],
  );

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
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className={cn(websiteWorkspaceShellClass, 'flex flex-col gap-6 pb-10')}>
        <div className="flex flex-col gap-4">
          <Button asChild variant="outline" className="h-10 w-fit rounded-lg px-3 text-sm font-medium shrink-0">
            <Link href={`/websites/${websiteId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analytics
            </Link>
          </Button>

          <div className="border-b border-border/60">
            <nav
              className={cn(
                'flex flex-nowrap gap-0.5 overflow-x-auto pb-px -mb-px',
                '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
              )}
              aria-label="Settings sections"
            >
              {visibleLinks.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex shrink-0 items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors',
                      'border-b-2 -mb-px rounded-t-md',
                      active
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
