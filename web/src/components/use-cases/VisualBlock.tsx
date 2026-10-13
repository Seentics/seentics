import { AlertMock, FunnelViz } from './Diagrams';
import { LeadsInboxMock, PopupExample } from './PopupExample';
import { Shot } from './Shot';
import type { Visual } from '@/lib/use-case-details';

/** Renders one entry of a page's visuals: a screenshot, a popup example, a funnel, an alert or the inbox. */
export function VisualBlock({ v, priority = false }: { v: Visual; priority?: boolean }) {
  switch (v.kind) {
    case 'shot': return <Shot name={v.shot.name} alt={v.shot.alt} url={v.shot.url} annotations={v.shot.annotations} priority={priority} crop={v.shot.crop} />;
    case 'example': return <PopupExample {...v.props} />;
    case 'funnel': return <FunnelViz steps={v.steps} caption={v.caption} />;
    case 'alert': return <AlertMock title={v.title} lines={v.lines} channel={v.channel} />;
    case 'inbox': return <LeadsInboxMock />;
  }
}
