import { FunnelBlock } from './FunnelBlock';
import { LinksBlock } from './LinksBlock';
import { MetricsBlock } from './MetricsBlock';
import { TableBlock } from './TableBlock';
import { TimeseriesBlock } from './TimeseriesBlock';
import type { DisplayBlock } from '@/features/ai/types';

/**
 * Draws one display block.
 *
 * A switch over a closed union, with one prebuilt component per kind. The model does not
 * choose this and cannot author it — a tool emits the descriptor and this maps it. Adding
 * a visualisation is a component and a case here.
 *
 * An unrecognised kind renders nothing rather than throwing. A newer server can send a
 * block an older client has no component for, and an answer missing one panel is better
 * than a chat that crashes.
 */
export function BlockRenderer({ block, className }: { block: DisplayBlock; className?: string }) {
  switch (block.kind) {
    case 'metrics':    return <MetricsBlock block={block} className={className} />;
    case 'table':      return <TableBlock block={block} className={className} />;
    case 'timeseries': return <TimeseriesBlock block={block} className={className} />;
    case 'funnel':     return <FunnelBlock block={block} className={className} />;
    case 'links':      return <LinksBlock block={block} className={className} />;
    default:           return null;
  }
}
