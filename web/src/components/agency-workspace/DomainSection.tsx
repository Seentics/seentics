'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Clock, Globe, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agencyError, domainErrorMessage, refreshDomain, removeDomain, setDomain } from '@/features/agency/api';
import { DOMAIN_STATES } from '@/features/agency/constants';
import { agencyKeys, useAgencyMutation, useDomain } from '@/features/agency/queries';
import type { Domain, DomainState } from '@/features/agency/types';
import { cn } from '@/lib/utils';
import { CopyButton, ErrorNote, LoadingRow, Panel, Pill, type Tone } from './ui';

const STATE_LOOK: Record<DomainState, { tone: Tone; icon: typeof Clock }> = {
  pending_dns: { tone: 'amber', icon: Clock },
  pending_certificate: { tone: 'blue', icon: Clock },
  active: { tone: 'green', icon: CheckCircle2 },
  failed: { tone: 'red', icon: XCircle },
};

/** The gateway answers 503 `provider_error` when this deployment offers no custom domains. */
export const isDomainsUnavailable = (e: unknown) => agencyError(e).status === 503;

function DnsRecord({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div data-testid={`dns-${type.toLowerCase()}`} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-xs">
      <span className="text-muted-foreground">Type</span>
      <span className="font-mono font-semibold text-foreground">{type}</span>
      <span className="text-muted-foreground">Name</span>
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground">{name}</code>
        <CopyButton text={name} label={`Copy ${type} name`} className="h-7 w-7" />
      </span>
      <span className="text-muted-foreground">Value</span>
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground">{value}</code>
        <CopyButton text={value} label={`Copy ${type} value`} className="h-7 w-7" />
      </span>
    </div>
  );
}

/** Your own hostname for client dashboards: add it, follow its DNS and certificate, remove it. */
export function DomainSection() {
  const queryClient = useQueryClient();
  const domain = useDomain();
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const save = useAgencyMutation(setDomain);
  const refresh = useAgencyMutation(refreshDomain);
  const remove = useAgencyMutation(removeDomain);

  const put = (d: Domain | null) => { setError(null); queryClient.setQueryData(agencyKeys.domain, d); };
  const fail = (e: unknown) => setError(domainErrorMessage(e));

  const unavailable = domain.isError && isDomainsUnavailable(domain.error);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!h) return;
    save.mutate(h, { onSuccess: d => { put(d); setHostname(''); }, onError: fail });
  };

  let body: React.ReactNode;
  if (domain.isLoading) {
    body = <LoadingRow />;
  } else if (unavailable) {
    body = (
      <div data-testid="domains-unavailable" className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Custom domains aren’t available yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This Seentics installation is not set up to serve custom domains. Your branding still applies on Seentics’ own address.
          </p>
        </div>
      </div>
    );
  } else if (domain.isError) {
    body = <ErrorNote>{domainErrorMessage(domain.error)}</ErrorNote>;
  } else if (!domain.data) {
    body = (
      <form onSubmit={submit} className="space-y-2">
        <Label htmlFor="agency-domain" className="text-xs">Hostname</Label>
        <div className="flex gap-2">
          <Input
            id="agency-domain"
            placeholder="reports.youragency.com"
            value={hostname}
            onChange={e => { setHostname(e.target.value); setError(null); }}
            className={cn('h-9 font-mono', error && 'border-destructive')}
          />
          <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5" disabled={!hostname.trim() || save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            Add domain
          </Button>
        </div>
      </form>
    );
  } else {
    const d = domain.data;
    const look = STATE_LOOK[d.state];
    const Icon = look.icon;
    body = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <code className="truncate font-mono text-sm font-semibold text-foreground">{d.hostname}</code>
            <Pill tone={look.tone} data-testid="domain-state"><Icon className="h-3 w-3" />{DOMAIN_STATES[d.state].label}</Pill>
          </div>
          <div className="flex gap-1.5">
            {d.state !== 'active' && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={refresh.isPending}
                onClick={() => refresh.mutate(undefined, { onSuccess: put, onError: fail })}>
                <RefreshCw className={cn('h-3.5 w-3.5', refresh.isPending && 'animate-spin')} />Check now
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive" disabled={remove.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Remove ${d.hostname}?`,
                  description: 'Client dashboards stop answering on this domain. Your branding stays.',
                  confirmLabel: 'Remove domain',
                  destructive: true,
                });
                if (ok) remove.mutate(undefined, { onSuccess: () => { put(null); toast.success('Custom domain removed'); }, onError: fail });
              }}>
              <Trash2 className="h-3.5 w-3.5" />Remove
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {DOMAIN_STATES[d.state].hint}
          {d.last_checked_at && ` Last checked ${formatDistanceToNow(new Date(d.last_checked_at), { addSuffix: true })}.`}
        </p>
        {d.reason && d.state !== 'active' && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{d.reason}</p>
        )}
        {d.state !== 'active' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Add {d.ownership_verification ? 'these records' : 'this record'} at your DNS provider</p>
            <DnsRecord type="CNAME" name={d.hostname} value={d.cname_target} />
            {d.ownership_verification && (
              <DnsRecord type={d.ownership_verification.type.toUpperCase()} name={d.ownership_verification.name} value={d.ownership_verification.value} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Panel
      data-testid="domain-section"
      title="Custom domain"
      description="Serve client dashboards from your own subdomain, such as reports.youragency.com — not your main site."
    >
      {confirmDialog}
      <div className="space-y-3">
        {body}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Panel>
  );
}
