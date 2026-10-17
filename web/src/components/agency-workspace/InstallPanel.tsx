'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { errorMessage, verifyWebsite } from '@/features/agency/api';
import { INSTALL_METHODS } from '@/features/agency/constants';
import { agencyKeys, useAgencyMutation, useInstall } from '@/features/agency/queries';
import type { InstallMethod, Verification, WebsiteInstall } from '@/features/agency/types';
import { cn } from '@/lib/utils';
import { CodeBlock, ErrorNote, LoadingRow, Pill, type Tone } from './ui';

const VERIFICATION: Record<Verification['status'], { label: string; tone: Tone; icon: typeof CheckCircle2; hint: string }> = {
  receiving: { label: 'Receiving events', tone: 'green', icon: CheckCircle2, hint: 'Tracking works.' },
  not_seen: { label: 'No events yet', tone: 'amber', icon: Clock, hint: 'Install the snippet, open the site in a browser, then check again.' },
  stale: { label: 'Stopped', tone: 'red', icon: XCircle, hint: 'Events used to arrive but none came in the last 24 hours. Check that the snippet is still on the site.' },
};

export function VerificationBadge({ verification }: { verification: Verification }) {
  const v = VERIFICATION[verification.status];
  const Icon = v.icon;
  return <Pill tone={v.tone} data-testid="verification-status"><Icon className="h-3 w-3" />{v.label}</Pill>;
}

/**
 * How to install one website and whether it works: the snippet with copy, per-platform
 * instructions, and the tracking check. `initial` is the install a create call answered with.
 */
export function InstallPanel({ websiteId, initial }: { websiteId: string; initial?: WebsiteInstall }) {
  const queryClient = useQueryClient();
  const query = useInstall(initial ? null : websiteId);
  const [fresh, setFresh] = useState<WebsiteInstall | undefined>(initial);
  const install = fresh ?? query.data;
  const [method, setMethod] = useState<InstallMethod>('html');
  const [error, setError] = useState<string | null>(null);
  const verify = useAgencyMutation(verifyWebsite);

  if (!install) {
    if (query.isError) return <ErrorNote>{errorMessage(query.error)}</ErrorNote>;
    return <LoadingRow label="Loading install instructions…" />;
  }

  const v = install.verification;
  const check = () => {
    setError(null);
    verify.mutate(websiteId, {
      onSuccess: verification => {
        const next = { ...install, verification };
        setFresh(next);
        queryClient.setQueryData(agencyKeys.install(websiteId), next);
      },
      onError: e => setError(errorMessage(e)),
    });
  };

  return (
    <div className="space-y-4" data-testid="install-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <VerificationBadge verification={v} />
          <p className="text-[11px] text-muted-foreground">
            {VERIFICATION[v.status].hint}
            {v.last_event_at && ` Last event ${formatDistanceToNow(new Date(v.last_event_at), { addSuffix: true })}.`}
            {v.status === 'receiving' && ` ${v.events_24h.toLocaleString()} events in 24 hours.`}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={check} disabled={verify.isPending}>
          {verify.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Verify installation
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">Tracking snippet</p>
        <CodeBlock code={install.snippet_html} label="Copy snippet" />
        <p className="text-[11px] text-muted-foreground">Tracking ID <code className="font-mono">{install.tracking_id}</code></p>
      </div>

      <div className="space-y-2">
        <div role="tablist" aria-label="Platform" className="flex flex-wrap gap-1">
          {INSTALL_METHODS.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={method === m.id}
              onClick={() => setMethod(m.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                method === m.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="rounded-md border border-border p-3 text-xs" data-testid="install-instructions">
          <p className="whitespace-pre-wrap break-words text-foreground">{install.instructions[method]?.summary}</p>
          {install.instructions[method]?.docs_url && (
            <a href={install.instructions[method].docs_url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-primary hover:underline">
              Full guide
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
