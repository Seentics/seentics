'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, LayoutDashboard, Link2Off, Loader2, Video } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { setEmbedToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EmbedNavProvider, type AppNavigation } from '@/lib/embed-nav';
import type { EmbedSection } from '@/features/agency/types';
import { WebsiteOverview } from '@/components/analytics/WebsiteOverview';
import { ReplaysView } from '@/app/websites/[websiteId]/replays/page-client';
import { ReplayDetailView } from '@/app/websites/[websiteId]/replays/[sessionId]/page-client';
import { HeatmapsView } from '@/app/websites/[websiteId]/heatmaps/page-client';
import { HeatmapDetailView } from '@/app/websites/[websiteId]/heatmaps/[slug]/page-client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { viewFromHref, resolveActiveSection, type View } from '@/features/embed/view';
import { EmbedTokenError, fetchEmbedClientSites, fetchEmbedInfo, isSampleToken } from '@/features/embed/api';

/**
 * An iframed dashboard: `/embed/:id?token=…&theme=light|dark&days=7|30|90`. The id is a website's,
 * or a client's with `&client=1`, which adds a switcher between that client's websites.
 *
 * It is the real dashboard pages — the same components the signed-in app renders — with no
 * sidebar, account menu or writes, because it lives inside a customer's own product. Which
 * pages (analytics, recordings, heatmaps) is the link's choice: only those it allows get a tab.
 * The link's token goes out with every call (see `setEmbedToken`). The theme is applied to this
 * document only and never stored, so an embed cannot change the dashboard theme of someone
 * signed in to Seentics in the same browser. Height is posted to the parent
 * (`seentics:embed:resize`) so the iframe can size itself.
 */

const TABS: Array<{ id: EmbedSection; label: string; icon: React.ElementType }> = [
  { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
  { id: 'recordings', label: 'Recordings', icon: Video },
  { id: 'heatmaps', label: 'Heatmaps', icon: Flame },
];

const DETAIL_HEIGHT = 'h-[760px]';

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    token: p.get('token') ?? '',
    client: p.get('client') === '1',
    theme: p.get('theme') === 'light' ? 'light' : p.get('theme') === 'dark' ? 'dark' : null,
  };
}

export default function EmbedPage() {
  const id = usePathSegment(1) ?? '';
  const [params, setParams] = useState<ReturnType<typeof readParams> | null>(null);
  const [pickedSite, setPickedSite] = useState<string | null>(null);
  const [view, setView] = useState<View>({ section: 'analytics' });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = readParams();
    // Before anything renders, so the very first call already carries the token.
    setEmbedToken(p.token);
    setParams(p);
    // This document only, never storage: see the note above.
    if (p.theme) {
      const apply = () => document.documentElement.classList.toggle('dark', p.theme === 'dark');
      apply();
      const t = setTimeout(apply, 50);
      return () => clearTimeout(t);
    }
  }, []);

  const clientMode = !!params?.client;
  const retry = (count: number, e: unknown) => !(e instanceof EmbedTokenError) && count < 2;

  // A client-wide link first asks which websites it covers.
  const sitesQuery = useQuery({
    queryKey: ['embed-client-sites', id],
    queryFn: () => fetchEmbedClientSites(id, params!.token),
    enabled: !!id && !!params && clientMode,
    retry,
  });
  const sites = sitesQuery.data?.websites ?? [];
  const siteId = clientMode ? (pickedSite ?? sites[0]?.id ?? '') : id;

  const infoQuery = useQuery({
    queryKey: ['embed-info', siteId],
    queryFn: () => fetchEmbedInfo(siteId, params!.token),
    enabled: !!siteId && !!params,
    retry,
  });

  const sample = !!params && isSampleToken(params.token);
  const error = sitesQuery.error ?? infoQuery.error;
  const sections: EmbedSection[] = infoQuery.data?.sections ?? sitesQuery.data?.sections ?? ['analytics'];
  const tabs = TABS.filter(t => sections.includes(t.id));
  const activeSection = resolveActiveSection(view.section, sections);
  const site = sites.find(s => s.id === siteId);
  const siteUrl = infoQuery.data?.website.url ?? site?.url;

  // Sample links show the demo data, whichever sample site is picked.
  const dataSiteId = sample ? 'demo' : siteId;

  const nav = useMemo<AppNavigation>(() => {
    const go = (href: string) => {
      const next = viewFromHref(href);
      if (next) setView(next);
    };
    return { push: go, replace: go };
  }, []);

  // Tell the parent how tall the content is, so the iframe can fit it without a scrollbar.
  useEffect(() => {
    const el = root.current;
    if (!el || window.parent === window) return;
    const post = () => window.parent.postMessage({ type: 'seentics:embed:resize', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, []);

  const heading = clientMode ? (
    sites.length > 1 ? (
      <Select value={siteId} onValueChange={v => { setPickedSite(v); setView({ section: activeSection }); }}>
        <SelectTrigger className="h-8 w-64 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {sites.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    ) : (
      <span className="text-sm font-semibold text-foreground">{sites[0]?.name}</span>
    )
  ) : (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground">{infoQuery.data?.website.name}</p>
      <p className="truncate text-xs text-muted-foreground">{infoQuery.data?.website.url}</p>
    </div>
  );

  const ready = !!params && !!siteId && !infoQuery.isLoading && (!clientMode || !sitesQuery.isLoading);

  return (
    <div ref={root} className="min-h-[200px] bg-background">
      {error ? (
        <div className="surface m-4 flex flex-col items-center gap-2 py-12 text-center">
          <Link2Off className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {error instanceof EmbedTokenError ? 'This embed link is no longer valid' : "This dashboard couldn't load"}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {error instanceof EmbedTokenError
              ? 'It may have been revoked. Ask whoever runs this page for a new one.'
              : 'Please try again in a moment.'}
          </p>
        </div>
      ) : clientMode && !sitesQuery.isLoading && sites.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">This client has no websites yet.</p>
      ) : !ready ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <EmbedNavProvider value={nav}>
          {/* The site, and a tab for each section the link allows. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
            {heading}
            <div className="flex-1" />
            {tabs.length > 1 && (
              <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activeSection === t.id}
                    onClick={() => setView({ section: t.id } as View)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      activeSection === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* `key`: switching website or section starts fresh rather than blending two states. */}
          <div key={`${siteId}:${activeSection}:${'sessionId' in view ? view.sessionId : ''}:${'slug' in view ? view.slug : ''}`}>
            {activeSection === 'analytics' && (
              <WebsiteOverview websiteId={dataSiteId} embed sample={sample} headerLeft={null} />
            )}
            {activeSection === 'recordings' && (
              view.section === 'recordings' && view.sessionId ? (
                <div className={`flex flex-col ${DETAIL_HEIGHT}`}>
                  <ReplayDetailView websiteId={dataSiteId} sessionId={view.sessionId} />
                </div>
              ) : (
                <ReplaysView websiteId={dataSiteId} embed />
              )
            )}
            {activeSection === 'heatmaps' && (
              view.section === 'heatmaps' && view.slug ? (
                <div className={DETAIL_HEIGHT}>
                  <HeatmapDetailView websiteId={dataSiteId} slug={view.slug} embed siteUrl={siteUrl} />
                </div>
              ) : (
                <HeatmapsView websiteId={dataSiteId} embed />
              )
            )}
          </div>
        </EmbedNavProvider>
      )}
    </div>
  );
}
