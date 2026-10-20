import type { PopupAction } from '@/lib/popup-config';
import type { Automation } from './types';

const POPUP_TYPES = new Set(['show_modal', 'show_banner']);

type GraphNode = { kind?: string; action?: Record<string, unknown> };

/**
 * The popup an automation shows a visitor, if it shows one: the first modal or banner in its
 * stored definition (the builder's graph, or an older flat `actions` list).
 */
export function popupOf(a: Automation): PopupAction | null {
  const def = a.definition as { graph?: { nodes?: GraphNode[] }; actions?: Record<string, unknown>[] } | undefined;
  const fromDefinition = [
    ...(def?.graph?.nodes ?? []).filter((n) => n.kind === 'action').map((n) => n.action),
    ...(def?.actions ?? []),
  ].find((x): x is Record<string, unknown> => !!x && POPUP_TYPES.has(String(x.type)));
  return (fromDefinition as PopupAction | undefined) ?? null;
}
