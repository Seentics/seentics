import { ShoppingCart } from 'lucide-react';
import type { Integration } from '@/lib/integrations';

/**
 * A platform's mark. The SVG is used as a CSS mask over a background colour, so one
 * single-colour file serves both themes: brand colour where it reads on any surface,
 * and the page's foreground colour for the near-black marks (Next.js, Vercel, …) that
 * would disappear in dark mode.
 */
export function IntegrationIcon({
  integration,
  size = 20,
  tile = true,
}: {
  integration: Pick<Integration, 'name' | 'icon' | 'color' | 'mono' | 'wide'>;
  size?: number;
  tile?: boolean;
}) {
  const mark = integration.icon ? (
    <span
      aria-hidden
      className={integration.mono ? 'bg-foreground' : undefined}
      style={{
        width: integration.wide ? size * 1.6 : size,
        height: integration.wide ? size * 1.6 : size,
        display: 'block',
        backgroundColor: integration.mono ? undefined : integration.color,
        WebkitMask: `url(/integrations/${integration.icon}.svg) center / contain no-repeat`,
        mask: `url(/integrations/${integration.icon}.svg) center / contain no-repeat`,
      }}
    />
  ) : (
    <ShoppingCart aria-hidden style={{ width: size, height: size, color: integration.color }} />
  );

  if (!tile) return mark;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
      {mark}
    </span>
  );
}
