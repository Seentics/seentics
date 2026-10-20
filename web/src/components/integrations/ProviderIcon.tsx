import { Webhook } from 'lucide-react';
import type { ProviderId } from '@/features/integrations/types';
import { cn } from '@/lib/utils';

type Brand = { file: string; tile: string; glyph: string; label: string };

/**
 * Each provider's own mark on its brand colour. The marks are the companies' logos: from Simple
 * Icons (simple-icons@15.0.0), and Klaviyo's flag from its site's app icon, all in
 * public/images/providers. Drawn as a mask, so one file gives the glyph in any colour.
 */
const BRANDS: Record<string, Brand> = {
  zapier: { file: 'zapier.svg', tile: '#FF4F00', glyph: '#FFFFFF', label: 'Zapier' },
  mailchimp: { file: 'mailchimp.svg', tile: '#FFE01B', glyph: '#241C15', label: 'Mailchimp' },
  klaviyo: { file: 'klaviyo.png', tile: '#232426', glyph: '#FFFFFF', label: 'Klaviyo' },
  hubspot: { file: 'hubspot.svg', tile: '#FF7A59', glyph: '#FFFFFF', label: 'HubSpot' },
  slack: { file: 'slack.svg', tile: '#4A154B', glyph: '#FFFFFF', label: 'Slack' },
  make: { file: 'make.svg', tile: '#6D00CC', glyph: '#FFFFFF', label: 'Make' },
  discord: { file: 'discord.svg', tile: '#5865F2', glyph: '#FFFFFF', label: 'Discord' },
  n8n: { file: 'n8n.svg', tile: '#EA4B71', glyph: '#FFFFFF', label: 'n8n' },
};

/** The webhook's host, from its hint (Core saves "hooks.slack.com …/b71d90"); null for an older hint. */
export function webhookHost(hint: string | null | undefined): string | null {
  const first = hint?.trim().split(/\s+/)[0] ?? '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(first) ? first.toLowerCase() : null;
}

/** Which tool a webhook goes to, by its host: Zapier, Slack, Make, Discord, n8n; null for any other. */
function webhookBrand(host: string): string | null {
  if (host === 'hooks.zapier.com' || host.endsWith('.zapier.com')) return 'zapier';
  if (host === 'hooks.slack.com') return 'slack';
  if (host.endsWith('make.com') || host.endsWith('integromat.com')) return 'make';
  if (host === 'discord.com' || host === 'discordapp.com') return 'discord';
  if (host.includes('n8n')) return 'n8n';
  return null;
}

/**
 * A destination's brand: the provider's own, except a webhook (the "Zapier / Webhook" kind), which
 * is the tool its URL points at, or none when that is unknown.
 */
export function destinationBrand(provider: ProviderId, hint?: string | null): { key: string | null; label: string | null } {
  if (provider !== 'zapier' || hint === undefined) return { key: provider, label: BRANDS[provider]?.label ?? null };
  const host = webhookHost(hint);
  const key = host ? webhookBrand(host) : null;
  return { key, label: key ? BRANDS[key]!.label : host };
}

/**
 * A provider's logo on its brand-coloured tile. Given a destination's `hint`, a webhook shows the
 * tool it points at (Slack, Make…), or a plain webhook tile when that is unknown.
 */
export function ProviderIcon({ provider, hint, className = 'h-9 w-9' }: { provider: ProviderId; hint?: string | null; className?: string }) {
  const { key } = destinationBrand(provider, hint);
  const brand = key ? BRANDS[key] : undefined;
  if (!brand) {
    return (
      <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70', className)}>
        <Webhook className="h-[50%] w-[50%]" />
      </span>
    );
  }
  // Klaviyo's file is its whole app icon, the flag about 62% of its width; scaled so the flag
  // matches the bare marks of the others (58% of the tile).
  const size = key === 'klaviyo' ? '94%' : '58%';
  const mask = `url(/images/providers/${brand.file}) center / ${size} no-repeat`;
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-lg', className)} style={{ background: brand.tile }}>
      <span className="h-full w-full" style={{ background: brand.glyph, WebkitMask: mask, mask }} />
    </span>
  );
}
