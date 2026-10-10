'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppWindow, BarChart3, BookOpen, FileCode2, KeyRound, Paintbrush, Plus, Users } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';
import type { AgencyClient } from '@/features/agency/types';
import { useAgencyAPIKeys, useAgencyClients } from '@/features/agency/queries';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { PAGE_MENU_LABEL, PAGE_MENU_PANEL, pageMenuItem } from '@/components/ui/page-menu';
import { ClientsTab } from '@/components/agency/tabs/ClientsTab';
import { ApiKeysTab } from '@/components/agency/tabs/ApiKeysTab';
import { AnalyticsApiTab, ManagementApiTab } from '@/components/agency/tabs/ApiDocsTabs';
import { EmbedsTab } from '@/components/agency/tabs/EmbedsTab';
import { WhiteLabelTab } from '@/components/agency/tabs/WhiteLabelTab';
import { ClientFormDialog } from '@/components/agency/ClientFormDialog';
import { CreateAccountKeyDialog } from '@/components/agency/AccountKeysPanel';

/**
 * Clients and both APIs are open source and on every plan. Client logins and white-label
 * are Cloud features, served by the gateway, so their tabs show only there.
 */
const TAB_GROUPS = [
  {
    title: 'Agency',
    tabs: [
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'embeds', label: 'Embeds', icon: AppWindow },
      ...(isEnterprise ? [{ id: 'white-label', label: 'White label', icon: Paintbrush }] : []),
    ],
  },
  {
    title: 'Developers',
    tabs: [
      { id: 'api-keys', label: 'API keys', icon: KeyRound },
      { id: 'management-api', label: 'Management API', icon: FileCode2 },
      { id: 'analytics-api', label: 'Analytics API', icon: BarChart3 },
    ],
  },
] as const;

type TabId =
  | 'clients' | 'embeds' | 'white-label'
  | 'api-keys' | 'management-api' | 'analytics-api';
const isTab = (v: string | null): v is TabId =>
  TAB_GROUPS.some(g => (g.tabs as readonly { id: string }[]).some(t => t.id === v));

/**
 * The tab lives in the query string, so a reload or a shared link lands on it. Read from
 * `window.location` after mount rather than through `useSearchParams`, which on this
 * static export would need a Suspense boundary. A client has its own page instead.
 */
function writeUrl(tab: TabId) {
  const qs = tab === 'clients' ? '' : `?tab=${tab}`;
  window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
}

const DESCRIPTIONS: Record<TabId, string> = {
  clients: 'One record per client: their websites and tracking code, what each collects, usage caps, and an optional login.',
  'api-keys': 'Account keys for the management and analytics APIs.',
  'management-api': 'Create and manage clients and websites from your own backend, with an account key.',
  'analytics-api': "Read any website's analytics, recordings and heatmaps, with an account key.",
  embeds: "Put a read-only dashboard of a website inside your own product or a client's portal.",
  'white-label': 'Your brand on everything your clients see.',
};

export default function AgencyPage() {
  const router = useRouter();
  const websiteId = usePathSegment(1) ?? '';
  const [tab, setTab] = useState<TabId>('clients');
  const [clientForm, setClientForm] = useState<{ open: boolean; client: AgencyClient | null }>({ open: false, client: null });
  const [newKey, setNewKey] = useState(false);

  const { data: clients } = useAgencyClients(websiteId);
  const { data: keys } = useAgencyAPIKeys(websiteId);
  const counts: Partial<Record<TabId, number | undefined>> = { clients: clients?.length, 'api-keys': keys?.length };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('tab');
    if (isTab(fromUrl)) setTab(fromUrl);
  }, []);

  const go = (nextTab: TabId) => {
    setTab(nextTab);
    writeUrl(nextTab);
  };

  const editClient = (client: AgencyClient | null) => setClientForm({ open: true, client });

  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
      <DashboardPageHeader websiteId={websiteId} title="Agency & Developers" description={DESCRIPTIONS[tab]}>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href="/docs/agency">
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </Link>
        </Button>
        {tab === 'clients' && (
          <Button size="sm" className="gap-1.5" onClick={() => editClient(null)}>
            <Plus className="h-3.5 w-3.5" />
            Add client
          </Button>
        )}
        {tab === 'api-keys' && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewKey(true)}>
            <Plus className="h-3.5 w-3.5" />
            New account key
          </Button>
        )}
      </DashboardPageHeader>

      {/*
        A menu beside the content rather than a row of tabs above it. Seven tabs in one
        line read as a toolbar, whichever way they were styled; two titled groups of
        three or four items read as the two things this page is.
      */}
      <div className="grid gap-5 lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-4">
        <nav
          className={cn(PAGE_MENU_PANEL, 'lg:sticky lg:top-5 lg:self-start')}
          aria-label="Agency and developer sections"
        >
          {TAB_GROUPS.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && 'mt-1 border-t border-border pt-1')}>
              <p className={PAGE_MENU_LABEL}>{group.title}</p>
              <ul className="flex flex-col gap-px" role="tablist" aria-orientation="vertical">
                {group.tabs.map(t => {
                  const id = t.id as TabId;
                  const active = tab === id;
                  const count = counts[id];
                  return (
                    <li key={t.id}>
                      <button
                        role="tab"
                        aria-selected={active}
                        onClick={() => go(id)}
                        className={cn(pageMenuItem(active), 'relative py-2', active && "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary")}
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
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'clients' && (
            <ClientsTab
              websiteId={websiteId}
              onOpen={id => router.push(`/websites/${websiteId}/agency/clients/${id}`)}
              onEdit={editClient}
            />
          )}
          {tab === 'api-keys' && <ApiKeysTab websiteId={websiteId} onCreateAccountKey={() => setNewKey(true)} />}
          {tab === 'management-api' && <ManagementApiTab />}
          {tab === 'analytics-api' && <AnalyticsApiTab />}
          {tab === 'embeds' && <EmbedsTab websiteId={websiteId} />}
          {isEnterprise && tab === 'white-label' && <WhiteLabelTab websiteId={websiteId} />}
        </div>
      </div>

      <ClientFormDialog
        websiteId={websiteId}
        open={clientForm.open}
        onOpenChange={open => setClientForm(f => ({ ...f, open }))}
        initial={clientForm.client}
      />
      <CreateAccountKeyDialog websiteId={websiteId} open={newKey} onOpenChange={setNewKey} />
    </div>
  );
}
