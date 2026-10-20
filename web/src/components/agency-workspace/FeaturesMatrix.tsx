'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setClientFeatures } from '@/features/agency/api';
import { FEATURE_ACCESS_IDS, FEATURE_IDS } from '@/features/agency/constants';
import { useAgencyMutation, useClientFeatures } from '@/features/agency/queries';
import type { ClientFeatures, FeatureAccess, FeatureId } from '@/features/agency/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { ErrorNote, LoadingRow, Panel, useErrorText } from './ui';

/** Per client, per dashboard page: off, view or edit. Saved together. */
export function FeaturesMatrix({ clientId }: { clientId: string }) {
  const t = useT().agency.features;
  const errorMessage = useErrorText();
  const query = useClientFeatures(clientId);
  const [draft, setDraft] = useState<ClientFeatures | null>(null);
  const save = useAgencyMutation((features: ClientFeatures) => setClientFeatures(clientId, features));

  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);

  const dirty = !!draft && !!query.data && FEATURE_IDS.some(id => draft[id] !== query.data![id]);
  const set = (id: FeatureId, access: FeatureAccess) => setDraft(d => (d ? { ...d, [id]: access } : d));
  const setAll = (access: FeatureAccess) => setDraft(d => (d ? (Object.fromEntries(FEATURE_IDS.map(id => [id, access])) as ClientFeatures) : d));

  return (
    <Panel
      data-testid="features-matrix"
      title={t.title}
      description={t.description}
      actions={
        <>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAll('view')} disabled={!draft}>{t.allView}</Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!dirty || save.isPending}
            onClick={() => draft && save.mutate(draft, { onSuccess: () => toast.success(t.saved), onError: e => toast.error(errorMessage(e)) })}
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t.save}
          </Button>
        </>
      }
      bodyClassName="p-0"
    >
      {query.isLoading || !draft ? (
        query.isError ? <div className="p-4"><ErrorNote>{errorMessage(query.error)}</ErrorNote></div> : <LoadingRow />
      ) : (
        <ul className="divide-y divide-border">
          {FEATURE_IDS.map(id => ({ id, ...t.items[id] })).map(f => (
            <li key={f.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.description}</p>
              </div>
              <div role="radiogroup" aria-label={f.label} className="inline-flex shrink-0 self-start rounded-md border border-border p-0.5 sm:self-center">
                {FEATURE_ACCESS_IDS.map(id => ({ id, label: t.access[id] })).map(a => {
                  const on = draft[f.id] === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${f.label}: ${a.label}`}
                      onClick={() => set(f.id, a.id)}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        on ? (a.id === 'off' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground') : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
