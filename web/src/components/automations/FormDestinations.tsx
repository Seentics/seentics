import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useIntegrations } from '@/features/integrations/queries';
import { describeRouting, setRoutingMode, toggleDestination } from '@/lib/form-routing';
import type { LeadForm } from '@/lib/lead-form';
import { usePathSegment } from '@/lib/path-segment';
import { ProviderIcon } from '@/components/integrations/ProviderIcon';
import { useT } from '@/lib/i18n';

/**
 * "Send submissions to": every destination on the site (the default), or a chosen few.
 *
 * Choosing nothing is allowed and means exactly that, so the warning below says where the
 * submissions will be instead — on this form's page, for 90 days. Destinations are managed in
 * Settings > Integrations; this only picks among them.
 */
export function FormDestinations({ form, onChange }: { form: LeadForm; onChange: (form: LeadForm) => void }) {
  const m = useT().automations.destinations;
  const websiteId = usePathSegment(1) ?? '';
  const { data, isLoading } = useIntegrations(websiteId);
  const connections = data?.connections ?? [];
  const routing = describeRouting(form.destinations, connections);
  const settings = `/websites/${websiteId}/integrations`;

  return (
    <fieldset className="space-y-2 rounded-md border border-border/60 p-2">
      <legend className="px-1 text-[11px] font-medium text-muted-foreground">{m.legend}</legend>

      <div className="flex gap-1 rounded-md bg-muted p-0.5" role="radiogroup" aria-label={m.aria}>
        {(['all', 'selected'] as const).map((mode) => (
          <button
            key={mode} type="button" role="radio" aria-checked={routing.mode === mode}
            onClick={() => routing.mode !== mode && onChange(setRoutingMode(form, mode, connections))}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${routing.mode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {mode === 'all' ? m.all : m.choose}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">{m.loading}</p>
      ) : connections.length === 0 ? null : routing.mode === 'all' ? (
        <p className="text-[11px] text-muted-foreground">
          {m.sendsTo(routing.receiving.length, routing.receiving.map((c) => c.name).join(', '))}
        </p>
      ) : (
        <ul className="space-y-1">
          {connections.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50">
                <input
                  type="checkbox" className="h-3.5 w-3.5 accent-primary"
                  checked={form.destinations?.includes(c.id) ?? false}
                  onChange={() => onChange(toggleDestination(form, c.id, connections))}
                />
                <ProviderIcon provider={c.provider} hint={c.credentials_hint} className="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {!c.enabled && <span className="text-[10px] text-amber-600 dark:text-amber-400">{m.off}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && routing.warning && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400" role="alert">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{routing.warning}</span>
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        <Link href={settings} className="text-primary hover:underline">{m.manage}</Link>
        {' '}{m.manageTail}
      </p>
    </fieldset>
  );
}
