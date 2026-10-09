'use client';

import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, CircleSlash, Gauge, Globe, Loader2, Pause, Pencil, Play } from 'lucide-react';
import { isDemoRefusal, useAgencyClient, useUpdateClient } from '@/features/agency/queries';
import type { AgencyClient } from '@/features/agency/types';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';
import { compactNumber, disabledFeatures } from '@/components/agency/format';
import { ClientAvatar } from '@/components/agency/tabs/ClientsTab';
import {
  ClientFeaturesPanel,
  ClientLimitsPanel,
  ClientPortalPanel,
  ClientWebsitesPanel,
} from '@/components/agency/client-sections';

const STATUS_PILL: Record<AgencyClient['status'], string> = {
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  suspended: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  archived: 'border-border bg-muted text-muted-foreground',
};

/** One client, in place of the list: what it is, what it gets, and its sites. */
export function ClientDetail({ websiteId, clientId, onBack, onEdit }: {
  websiteId: string;
  clientId: string;
  onBack: () => void;
  onEdit: (client: AgencyClient) => void;
}) {
  const { data: client, isLoading, isError } = useAgencyClient(websiteId, clientId);
  const update = useUpdateClient(websiteId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="surface flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">This client doesn&apos;t exist, or isn&apos;t yours.</p>
        <Button variant="outline" size="sm" onClick={onBack}>Back to clients</Button>
      </div>
    );
  }

  const off = disabledFeatures(client);
  const suspended = client.status !== 'active';
  const setStatus = (status: AgencyClient['status']) =>
    update.mutate({ id: client.id, req: { status } }, {
      onSuccess: () => toast.success(`${client.name} is now ${status}`),
      onError: e => { if (!isDemoRefusal(e)) toast.error((e as Error).message); },
    });

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All clients
      </button>

      <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4">
          <ClientAvatar client={client} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{client.name}</h2>
              <span className={cn('rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize', STATUS_PILL[client.status])}>
                {client.status}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[client.company, client.email, client.externalId && `ID ${client.externalId}`].filter(Boolean).join(' · ') || 'No details yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onEdit(client)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          {client.status !== 'archived' && (
            <Button
              variant={suspended ? 'default' : 'outline'} size="sm" className="h-8 gap-1.5"
              disabled={update.isPending}
              onClick={() => setStatus(suspended ? 'active' : 'suspended')}
            >
              {suspended ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {suspended ? 'Resume tracking' : 'Suspend'}
            </Button>
          )}
        </div>
      </div>

      {client.status === 'suspended' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Suspended — none of this client&apos;s websites are collecting data until it is resumed.
        </div>
      )}

      <StatCards
        className="mb-0"
        cards={[
          {
            label: 'Websites',
            value: client.limits.maxWebsites === null ? client.websites.length : `${client.websites.length} / ${client.limits.maxWebsites}`,
            icon: Globe,
            tone: 'info',
          },
          {
            label: 'Event cap',
            value: client.limits.maxMonthlyEvents === null ? 'None' : compactNumber(client.limits.maxMonthlyEvents),
            subtext: 'per month',
            icon: Gauge,
            tone: 'accent',
            toneWhen: client.limits.maxMonthlyEvents !== null,
          },
          {
            label: 'Recording cap',
            value: client.limits.maxReplays === null ? 'None' : compactNumber(client.limits.maxReplays),
            subtext: 'per month',
            icon: Gauge,
            tone: 'accent',
            toneWhen: client.limits.maxReplays !== null,
          },
          {
            label: off.length ? 'Features off' : 'Features',
            value: off.length ? off.length : 'All on',
            icon: off.length ? CircleSlash : CheckCircle2,
            tone: off.length ? 'warning' : 'success',
          },
        ]}
      />

      {client.note && (
        <p className="surface px-5 py-3 text-sm text-muted-foreground">{client.note}</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <ClientWebsitesPanel websiteId={websiteId} client={client} />
          <ClientLimitsPanel websiteId={websiteId} client={client} />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <ClientFeaturesPanel websiteId={websiteId} client={client} />
          {isEnterprise && <ClientPortalPanel websiteId={websiteId} client={client} />}
        </div>
      </div>
    </div>
  );
}
