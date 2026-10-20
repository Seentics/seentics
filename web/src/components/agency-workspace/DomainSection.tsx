'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Globe, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agencyError, refreshDomain, removeDomain, setDomain } from '@/features/agency/api';
import { agencyKeys, useAgencyMutation, useDomain } from '@/features/agency/queries';
import type { Domain, DomainState } from '@/features/agency/types';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { clientDashboardUrl } from './ClientUsersPanel';
import { CopyButton, ErrorNote, LoadingRow, Panel, Pill, timeAgo, useDomainErrorText, type Tone } from './ui';

const STATE_LOOK: Record<DomainState, { tone: Tone; icon: typeof Clock }> = {
  pending_dns: { tone: 'amber', icon: Clock },
  pending_certificate: { tone: 'blue', icon: Clock },
  active: { tone: 'green', icon: CheckCircle2 },
  failed: { tone: 'red', icon: XCircle },
};

/** The gateway answers 503 `provider_error` when this deployment offers no custom domains. */
export const isDomainsUnavailable = (e: unknown) => agencyError(e).status === 503;

function DnsRecord({ type, name, value }: { type: string; name: string; value: string }) {
  const t = useT().agency.domain;
  return (
    <div data-testid={`dns-${type.toLowerCase()}`} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-xs">
      <span className="text-muted-foreground">{t.type}</span>
      <span className="font-mono font-semibold text-foreground">{type}</span>
      <span className="text-muted-foreground">{t.name}</span>
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground">{name}</code>
        <CopyButton text={name} label={t.copyName(type)} className="h-7 w-7" />
      </span>
      <span className="text-muted-foreground">{t.value}</span>
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground">{value}</code>
        <CopyButton text={value} label={t.copyValue(type)} className="h-7 w-7" />
      </span>
    </div>
  );
}

/** Your own hostname for client dashboards: add it, follow its DNS and certificate, remove it. */
export function DomainSection() {
  const all = useT().agency;
  const t = all.domain;
  const removeLabel = all.common.remove;
  const { locale } = useLocale();
  const domainErrorMessage = useDomainErrorText();
  const queryClient = useQueryClient();
  const domain = useDomain();
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showRecords, setShowRecords] = useState(false);
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
          <p className="text-sm font-medium text-foreground">{t.unavailableTitle}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.unavailableBody}
          </p>
        </div>
      </div>
    );
  } else if (domain.isError) {
    body = <ErrorNote>{domainErrorMessage(domain.error)}</ErrorNote>;
  } else if (!domain.data) {
    body = (
      <form onSubmit={submit} className="space-y-2">
        <Label htmlFor="agency-domain" className="text-xs">{t.hostname}</Label>
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
            {t.add}
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
            <Pill tone={look.tone} data-testid="domain-state"><Icon className="h-3 w-3" />{t.states[d.state].label}</Pill>
          </div>
          <div className="flex gap-1.5">
            {(
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={refresh.isPending}
                onClick={() => refresh.mutate(undefined, { onSuccess: put, onError: fail })}>
                <RefreshCw className={cn('h-3.5 w-3.5', refresh.isPending && 'animate-spin')} />{t.checkNow}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive" disabled={remove.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: t.removeTitle(d.hostname),
                  description: t.removeBody,
                  confirmLabel: t.removeConfirm,
                  destructive: true,
                });
                if (ok) remove.mutate(undefined, { onSuccess: () => { put(null); toast.success(t.removed); }, onError: fail });
              }}>
              <Trash2 className="h-3.5 w-3.5" />{removeLabel}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t.states[d.state].hint}
          {d.last_checked_at && t.lastChecked(timeAgo(d.last_checked_at, locale))}
        </p>
        {d.state === 'active' && (
          <div data-testid="client-dashboard-url" className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{t.clientDashboard}</span>{' '}
            <a href={clientDashboardUrl(d)} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono font-medium text-primary hover:underline">
              {clientDashboardUrl(d)}
            </a>
            <CopyButton text={clientDashboardUrl(d)} label={t.copyClientDashboard} className="h-7 w-7" />
          </div>
        )}
        {d.reason && d.state !== 'active' && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{d.reason}</p>
        )}
        {d.state === 'active' && (
          <button type="button" className="text-xs font-medium text-primary hover:underline" aria-expanded={showRecords} onClick={() => setShowRecords(v => !v)}>
            {showRecords ? t.hideRecords : t.showRecords}
          </button>
        )}
        {(d.state !== 'active' || showRecords) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {d.state === 'active' ? t.keepRecords : d.ownership_verification ? t.addRecords : t.addRecord}
            </p>
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
      title={t.title}
      description={t.description}
    >
      {confirmDialog}
      <div className="space-y-3">
        {body}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Panel>
  );
}
