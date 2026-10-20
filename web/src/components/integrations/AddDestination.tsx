import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_DESTINATIONS_PER_SITE } from '@/lib/integration-form';
import type { Provider } from '@/features/integrations/types';
import { useT } from '@/lib/i18n';
import { ProviderIcon } from './ProviderIcon';

/** One tile: the provider it adds, as offered, and the hint its icon is drawn from. */
type Tile = { key: string; provider: Provider; hint?: string };

/**
 * The kinds of destination a site can add. The same kind can be added more than once — two
 * webhooks for two different tools — so a tile never turns into "connected".
 *
 * The "Zapier / Webhook" kind is offered as two tiles, Zapier and Webhook: one connection type
 * behind both, but people look for each by name. Each opens the same dialog in its own words.
 */
export function AddDestination({
  providers, count, disabled, onPick,
}: { providers: Provider[]; count: number; disabled?: boolean; onPick: (provider: Provider) => void }) {
  const full = count >= MAX_DESTINATIONS_PER_SITE;
  const t = useT().settings.integrations;
  const tiles: Tile[] = providers.flatMap((p): Tile[] => {
    if (p.id !== 'zapier') return [{ key: p.id, provider: p }];
    const webhook: Provider = {
      ...p,
      label: t.webhook,
      description: t.webhookDesc,
      fields: p.fields.map((f) => (f.name === 'webhook_url' ? { ...f, label: t.webhookUrl, placeholder: 'https://…', help: t.webhookHelp } : f)),
    };
    return [
      { key: 'zapier', provider: { ...p, label: 'Zapier', description: t.zapierDesc }, hint: 'hooks.zapier.com' },
      // An empty hint draws the plain webhook tile.
      { key: 'webhook', provider: webhook, hint: '' },
    ];
  });
  return (
    <section aria-labelledby="add-destination">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="add-destination" className="text-[15px] font-semibold">{t.addTitle}</h2>
        <span className="text-xs text-muted-foreground">{t.countOf(count, MAX_DESTINATIONS_PER_SITE)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiles.map(({ key, provider: p, hint }) => (
          <div key={key} className="surface flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <ProviderIcon provider={p.id} hint={hint} className="h-10 w-10" />
              <h3 className="min-w-0 truncate text-[14px] font-semibold">{p.label}</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>
            <Button size="sm" className="mt-auto h-8 gap-1.5 self-start" onClick={() => onPick(p)} disabled={disabled || full}>
              <Plus className="h-3.5 w-3.5" aria-hidden />{t.connect}
            </Button>
          </div>
        ))}
      </div>
      {full && <p className="mt-2 text-xs text-muted-foreground">{t.full}</p>}
    </section>
  );
}
