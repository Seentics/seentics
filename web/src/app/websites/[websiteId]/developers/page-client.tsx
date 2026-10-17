'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, BookOpen, FileCode2, KeyRound, Plus, Webhook, Wrench } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { cn } from '@/lib/utils';
import { useAPIKeys } from '@/components/developers/api-keys';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { PAGE_MENU_LABEL, PAGE_MENU_PANEL, pageMenuItem } from '@/components/ui/page-menu';
import { CreateAccountKeyDialog, type AccessPreset } from '@/components/developers/AccountKeysPanel';
import { DeveloperApiKeysTab, IntegrationsTab, SetupTab, WebsitesApiTab } from '@/components/developers/DeveloperTabs';
import { DataApiTab } from '@/components/developers/DataApiTab';

/**
 * Developer-only: keys, the two API references, install guides and where data goes out.
 * Clients, embeds and white label are the Agency workspace's (`/agency`).
 */
export const DEVELOPER_TABS = [
  { id: 'api-keys', label: 'API keys', icon: KeyRound },
  { id: 'data-api', label: 'Data API', icon: BarChart3 },
  { id: 'management-api', label: 'Management API', icon: FileCode2 },
  { id: 'setup', label: 'Tracker & SDK setup', icon: Wrench },
  { id: 'integrations', label: 'Webhooks & integrations', icon: Webhook },
] as const;

type TabId = (typeof DEVELOPER_TABS)[number]['id'];
const isTab = (v: string | null): v is TabId => DEVELOPER_TABS.some(t => t.id === v);

const DESCRIPTIONS: Record<TabId, string> = {
  'api-keys': 'Account keys for the Data API, the Management API and the Agency API.',
  'data-api': "Read any website's analytics, recordings and heatmaps, with an account key.",
  'management-api': 'Create, update and delete websites from your own backend, with an account key.',
  setup: "This website's tracking snippet, and guides for every way to install it.",
  integrations: "Where this website's data goes out: webhooks, integrations and ad platforms.",
};

/**
 * The tab lives in the query string, so a reload or a shared link lands on it. Read from
 * `window.location` after mount rather than through `useSearchParams`, which on this
 * static export would need a Suspense boundary.
 */
function writeUrl(tab: TabId) {
  const qs = tab === 'api-keys' ? '' : `?tab=${tab}`;
  window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
}

export default function DevelopersPage() {
  const websiteId = usePathSegment(1) ?? '';
  const [tab, setTab] = useState<TabId>('api-keys');
  const [newKey, setNewKey] = useState(false);
  const [preset, setPreset] = useState<AccessPreset | undefined>();
  const { data: keys } = useAPIKeys(websiteId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('tab');
    if (isTab(fromUrl)) setTab(fromUrl);
    // `?new=agency` (the agency workspace's API page): open a new key on the Agency API preset.
    if (params.get('new') === 'agency') {
      setTab('api-keys');
      setPreset('agency');
      setNewKey(true);
      writeUrl('api-keys');
    }
  }, []);

  const go = (next: TabId) => {
    setTab(next);
    writeUrl(next);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
      <DashboardPageHeader websiteId={websiteId} title="Developers" description={DESCRIPTIONS[tab]}>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href="/docs/api">
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </Link>
        </Button>
        {tab === 'api-keys' && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewKey(true)}>
            <Plus className="h-3.5 w-3.5" />
            New account key
          </Button>
        )}
      </DashboardPageHeader>

      <div className="grid gap-5 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-4">
        <nav className={cn(PAGE_MENU_PANEL, 'lg:sticky lg:top-5 lg:self-start')} aria-label="Developer sections">
          <p className={PAGE_MENU_LABEL}>Developers</p>
          <ul className="flex flex-col gap-px" role="tablist" aria-orientation="vertical">
            {DEVELOPER_TABS.map(t => {
              const active = tab === t.id;
              const count = t.id === 'api-keys' ? keys?.length : undefined;
              return (
                <li key={t.id}>
                  <button
                    role="tab"
                    aria-selected={active}
                    onClick={() => go(t.id)}
                    className={cn(pageMenuItem(active), 'relative py-2', active && 'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary')}
                  >
                    <t.icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="flex-1 truncate">{t.label}</span>
                    {count !== undefined && (
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{count}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {tab === 'api-keys' && <DeveloperApiKeysTab websiteId={websiteId} onCreate={() => setNewKey(true)} />}
          {tab === 'data-api' && <DataApiTab />}
          {tab === 'management-api' && <WebsitesApiTab />}
          {tab === 'setup' && websiteId && <SetupTab websiteId={websiteId} />}
          {tab === 'integrations' && websiteId && <IntegrationsTab websiteId={websiteId} />}
        </div>
      </div>

      <CreateAccountKeyDialog websiteId={websiteId} open={newKey} onOpenChange={setNewKey} preset={preset} />
    </div>
  );
}
