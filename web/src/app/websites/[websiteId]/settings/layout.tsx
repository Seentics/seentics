'use client';

import React from 'react';
import { useAuth } from '@/stores/useAuthStore';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePathSegment, useIsPathOverridden } from '@/lib/path-segment';
import { useEffect, useMemo } from 'react';
import { ArrowLeft, CreditCard, Shield, Users, LifeBuoy, LayoutGrid, User, Loader2, Layers, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { isEnterprise } from '@/lib/features';
import { isDemo } from '@/lib/demo';
import { useSubscription } from '@/hooks/useSubscription';
import { PAGE_MENU_LABEL, pageMenuItem } from '@/components/ui/page-menu';
import { Target } from 'lucide-react';
import { useClientMode } from '@/features/client-mode/ClientMode';
import { useT } from '@/lib/i18n';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // usePathSegment, not useParams — see src/lib/path-segment.ts. On the static shell
  // useParams is the build-time placeholder, so every settings tab linked to a
  // website that does not exist.
  const segment = usePathSegment(1);
  // A section heading inside the landing page's preview, which has its own h1.
  const SettingsHeading = useIsPathOverridden() ? 'h2' : 'h1';
  const websiteId = segment ?? '';
  const { user, isLoading } = useAuth();
  const { subscription } = useSubscription();
  // Client mode: a client's settings are Goals and Privacy, each only when the agency allows it.
  const clientMode = useClientMode();
  const client = clientMode?.access.isClient ? clientMode.access : null;
  const showBilling = !client && (isEnterprise || isDemo(websiteId));
  const t = useT().settings.layout;

  // Grouped by what the customer is doing, not by how the app is built: their websites, their account,
  // and getting help. The hint shows on hover.
  const groups = useMemo(
    () => [
      {
        label: t.groups.websites,
        items: [
          { href: `/websites/${websiteId}/settings/websites`, ...t.items.websites, icon: LayoutGrid },
          { href: `/websites/${websiteId}/settings/features`, ...t.items.tracking, icon: Layers },
          { href: `/websites/${websiteId}/settings/privacy`, ...t.items.privacy, icon: Shield },
          { href: `/websites/${websiteId}/settings/alerts`, ...t.items.alerts, icon: BellRing },
        ],
      },
      {
        label: t.groups.account,
        items: [
          { href: `/websites/${websiteId}/settings/billing`, ...t.items.billing, icon: CreditCard, enterpriseOrDemoBilling: true },
          { href: `/websites/${websiteId}/settings/profile`, ...t.items.profile, icon: User },
          { href: `/websites/${websiteId}/settings/team`, ...t.items.team, icon: Users, enterpriseOnly: true },
        ],
      },
      {
        label: t.groups.help,
        items: [{ href: `/websites/${websiteId}/settings/support`, ...t.items.support, icon: LifeBuoy }],
      },
    ],
    [websiteId, t],
  );

  const visibleGroups = useMemo(
    () => client ? [{
      label: t.groups.website,
      items: [
        ...(client.canSee('goals') ? [{ href: `/websites/${websiteId}/settings/goals`, ...t.items.goals, icon: Target }] : []),
        ...(client.canSee('privacy') ? [{ href: `/websites/${websiteId}/settings/privacy`, ...t.items.clientPrivacy, icon: Shield }] : []),
      ],
    }].filter((group) => group.items.length > 0) :
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
    [groups, websiteId, client, t],
  );

  const demo = isDemo(websiteId);

  useEffect(() => {
    // The demo website is open to anyone: there is no account to sign in to.
    // `segment` is null for the first render, before the URL is read: until then we cannot
    // tell the demo site from a real one, so do not send anyone to sign in yet.
    if (segment !== null && !demo && !isLoading && !user) {
      router.push('/signin');
    }
  }, [segment, demo, user, isLoading, router]);

  if (isLoading && !demo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !demo) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <div className={cn(websiteWorkspaceShellClass, 'pb-12')}>
        <Link
          href={`/websites/${websiteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToAnalytics}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <SettingsHeading className="text-xl font-semibold tracking-tight">{t.title}</SettingsHeading>
          {showBilling && (
            // Always in view, on every settings page: the plan, and the way to change it or see invoices.
            <Link
              href={`/websites/${websiteId}/settings/billing`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {t.yourPlan} <span className="font-medium text-foreground">{subscription?.plan || t.free}</span>
              </span>
              <span className="text-primary">{t.managePlan}</span>
            </Link>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-8">
          {/* Sections: a list down the side on a wide screen, a row to scroll on a narrow one. */}
          <nav
            aria-label={t.sectionsLabel}
            // The panel look is only for the side-by-side layout; on a narrow screen the
            // sections are a plain row to scroll. Written out because Tailwind cannot see
            // class names assembled at runtime.
            className="lg:sticky lg:top-6 lg:w-44 lg:shrink-0 lg:self-start lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-1.5"
          >
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
              {visibleGroups.map((group, gi) => (
                <div
                  key={group.label}
                  className={cn('flex gap-1 lg:flex-col lg:gap-px', gi > 0 && 'lg:mt-1 lg:border-t lg:border-border lg:pt-1')}
                >
                  <p className={cn(PAGE_MENU_LABEL, 'hidden lg:block')}>{group.label}</p>
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={item.hint}
                        className={pageMenuItem(active)}
                      >
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="whitespace-nowrap">{item.label}</span>
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
