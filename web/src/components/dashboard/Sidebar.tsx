'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, GitBranch,
  Video, Flame, Bot, Settings,
  LogOut, PanelLeftClose, Menu,
  User, CreditCard, LifeBuoy, Banknote,
  Code2, Bug, Sparkles, ArrowUpRight, Contact, Send, SlidersHorizontal, Briefcase,
  ChevronRight, MoreHorizontal, Plug,
} from 'lucide-react';
import { Logo } from '../ui/logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/stores/useAuthStore';
import { useEntitlements } from '@/features/suite/queries';
import { workspaceIncludes } from '@/features/suite/workspace';
import { isEnterprise } from '@/lib/features';
import { useHiddenNav, visibleItems, type NavId } from '@/features/sidebar/nav-prefs';
import { arrangeNav } from '@/features/sidebar/profiles';
import { getWebsiteByAnyId } from '@/features/websites/api';
import { isWebsiteProfile, type WebsiteProfile } from '@/features/websites/types';
import { isDemo } from '@/lib/demo';
import { SidebarCustomizeDialog } from './SidebarCustomizeDialog';
import { useClientMode } from '@/features/client-mode/ClientMode';
import { brandLogo } from '@/features/client-mode/brand';
import { clientSettingsHref, firstAllowedPath, navAllowed } from '@/features/client-mode/routes';
import { clientSignInHref, useIsClientSession } from '@/features/client-mode/session';
import { useT } from '@/lib/i18n';
import type { DashboardMessages } from '@/lib/i18n/messages/dashboard-en';

interface SuiteNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Matches billing/entitlements.ts `Product*` constants in gateway. */
  product: string;
}

// The suite's other apps, each linking to its console. Observability is not offered for now: it
// keeps running for anyone already sending to it (observe.seentics.com), but the dashboard no
// longer points people at it. To bring it back, return
//   { label: 'Observability', href: `${config.observeUrl}/projects/${websiteId}`, icon: Radio, product: 'observe' }
// (each website is also an Observe project, so that opens this site's own).
function buildSuiteProducts(_websiteId: string): SuiteNavItem[] {
  return [];
}

interface NavItem {
  id:    NavId;
  label: string;
  href:  string;
  icon:  React.ElementType;
  /** What the page is for, in the customize dialog. */
  hint:  string;
}

type NavText = DashboardMessages['sidebar']['nav'];

function buildMainNav(websiteId: string, nav: NavText): NavItem[] {
  return [
    // `?dashboard=1`: picking Overview means the dashboard, even where AI mode is the default.
    { id: 'overview',    label: nav.overview.label,    href: `/websites/${websiteId}?dashboard=1`, icon: LayoutDashboard, hint: nav.overview.hint },
    // What a visitor did, where they clicked and where they dropped out, then what to do
    // about it; errors last, beside the developer tools that follow.
    { id: 'recording',   label: nav.recording.label,   href: `/websites/${websiteId}/replays`,     icon: Video,     hint: nav.recording.hint },
    { id: 'heatmaps',    label: nav.heatmaps.label,    href: `/websites/${websiteId}/heatmaps`,    icon: Flame,     hint: nav.heatmaps.hint },
    { id: 'funnels',     label: nav.funnels.label,     href: `/websites/${websiteId}/funnels`,     icon: GitBranch, hint: nav.funnels.hint },
    { id: 'automations', label: nav.automations.label, href: `/websites/${websiteId}/automations`, icon: Bot,       hint: nav.automations.hint },
    { id: 'leads',       label: nav.leads.label,       href: `/websites/${websiteId}/leads`,       icon: Contact,   hint: nav.leads.hint },
    { id: 'revenue',     label: nav.revenue.label,     href: `/websites/${websiteId}/revenue`,     icon: Banknote,  hint: nav.revenue.hint },
    // Where those sales and leads are sent: the ad platforms, from Seentics' servers.
    { id: 'conversions', label: nav.conversions.label, href: `/websites/${websiteId}/conversions`, icon: Send,      hint: nav.conversions.hint },
    // Where form submissions go: Zapier, Mailchimp and the rest.
    { id: 'integrations', label: nav.integrations.label, href: `/websites/${websiteId}/integrations`, icon: Plug,   hint: nav.integrations.hint },
    { id: 'ai-reports',  label: nav.aiReports.label,   href: `/websites/${websiteId}/ai-reports`,  icon: Sparkles,  hint: nav.aiReports.hint },
    { id: 'errors',      label: nav.errors.label,      href: `/websites/${websiteId}/errors`,      icon: Bug,       hint: nav.errors.hint },
  ];
}

function buildSecondaryNav(websiteId: string, nav: NavText): NavItem[] {
  return [
    { id: 'developers', label: nav.developers.label, href: `/websites/${websiteId}/developers`, icon: Code2, hint: nav.developers.hint },
    { id: 'settings', label: nav.settings.label, href: `/websites/${websiteId}/settings`, icon: Settings, hint: nav.settings.hint },
  ];
}

/**
 * Whether to offer the Agency workspace (`/agency`): on Cloud, only once the entitlements say
 * the account has the Agency plan (`core.agency_features`) — nothing while they load, so a
 * non-agency account never sees it flash. Self-hosted has no plans and gets everything.
 */
export function useHasAgencyWorkspace(): boolean {
  const { data: entitlements } = useEntitlements();
  // A client user works in their agency's dashboard, never in a workspace of their own.
  const client = useIsClientSession();
  if (client) return false;
  if (!isEnterprise) return true;
  return (entitlements?.products?.core?.limits?.agency_features ?? 0) > 0;
}

export const AGENCY_WORKSPACE_HREF = '/agency';

function isNavActive(hrefWithQuery: string, pathname: string): boolean {
  const href = hrefWithQuery.split('?')[0];
  if (/^\/websites\/[^/]+$/.test(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ websiteId }: { websiteId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  // Client mode: only the pages the agency allowed on this website, its brand in the header,
  // and nothing of the account's (Developers, billing, the Agency workspace, other apps).
  const clientMode = useClientMode();
  const client = clientMode?.access.isClient ? clientMode : null;
  const clientFeatures = client?.access.features;
  const brand = client?.brand ?? null;
  const brandMark = brandLogo(brand);
  const homeHref = client ? firstAllowedPath(websiteId, clientFeatures) ?? `/websites/${websiteId}` : '/';
  const t = useT().dashboard.sidebar;
  const mainNav = buildMainNav(websiteId, t.nav).filter((item) => !client || navAllowed(item.id, clientFeatures));
  const secondNav = buildSecondaryNav(websiteId, t.nav)
    .filter((item) => !client || navAllowed(item.id, clientFeatures))
    .map((item) => (client && item.id === 'settings' ? { ...item, href: clientSettingsHref(websiteId, clientFeatures), hint: t.clientSettingsHint } : item));
  const [accountOpen, setAccountOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [hidden, setHidden] = useHiddenNav(user?.id);
  const allNav = [...mainNav, ...secondNav];
  const activeId = allNav.find((item) => isNavActive(item.href, pathname))?.id ?? null;
  // The site's kind of business puts its pages first and the rest under More (features/sidebar/profiles.ts).
  // A client sees the agency's choice of pages in the usual order.
  const { data: website } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteByAnyId(websiteId),
    enabled: !client && Boolean(websiteId),
    staleTime: 60_000,
  });
  // The demo takes its profile from the link that opened it (`/websites/demo?profile=store`, a
  // landing page's Live Demo). Read once, when the dashboard opens: the sidebar stays mounted while
  // the visitor moves between its pages, so the choice lasts the visit. Opened any other way (the
  // homepage's demo link), it shows every page.
  const [demoProfile, setDemoProfile] = useState<WebsiteProfile | null>(null);
  useEffect(() => {
    if (!isDemo(websiteId)) return;
    const asked = new URLSearchParams(window.location.search).get('profile');
    setDemoProfile(isWebsiteProfile(asked) ? asked : null);
  }, [websiteId]);
  // The demo's profile comes only from the link that opened it.
  const profile = client ? null : isDemo(websiteId) ? demoProfile : (website?.profile ?? null);
  const { primary: primaryNav, more: moreNav } = arrangeNav(visibleItems(mainNav, client ? [] : hidden, activeId), profile);
  const shownSecond = visibleItems(secondNav, client ? [] : hidden, activeId);
  const moreHasActive = moreNav.some((item) => item.id === activeId);
  // Open unless this person folded it: every page stays in sight by default.
  const [moreOpenPref, setMoreOpenPref] = useState(() => {
    try { return localStorage.getItem('sidebar-more-open') !== 'false'; } catch { return true; }
  });
  // The page you are on is never folded away.
  const moreOpen = moreOpenPref || moreHasActive;
  const toggleMore = () => {
    const next = !moreOpen;
    setMoreOpenPref(next);
    try { localStorage.setItem('sidebar-more-open', String(next)); } catch { /* storage blocked */ }
  };
  const { data: entitlements } = useEntitlements();
  // Suite plans only, free included (features/suite/workspace.ts): a customer
  // who bought Analytics alone is not offered the other apps.
  const suiteNav = entitlements && !client
    ? buildSuiteProducts(websiteId).filter((item) => workspaceIncludes(entitlements, item.product))
    : [];
  const hasAgency = useHasAgencyWorkspace();

  const initials = useMemo(() => {
    if (!user) return '?';
    const n = user.name?.trim();
    if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return n.slice(0, 2).toUpperCase();
    }
    const e = user.email?.trim();
    return e ? e[0]!.toUpperCase() : '?';
  }, [user]);

  const [collapsedPref, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const persist = (v: boolean) => {
    setCollapsed(v);
    localStorage.setItem('sidebar-collapsed', String(v));
  };

  // Phones get the same navigation as a drawer behind a top bar; it closes once a link
  // has taken them somewhere.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [pathname]);

  // The agency's logo for a client (its initial on the brand colour when there is none), else ours.
  const renderMark = () =>
    brand ? (
      brandMark ? (
        <img src={brandMark} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
          {(brand.brand_name || '?').slice(0, 1).toUpperCase()}
        </span>
      )
    ) : (
      <Logo size="sm" className="shrink-0" />
    );

  const renderItem = (item: NavItem, collapsed: boolean) => {
    const active = isNavActive(item.href, pathname);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={collapsed ? item.label : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg transition-colors',
            collapsed ? 'justify-center h-9 w-10 mx-auto' : 'h-9 px-3',
            // A grey pill on the sidebar; in dark a white tint, since the sidebar is the cards' grey.
            active
              ? 'bg-muted text-foreground dark:bg-white/[0.08]'
              : 'text-foreground/60 hover:text-foreground hover:bg-black/[0.045] dark:hover:bg-white/[0.05]',
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

  // Plain `<a>`, not `<Link>` — this crosses subdomains (uptime.seentics.com,
  // observe.seentics.com), so it's a real navigation, not client-side routing.
  // The shared Domain=.seentics.com session cookie (see Phase 1 SSO) means
  // the destination is already authenticated, no token-passing needed.
  const renderSuiteItem = (item: SuiteNavItem, collapsed: boolean) => (
    <li key={item.href}>
      <a
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg transition-colors',
          collapsed ? 'justify-center h-9 w-10 mx-auto' : 'h-9 px-3',
          'text-foreground/60 hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/[0.05]',
        )}
      >
        <item.icon className="h-[17px] w-[17px] shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
          </>
        )}
      </a>
    </li>
  );

  const panel = (collapsed: boolean, inDrawer: boolean) => (
    <aside className={cn(
      'flex-col shrink-0 overflow-hidden select-none',
      inDrawer ? 'flex h-full w-full' : 'hidden md:flex h-screen',
      // bg-sidebar, not bg-card: the sidebar is app chrome and belongs on the
      // deepest layer. On bg-card it sat level with the panels it frames, which
      // collapsed sidebar, page and cards into one flat surface.
      // No edge of its own on desktop: the page's frame draws the line between them.
      'bg-sidebar',
      'transition-[width] duration-200 ease-in-out',
      !inDrawer && (collapsed ? 'w-[64px]' : 'w-[216px]'),
    )}>

      {/* Header: expanded = logo + title + collapse; collapsed = single logo control to expand */}
      <div
        className={cn(
          'flex h-[60px] shrink-0 items-center gap-2',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => persist(false)}
            title={t.expand}
            aria-label={t.expand}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 dark:hover:bg-white/[0.05] hover:text-foreground"
          >
            {renderMark()}
          </button>
        ) : (
          <div className='flex items-center justify-between w-full'>
          <Link href={homeHref} className="flex min-w-0 items-center gap-2.5 w-full">
            {renderMark()}
            <span className="flex-1 truncate text-[16px] font-bold tracking-tight text-foreground">{brand?.brand_name || 'Seentics'}</span>
          </Link>
            {!inDrawer && <button
              type="button"
              onClick={() => persist(true)}
              title={t.collapse}
              aria-label={t.collapse}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 dark:hover:bg-white/[0.05] hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>}
           </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 py-2', collapsed ? 'px-2' : 'px-3')}>
        <ul className="space-y-0.5">
          {primaryNav.map((item) => renderItem(item, collapsed))}
          {moreNav.length > 0 && (
            <li>
              <button
                type="button"
                onClick={toggleMore}
                aria-expanded={moreOpen}
                title={collapsed ? t.more : undefined}
                aria-label={collapsed ? t.more : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg text-foreground/50 transition-colors hover:bg-muted/50 dark:hover:bg-white/[0.05] hover:text-foreground',
                  collapsed ? 'mx-auto h-9 w-10 justify-center' : 'h-9 w-full px-3',
                )}
              >
                {collapsed ? <MoreHorizontal className="h-4 w-4 shrink-0" /> : (
                  <>
                    <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', moreOpen && 'rotate-90')} />
                    <span className="flex-1 text-left text-[13px] font-medium">{t.more}</span>
                    <span className="text-[11.5px] tabular-nums text-foreground/40">{moreNav.length}</span>
                  </>
                )}
              </button>
            </li>
          )}
          {moreOpen && moreNav.map((item) => renderItem(item, collapsed))}
          {shownSecond.map((item) => renderItem(item, collapsed))}
          {!client && <li>
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              title={collapsed ? (hidden.length ? `${t.customizeSidebar} · ${t.hiddenCount(hidden.length)}` : t.customizeSidebar) : undefined}
              aria-label={collapsed ? t.customizeSidebar : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg text-foreground/45 transition-colors hover:bg-muted/50 dark:hover:bg-white/[0.05] hover:text-foreground',
                collapsed ? 'mx-auto h-9 w-10 justify-center' : 'h-9 w-full px-3',
              )}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-[13px] font-medium">{t.customize}</span>
                  {hidden.length > 0 && <span className="text-[11.5px] tabular-nums text-foreground/40">{t.hiddenCount(hidden.length)}</span>}
                </>
              )}
            </button>
          </li>}
        </ul>
      </nav>

      {/* Workspace — the Agency workspace for Agency accounts, then the suite's other apps,
          each on its own subdomain. Rendered only when one of them is offered. */}
      {(suiteNav.length > 0 || hasAgency) && (
        <div className={cn('shrink-0 border-t border-sidebar-border pt-3 pb-2 dark:border-border/60', collapsed ? 'px-2' : 'px-3')}>
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">{t.workspace}</p>
          )}
          <ul className="space-y-0.5">
            {hasAgency && (
              <li>
                <Link
                  href={AGENCY_WORKSPACE_HREF}
                  title={collapsed ? t.agencyWorkspace : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg transition-colors',
                    collapsed ? 'justify-center h-9 w-10 mx-auto' : 'h-9 px-3',
                    'text-foreground/60 hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/[0.05]',
                  )}
                >
                  <Briefcase className="h-[17px] w-[17px] shrink-0" />
                  {!collapsed && <span className="flex-1 text-[13.5px] font-medium">{t.agencyWorkspace}</span>}
                </Link>
              </li>
            )}
            {suiteNav.map((item) => renderSuiteItem(item, collapsed))}
          </ul>
        </div>
      )}

      {/* Account */}
      <div className={cn('shrink-0 pb-6 ', collapsed ? 'px-2' : 'px-3')}>
        <Popover open={accountOpen} onOpenChange={setAccountOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={user?.name || user?.email || t.account}
              aria-label={t.accountMenu}
              className={cn(
                'flex items-center gap-3 rounded-lg transition-colors w-full',
                'text-foreground hover:bg-muted/50 dark:hover:bg-white/[0.05]',
                collapsed ? 'justify-center h-10 w-10 mx-auto' : 'h-10 px-2',
              )}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border/60"
                />
              ) : (
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    'bg-primary/12 text-[11px] font-semibold text-primary ring-1 ring-border/40',
                  )}
                >
                  {initials}
                </div>
              )}
              {!collapsed && (
                <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-foreground/90">
                  {user?.name?.trim() || user?.email || t.account}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 border border-border bg-card p-0 shadow-md"
            side={inDrawer ? 'top' : 'right'}
            align="end"
            sideOffset={10}
            collisionPadding={12}
          >
            <div className="border-b border-border bg-muted/25 px-3 py-3">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name?.trim() || t.account}</p>
              {user?.email ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
              ) : null}
            </div>
            {client ? (
              (brand?.support_email || brand?.footer_text || !brand?.hide_seentics) && (
                <div className="flex flex-col gap-1 p-1.5" data-testid="client-account-menu">
                  {brand?.support_email && (
                    <a
                      href={`mailto:${brand.support_email}`}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                    >
                      <LifeBuoy className="h-4 w-4 shrink-0 opacity-70" />
                      {t.contact(brand.brand_name || '')}
                    </a>
                  )}
                  {brand?.footer_text && <p className="px-2.5 py-1 text-[11.5px] text-muted-foreground">{brand.footer_text}</p>}
                  {!brand?.hide_seentics && (
                    <p className="px-2.5 py-1 text-[11.5px] text-muted-foreground">{t.poweredBy}</p>
                  )}
                </div>
              )
            ) : (
            <nav className="flex flex-col p-1.5">
              <Link
                href={`/websites/${websiteId}/settings/profile`}
                onClick={() => setAccountOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-foreground/80 hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <User className="h-4 w-4 shrink-0 opacity-70" />
                {t.profile}
              </Link>
              <Link
                href={`/websites/${websiteId}/settings/billing`}
                onClick={() => setAccountOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-foreground/80 hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <CreditCard className="h-4 w-4 shrink-0 opacity-70" />
                {t.billing}
              </Link>
              <Link
                href={`/websites/${websiteId}/settings/support`}
                onClick={() => setAccountOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-foreground/80 hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <LifeBuoy className="h-4 w-4 shrink-0 opacity-70" />
                {t.support}
              </Link>
            </nav>
            )}
            <Separator className="bg-border/60" />
            <div className="flex flex-col p-1.5">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen(false);
                  // A client signs in again on their agency's page, not the account sign-in.
                  const signIn = client ? clientSignInHref(user?.agency?.slug ?? client.access.me?.agency.slug) : '/signin';
                  logout();
                  router.push(signIn);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                  'text-destructive/90 hover:bg-destructive/10 hover:text-destructive',
                )}
              >
                <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                {t.logOut}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 md:hidden dark:border-border/40">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t.openNavigation}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-muted/60 dark:hover:bg-white/[0.05] hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href={homeHref} className="flex min-w-0 items-center gap-2">
          {renderMark()}
          <span className="truncate text-[16px] font-bold tracking-tight text-foreground">{brand?.brand_name || 'Seentics'}</span>
        </Link>
      </div>
      {panel(collapsedPref, false)}
      <SidebarCustomizeDialog open={customizing} onOpenChange={setCustomizing} items={allNav} hidden={hidden} onChange={setHidden} />
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[264px] max-w-[85vw] border-sidebar-border bg-sidebar p-0 md:hidden">
          <SheetTitle className="sr-only">{t.navigation}</SheetTitle>
          {panel(false, true)}
        </SheetContent>
      </Sheet>
    </>
  );
}
