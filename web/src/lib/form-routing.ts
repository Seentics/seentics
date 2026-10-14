/**
 * Where a lead form's submissions go, as the builder and the automation page describe it.
 *
 * Pure functions over plain data so the rules — absent means "every enabled destination",
 * a stale id is ignored, an explicit empty list means "nowhere" — are tested without rendering.
 * They mirror the server's routing in core's leads module.
 */
import type { Connection } from '@/features/integrations/types';
import type { LeadForm } from '@/lib/lead-form';

/** How long core keeps a stored submission; shown wherever the UI says where submissions are. */
export const SUBMISSION_RETENTION_DAYS = 90;

export type RoutingState = {
  mode: 'all' | 'selected';
  /** Destinations that will receive a submission right now. */
  receiving: Connection[];
  /** Chosen destinations that are paused or switched off, so they will not. */
  paused: Connection[];
  /** Chosen ids that no longer exist. */
  missing: number;
  /** Why submissions will go nowhere, or null when at least one destination receives them. */
  warning: string | null;
};

export function describeRouting(destinations: readonly string[] | undefined, connections: readonly Connection[]): RoutingState {
  const mode = destinations === undefined ? 'all' : 'selected';
  const chosen = destinations === undefined ? [...connections] : connections.filter((c) => destinations.includes(c.id));
  const receiving = chosen.filter((c) => c.enabled);
  const paused = chosen.filter((c) => !c.enabled);
  const missing = destinations ? destinations.filter((id) => !connections.some((c) => c.id === id)).length : 0;

  let warning: string | null = null;
  if (receiving.length === 0) {
    if (connections.length === 0) warning = `No destination is connected. Submissions are kept here for ${SUBMISSION_RETENTION_DAYS} days but sent nowhere.`;
    else if (mode === 'all') warning = `Every destination is switched off. Submissions are kept here for ${SUBMISSION_RETENTION_DAYS} days but sent nowhere.`;
    else if (destinations!.length === 0) warning = `No destination is selected. Submissions are kept here for ${SUBMISSION_RETENTION_DAYS} days but sent nowhere.`;
    else warning = `The selected destinations are switched off or were removed. Submissions are kept here for ${SUBMISSION_RETENTION_DAYS} days but sent nowhere.`;
  }
  return { mode, receiving, paused, missing, warning };
}

/** Switch to sending everywhere, or to a chosen list that starts with every current destination. */
export function setRoutingMode(form: LeadForm, mode: 'all' | 'selected', connections: readonly Connection[]): LeadForm {
  if (mode === 'all') {
    const { destinations: _drop, ...rest } = form;
    return rest;
  }
  return { ...form, destinations: connections.map((c) => c.id) };
}

/** Tick or untick one destination. Only meaningful in "selected" mode; in "all" it selects the rest. */
export function toggleDestination(form: LeadForm, id: string, connections: readonly Connection[]): LeadForm {
  const current = form.destinations ?? connections.map((c) => c.id);
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  return { ...form, destinations: next };
}

/** What the automation page needs to know about the lead form(s) in a definition. */
export type FormInfo = {
  hasForm: boolean;
  /** Whether a wheel or coupon pays out a prize, so "Prizes won" means something. */
  hasRewards: boolean;
  /** `undefined` = every destination; otherwise the ids chosen on the first form. */
  destinations: string[] | undefined;
};

type ActionLike = { type?: unknown; layout?: unknown; form?: { destinations?: unknown } | null; wheel?: unknown; coupon?: unknown };

/** Look through a stored definition's graph for `show_modal` actions that carry a form. */
export function formInfoOf(definition: unknown): FormInfo {
  const nodes = (definition as { graph?: { nodes?: { action?: ActionLike }[] } } | null | undefined)?.graph?.nodes;
  const withForm = (Array.isArray(nodes) ? nodes : [])
    .map((n) => n?.action)
    .filter((a): a is ActionLike => !!a && a.type === 'show_modal' && !!a.form);
  const first = withForm[0];
  const destinations = Array.isArray(first?.form?.destinations) ? (first!.form!.destinations as string[]) : undefined;
  return {
    hasForm: withForm.length > 0,
    // The wheel is kept when the owner switches layout, so it only pays out while the layout is a wheel.
    hasRewards: withForm.some((a) => (a.layout === 'spin_wheel' && !!a.wheel) || !!(a.coupon as { code?: string } | undefined)?.code),
    destinations,
  };
}
