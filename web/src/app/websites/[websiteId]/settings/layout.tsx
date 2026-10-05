'use client';

import React from 'react';
import { useAuth } from '@/stores/useAuthStore';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePathSegment } from '@/lib/path-segment';
import { useEffect, useMemo } from 'react';
import { ArrowLeft, CreditCard, Shield, Users, LifeBuoy, LayoutGrid, User, Loader2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { isEnterprise } from '@/lib/features';
import { isDemo } from '@/lib/demo';
import { useSubscription } from '@/hooks/useSubscription';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // usePathSegment, not useParams — see src/lib/path-segment.ts. On the static shell
  // useParams is the build-time placeholder, so every settings tab linked to a
  // website that does not exist.
  const websiteId = usePathSegment(1) ?? '';
  const { user, isLoading } = useAuth();
  const { subscription } = useSubscription();
  const showBilling = isEnterprise || isDemo(websiteId);

  // Grouped by what the customer is doing, not by how the app is built: their websites, their account,
  // and getting help. The hint shows on hover.
  const groups = useMemo(
    () => [
      {
        label: 'Your websites',
        items: [
          { href: `/websites/${websiteId}/settings/websites`, label: 'Websites', hint: 'Add a site, copy its tracking code', icon: LayoutGrid },
          { href: `/websites/${websiteId}/settings/features`, label: 'Tracking', hint: 'Heatmaps, recordings, funnels', icon: Layers },
          { href: `/websites/${websiteId}/settings/privacy`, label: 'Privacy', hint: 'What visitor data you collect', icon: Shield },
        ],
      },
      {
        label: 'Your account',
        items: [
          { href: `/websites/${websiteId}/settings/billing`, label: 'Billing', hint: 'Your plan, usage and invoices', icon: CreditCard, enterpriseOrDemoBilling: true },
          { href: `/websites/${websiteId}/settings/profile`, label: 'Profile', hint: 'Name, email and password', icon: User },
          { href: `/websites/${websiteId}/settings/team`, label: 'Team', hint: 'Invite people and set their access', icon: Users, enterpriseOnly: true },
        ],
      },
      {
        label: 'Help',
        items: [{ href: `/websites/${websiteId}/settings/support`, label: 'Support', hint: 'Ask us a question', icon: LifeBuoy }],
      },
    ],
    [websiteId],
  );

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if ('enterpriseOrDemoBilling' in item && item.enterpriseOrDemoBilling) return isEnterprise || isDemo(websiteId);
            if ('enterpriseOnly' in item && item.enterpriseOnly) return isEnterprise;
            return true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [groups, websiteId],
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
      <div className={cn(websiteWorkspaceShellClass, 'pb-12')}>
        <Link
          href={`/websites/${websiteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Analytics
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          {showBilling && (
            // Always in view, on every settings page: the plan, and the way to change it or see invoices.
            <Link
              href={`/websites/${websiteId}/settings/billing`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                Your plan: <span className="font-medium text-foreground">{subscription?.plan || 'Free'}</span>
              </span>
              <span className="text-primary">Manage plan &amp; billing</span>
            </Link>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-8">
          {/* Sections: a list down the side on a wide screen, a row to scroll on a narrow one. */}
          <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:w-40 lg:shrink-0 lg:self-start">
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
              {visibleGroups.map((group) => (
                <div key={group.label} className="flex gap-1 lg:flex-col lg:gap-0.5">
                  <p className="hidden px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:block">{group.label}</p>
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={item.hint}
                        className={cn(
                          'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                        <span className="whitespace-nowrap font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
