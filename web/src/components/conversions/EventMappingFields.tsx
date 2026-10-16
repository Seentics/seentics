'use client';

/**
 * Which Seentics events a destination sends, and as which platform event. Used when connecting a
 * platform and from a card's "Edit events". The defaults are the platform's standard names, so
 * most people never change anything here.
 */
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_EVENTS, type DestinationConfig, type Platform } from '@/features/conversions/types';
import { CUSTOM_EXAMPLE, KIND_HINT, KIND_LABEL } from './conversion-format';

const KINDS = ['purchase', 'lead', 'sign_up'] as const;

export function EventMappingFields({
  platform,
  value,
  onChange,
  disabled,
}: {
  platform: Platform;
  value: DestinationConfig;
  onChange: (next: DestinationConfig) => void;
  disabled?: boolean;
}) {
  const setEvent = (kind: (typeof KINDS)[number], next: string | null) =>
    onChange({ ...value, events: { ...value.events, [kind]: next } });
  const setCustom = (custom: DestinationConfig['custom']) => onChange({ ...value, custom });
  // LinkedIn sends each event to a conversion rule, by id: there is no default name to fill in.
  const rules = platform === 'linkedin';
  const sentAs = rules ? 'Conversion rule ID' : undefined;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-lg border border-border">
        {KINDS.map((kind) => {
          const on = value.events[kind] !== null;
          return (
            <li key={kind} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Switch
                  checked={on}
                  onCheckedChange={(checked) => setEvent(kind, checked ? (DEFAULT_EVENTS[platform][kind] ?? '') : null)}
                  disabled={disabled}
                  aria-label={`Send ${KIND_LABEL[kind].toLowerCase()} events`}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{KIND_LABEL[kind]}</p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{KIND_HINT[kind]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-12 sm:pl-0">
                <span className="whitespace-nowrap text-xs text-muted-foreground" aria-hidden>{rules ? 'to rule' : 'as'}</span>
                <Input
                  value={value.events[kind] ?? ''}
                  onChange={(e) => setEvent(kind, e.target.value)}
                  disabled={disabled || !on}
                  placeholder={DEFAULT_EVENTS[platform][kind] ?? sentAs}
                  inputMode={rules ? 'numeric' : undefined}
                  aria-label={`${KIND_LABEL[kind]} is sent as`}
                  className="h-8 w-full font-mono text-xs sm:w-44"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <div>
          <p className="text-[13px] font-medium text-foreground">Custom events</p>
          <p className="text-xs text-muted-foreground">
            Send one of your own <code className="font-mono">seentics.track()</code> events, for example{' '}
            <code className="font-mono">checkout_started</code> {rules ? 'to rule' : 'as'} {CUSTOM_EXAMPLE[platform]}.
          </p>
        </div>
        {value.custom.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row.name}
              onChange={(e) => setCustom(value.custom.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
              placeholder="Seentics event"
              aria-label={`Custom event ${i + 1}: Seentics event name`}
              className="h-8 flex-1 font-mono text-xs"
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground" aria-hidden>→</span>
            <Input
              value={row.platform_event}
              onChange={(e) => setCustom(value.custom.map((r, j) => (j === i ? { ...r, platform_event: e.target.value } : r)))}
              placeholder={CUSTOM_EXAMPLE[platform]}
              aria-label={`Custom event ${i + 1}: platform event name`}
              className="h-8 flex-1 font-mono text-xs"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label={`Remove custom event ${i + 1}`}
              onClick={() => setCustom(value.custom.filter((_, j) => j !== i))}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setCustom([...value.custom, { name: '', platform_event: '' }])}
          disabled={disabled || value.custom.length >= 20}
        >
          <Plus className="h-3.5 w-3.5" />Add custom event
        </Button>
      </div>
    </div>
  );
}

/** The config as it will be saved: blank names fall back to the default, empty custom rows go. */
export function cleanConfig(platform: Platform, config: DestinationConfig): DestinationConfig {
  const events = { ...config.events };
  for (const kind of KINDS) {
    const v = events[kind];
    // A kind switched on with nothing entered falls back to the default, or (LinkedIn) stays off.
    if (v !== null) events[kind] = v.trim() || DEFAULT_EVENTS[platform][kind];
  }
  const custom = config.custom
    .map((r) => ({ name: r.name.trim(), platform_event: r.platform_event.trim() }))
    .filter((r) => r.name && r.platform_event);
  return { ...config, events, custom };
}

export function defaultConfig(platform: Platform): DestinationConfig {
  return { events: { ...DEFAULT_EVENTS[platform] }, custom: [], test_event_code: null };
}
