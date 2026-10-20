import type { PopupAction } from '@/lib/popup-config';
import type { Automation } from './types';

const POPUP_TYPES = new Set(['show_modal', 'show_banner']);

type GraphNode = { kind?: string; action?: Record<string, unknown> };

/**
 * The popup an automation shows a visitor, if it shows one: the first modal or banner in its
 * stored definition (the builder's graph, or an older flat `actions` list). Automations saved
 * before definitions were kept fall back to their summary action, which has only a title.
 */
export function popupOf(a: Automation): PopupAction | null {
  const def = a.definition as { graph?: { nodes?: GraphNode[] }; actions?: Record<string, unknown>[] } | undefined;
  const fromDefinition = [
    ...(def?.graph?.nodes ?? []).filter((n) => n.kind === 'action').map((n) => n.action),
    ...(def?.actions ?? []),
  ].find((x): x is Record<string, unknown> => !!x && POPUP_TYPES.has(String(x.type)));
  if (fromDefinition) return fromDefinition as PopupAction;

  const summary = (a.actions ?? []).find((x) => x.actionType === 'modal' || x.actionType === 'banner');
  if (!summary) return null;
  const c = summary.actionConfig ?? {};
  return summary.actionType === 'banner'
    ? { type: 'show_banner', message: c.message ?? c.title ?? '', ...c }
    : { type: 'show_modal', title: c.title ?? '', body: c.body ?? '', button_text: c.button_text ?? '', ...c };
}
