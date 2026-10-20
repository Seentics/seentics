'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { verifyWebsite } from '@/features/agency/api';
import { INSTALL_METHODS } from '@/features/agency/constants';
import { agencyKeys, useAgencyMutation, useInstall } from '@/features/agency/queries';
import type { InstallMethod, Verification, WebsiteInstall } from '@/features/agency/types';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CodeBlock, ErrorNote, LoadingRow, Pill, timeAgo, useErrorText, type Tone } from './ui';

const VERIFICATION: Record<Verification['status'], { tone: Tone; icon: typeof CheckCircle2 }> = {
  receiving: { tone: 'green', icon: CheckCircle2 },
  not_seen: { tone: 'amber', icon: Clock },
  stale: { tone: 'red', icon: XCircle },
};

export function VerificationBadge({ verification }: { verification: Verification }) {
  const t = useT().agency.install;
  const v = VERIFICATION[verification.status];
  const Icon = v.icon;
  return <Pill tone={v.tone} data-testid="verification-status"><Icon className="h-3 w-3" />{t.verification[verification.status].label}</Pill>;
}

/**
 * How to install one website and whether it works: the snippet with copy, per-platform
 * instructions, and the tracking check. `initial` is the install a create call answered with.
 */
export function InstallPanel({ websiteId, initial }: { websiteId: string; initial?: WebsiteInstall }) {
  const t = useT().agency.install;
  const { locale } = useLocale();
  const errorMessage = useErrorText();
  const queryClient = useQueryClient();
  const query = useInstall(initial ? null : websiteId);
  const [fresh, setFresh] = useState<WebsiteInstall | undefined>(initial);
  const install = fresh ?? query.data;
  const [method, setMethod] = useState<InstallMethod>('html');
  const [error, setError] = useState<string | null>(null);
  const verify = useAgencyMutation(verifyWebsite);

  if (!install) {
    if (query.isError) return <ErrorNote>{errorMessage(query.error)}</ErrorNote>;
    return <LoadingRow label={t.loading} />;
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
            {t.verification[v.status].hint}
            {v.last_event_at && t.lastEvent(timeAgo(v.last_event_at, locale))}
            {v.status === 'receiving' && t.events24h(v.events_24h.toLocaleString('en'))}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={check} disabled={verify.isPending}>
          {verify.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t.verify}
        </Button>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">{t.snippet}</p>
        <CodeBlock code={install.snippet_html} label={t.copySnippet} />
        <p className="text-[11px] text-muted-foreground">{t.trackingId} <code className="font-mono">{install.tracking_id}</code></p>
      </div>

      <div className="space-y-2">
        <div role="tablist" aria-label={t.platform} className="flex flex-wrap gap-1">
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
              {t.fullGuide}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
