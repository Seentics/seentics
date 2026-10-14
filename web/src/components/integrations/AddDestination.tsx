import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_DESTINATIONS_PER_SITE } from '@/lib/integration-form';
import type { Provider } from '@/features/integrations/types';
import { ProviderIcon } from './ProviderIcon';

/**
 * The kinds of destination a site can add. The same kind can be added more than once — two
 * webhooks for two different tools — so a tile never turns into "connected".
 */
export function AddDestination({
  providers, count, disabled, onPick,
}: { providers: Provider[]; count: number; disabled?: boolean; onPick: (provider: Provider) => void }) {
  const full = count >= MAX_DESTINATIONS_PER_SITE;
  return (
    <section aria-labelledby="add-destination">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="add-destination" className="text-sm font-semibold">Add a destination</h2>
        <span className="text-xs text-muted-foreground">{count} of {MAX_DESTINATIONS_PER_SITE}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {providers.map((p) => (
          <div key={p.id} className="surface flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <ProviderIcon provider={p.id} />
              <h3 className="min-w-0 truncate text-sm font-semibold">{p.label}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{p.description}</p>
            <Button size="sm" variant="outline" className="mt-auto gap-1.5 self-start" onClick={() => onPick(p)} disabled={disabled || full}>
              <Plus className="h-3.5 w-3.5" aria-hidden />Add
            </Button>
          </div>
        ))}
      </div>
      {full && <p className="mt-2 text-xs text-muted-foreground">You have reached the limit. Delete one to add another.</p>}
    </section>
  );
}
