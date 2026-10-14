import { Mail, Plug, Send, Webhook, Zap } from 'lucide-react';
import type { ProviderId } from '@/features/integrations/types';

const ICONS: Record<ProviderId, React.ElementType> = { zapier: Webhook, mailchimp: Mail, klaviyo: Send, hubspot: Plug };

/** A provider's glyph on a neutral tile. */
export function ProviderIcon({ provider, className = 'h-9 w-9' }: { provider: ProviderId; className?: string }) {
  const Icon = ICONS[provider] ?? Zap;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-muted ${className}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}
