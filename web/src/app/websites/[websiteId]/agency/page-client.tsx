'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppWindow, BarChart3, BookOpen, FileCode2, KeyRound, Paintbrush, Plus, UserCheck, Users } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';
import type { AgencyClient } from '@/features/agency/types';
import { useAgencyAPIKeys, useAgencyClients } from '@/features/agency/queries';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { ClientsTab } from '@/components/agency/tabs/ClientsTab';
import { ApiKeysTab } from '@/components/agency/tabs/ApiKeysTab';
import { AnalyticsApiTab, ManagementApiTab } from '@/components/agency/tabs/ApiDocsTabs';
import { EmbedsTab } from '@/components/agency/tabs/EmbedsTab';
import { ClientAccountsTab } from '@/components/agency/tabs/ClientAccountsTab';
import { WhiteLabelTab } from '@/components/agency/tabs/WhiteLabelTab';
import { ClientFormDialog } from '@/components/agency/ClientFormDialog';
import { CreateAccountKeyDialog } from '@/components/agency/AccountKeysPanel';

/**
 * Clients and both APIs are open source and on every plan. Client logins and white-label
 * are Cloud features, served by the gateway, so their tabs show only there.
 */
const TABS = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'api-keys', label: 'API keys', icon: KeyRound },
  { id: 'management-api', label: 'Management API', icon: FileCode2 },
  { id: 'analytics-api', label: 'Analytics API', icon: BarChart3 },
  { id: 'embeds', label: 'Embeds', icon: AppWindow },
  ...(isEnterprise
    ? [
        { id: 'accounts', label: 'Client accounts', icon: UserCheck },
        { id: 'white-label', label: 'White label', icon: Paintbrush },
      ]
    : []),
] as const;

type TabId = (typeof TABS)[number]['id'];
const isTab = (v: string | null): v is TabId => TABS.some(t => t.id === v);

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
  clients: 'Group websites under clients, choose what each one collects, and cap its monthly usage.',
  'api-keys': 'Keys for the management API and the data API.',
  'management-api': 'Create and manage clients and websites from your own backend, with an account key.',
  'analytics-api': "Read any website's analytics, recordings and heatmaps, with a website key.",
  embeds: "Put a read-only dashboard of a website inside your own product or a client's portal.",
  accounts: 'Logins that let a client see only their own dashboard.',
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
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6 lg:p-8">
      <DashboardPageHeader websiteId={websiteId} title="Agency" description={DESCRIPTIONS[tab]}>
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

      <nav
        className="mb-5 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border bg-white p-0.5 shadow-sm dark:bg-muted"
        role="tablist"
      >
        {TABS.map(t => {
          const active = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => go(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary dark:bg-background dark:text-foreground dark:shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : '')} />
              {t.label}
              {count !== undefined && (
                <span className={cn(
                  'rounded px-1 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-primary/15 text-primary' : 'bg-background/60 text-muted-foreground',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

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
      {isEnterprise && tab === 'accounts' && <ClientAccountsTab />}
      {isEnterprise && tab === 'white-label' && <WhiteLabelTab />}

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
