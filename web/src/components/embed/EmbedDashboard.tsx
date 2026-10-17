'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, LayoutDashboard, Link2Off, Loader2, Video } from 'lucide-react';
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
 * The read-only dashboard behind an embed link and the client portal: a website's, or a client's
 * (`clientMode`) with a switcher between its websites, showing only the sections the token allows.
 *
 * It is the real dashboard pages — the same components the signed-in app renders — with no
 * sidebar, account menu or writes. The caller sets the token on the api client first
 * (`setEmbedToken`), so every analytics call carries it.
 */

const TABS: Array<{ id: EmbedSection; label: string; icon: React.ElementType }> = [
  { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
  { id: 'recordings', label: 'Recordings', icon: Video },
  { id: 'heatmaps', label: 'Heatmaps', icon: Flame },
];

const DETAIL_HEIGHT = 'h-[760px]';

const EMBED_INVALID = {
  title: 'This embed link is no longer valid',
  body: 'It may have been revoked. Ask whoever runs this page for a new one.',
};

export function EmbedDashboard({ id, token, clientMode, invalid = EMBED_INVALID }: {
  id: string;
  token: string;
  clientMode: boolean;
  /** What a revoked or expired token reads as. */
  invalid?: { title: string; body: string };
}) {
  const [pickedSite, setPickedSite] = useState<string | null>(null);
  const [view, setView] = useState<View>({ section: 'analytics' });

  const retry = (count: number, e: unknown) => !(e instanceof EmbedTokenError) && count < 2;

  // A client-wide link first asks which websites it covers.
  const sitesQuery = useQuery({
    queryKey: ['embed-client-sites', id],
    queryFn: () => fetchEmbedClientSites(id, token),
    enabled: !!id && clientMode,
    retry,
  });
  const sites = sitesQuery.data?.websites ?? [];
  const siteId = clientMode ? (pickedSite ?? sites[0]?.id ?? '') : id;

  const infoQuery = useQuery({
    queryKey: ['embed-info', siteId],
    queryFn: () => fetchEmbedInfo(siteId, token),
    enabled: !!siteId,
    retry,
  });

  const sample = isSampleToken(token);
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

  const ready = !!siteId && !infoQuery.isLoading && (!clientMode || !sitesQuery.isLoading);

  return (
    <div className="min-h-[200px] bg-background">
      {error ? (
        <div className="surface m-4 flex flex-col items-center gap-2 py-12 text-center">
          <Link2Off className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {error instanceof EmbedTokenError ? invalid.title : "This dashboard couldn't load"}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {error instanceof EmbedTokenError ? invalid.body : 'Please try again in a moment.'}
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
                  <ReplayDetailView websiteId={dataSiteId} sessionId={view.sessionId} embed />
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
