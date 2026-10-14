/**
 * How a draft reads on its confirmation card. Pure, no React: the card renders what these return.
 *
 * Everything here works from what the server built (summary, diff, risks), never from the
 * assistant's prose, so the card cannot describe a different change than the one confirmed.
 */
import type { ActionProposal, ProposalChange, ProposalOperation, ProposalRisk } from './types';

const RESOURCE_NAME: Record<string, string> = {
  automation: 'automation',
  funnel: 'funnel',
  goal: 'goal',
  error: 'error',
  recommendation: 'suggestion',
  alert_settings: 'alert settings',
  alert_snooze: 'alert snooze',
  site_settings: 'site settings',
};

export const resourceName = (resource: string) => RESOURCE_NAME[resource] ?? resource.replace(/_/g, ' ');

/** Drafts stored before operations existed are all creates. */
export const operationOf = (p: Pick<ActionProposal, 'operation'>): ProposalOperation => p.operation ?? 'create';

const activeOf = (p: ActionProposal): boolean | null => {
  const active = (p.payload as { active?: unknown } | null)?.active;
  return typeof active === 'boolean' ? active : null;
};

/** The badge: "New automation", "Change funnel", "Switch off automation", "Snooze alerts". */
export function proposalBadge(p: ActionProposal): string {
  const name = resourceName(p.resource);
  switch (operationOf(p)) {
    case 'create':
      return p.resource === 'alert_snooze' ? 'Snooze alerts' : `New ${name}`;
    case 'update':
      return `Change ${name}`;
    case 'archive':
      return `Archive ${name}`;
    case 'set_status': {
      const active = activeOf(p);
      if (active !== null) return `Switch ${active ? 'on' : 'off'} ${name}`;
      return `Update ${name} status`;
    }
  }
}

/** The confirm button's label. */
export function confirmLabel(p: ActionProposal): string {
  const op = operationOf(p);
  if (op === 'create') return p.resource === 'alert_snooze' ? 'Snooze' : 'Create it';
  if (op === 'archive') return 'Archive it';
  if (op === 'set_status') {
    const active = activeOf(p);
    if (active !== null) return active ? 'Switch on' : 'Switch off';
    const status = (p.payload as { status?: unknown } | null)?.status;
    if (status === 'resolved') return 'Mark resolved';
    if (status === 'ignored') return 'Ignore it';
    if (status === 'unresolved') return 'Reopen it';
    if (status === 'dismissed') return 'Dismiss it';
    if (status === 'applied_manual') return 'Mark done';
  }
  return 'Apply change';
}

/** What the "nothing done yet" badge says. */
export const pendingLabel = (p: ActionProposal) =>
  operationOf(p) === 'create' ? 'Draft — nothing created yet' : 'Draft — nothing changed yet';

/** What the badge says once confirmed. */
export const doneLabel = (p: ActionProposal) => (operationOf(p) === 'create' ? 'Created' : 'Applied');

const ROLE_RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/**
 * Whether this person may confirm, and why not. `role` is '' while it loads (or for an unknown
 * role); the button is then enabled and the server decides, rather than blocking on a fetch.
 */
export function confirmPermission(role: string | undefined, p: Pick<ActionProposal, 'requiredRole'>): { allowed: boolean; reason?: string } {
  const required = p.requiredRole ?? 'member';
  if (!role || !(role in ROLE_RANK)) return { allowed: true };
  if (ROLE_RANK[role]! >= ROLE_RANK[required]!) return { allowed: true };
  return {
    allowed: false,
    reason: required === 'admin'
      ? 'Only the site owner or an admin can confirm this change.'
      : 'Viewers cannot confirm drafts. Ask a member, admin or the owner.',
  };
}

/**
 * The callouts to show, worst first. Older drafts carry only `hasExternalEffect`; an admin-only
 * draft says so even to an admin, so nobody is surprised a colleague cannot confirm it.
 */
export function riskCallouts(p: ActionProposal): ProposalRisk[] {
  const risks = [...(p.summary.risks ?? [])];
  if (p.summary.hasExternalEffect && !risks.some((r) => r.kind === 'external')) {
    risks.push({
      kind: 'external',
      message: 'This reaches outside Seentics — it sends data to, or redirects visitors to, an address above. Check it before confirming.',
    });
  }
  const order: ProposalRisk['kind'][] = ['live', 'external', 'data', 'stops', 'alerts'];
  return risks.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export const adminRequired = (p: Pick<ActionProposal, 'requiredRole'>) => p.requiredRole === 'admin';

/** One diff row, ready to draw: a scalar before → after, or a list with what was added and removed. */
export type DiffRow =
  | { kind: 'scalar'; label: string; before: string; after: string }
  | { kind: 'list'; label: string; items: Array<{ text: string; change: 'added' | 'removed' | 'kept' }> };

const NONE = '(none)';

/**
 * A server diff entry as a row. Lists (steps, actions, patterns) are merged into one list in the
 * new order, each item marked added, removed or kept, with removed items placed where they were.
 */
export function diffRow(c: ProposalChange): DiffRow {
  if (Array.isArray(c.before) || Array.isArray(c.after)) {
    const before = Array.isArray(c.before) ? c.before : c.before ? [c.before] : [];
    const after = Array.isArray(c.after) ? c.after : c.after ? [c.after] : [];
    const items: Array<{ text: string; change: 'added' | 'removed' | 'kept' }> = [];
    const remaining = [...after];
    for (const item of before) {
      const at = remaining.indexOf(item);
      if (at === -1) {
        items.push({ text: item, change: 'removed' });
        continue;
      }
      // Everything new before this kept item comes first, in its new order.
      for (const added of remaining.splice(0, at)) items.push({ text: added, change: 'added' });
      remaining.shift();
      items.push({ text: item, change: 'kept' });
    }
    for (const added of remaining) items.push({ text: added, change: 'added' });
    return { kind: 'list', label: c.label, items };
  }
  return { kind: 'scalar', label: c.label, before: c.before ?? NONE, after: c.after ?? NONE };
}

/** What happens next, once confirmed. */
export function appliedNote(resource: string, operation: ProposalOperation = 'create'): string {
  if (operation === 'create') {
    switch (resource) {
      case 'funnel':
        return 'Created and counting — open it on the Funnels page.';
      case 'goal':
        return 'Created — it appears in your goals within a few minutes.';
      case 'alert_snooze':
        return 'Snoozed — alerts it covers are still listed on the alerts page.';
      default:
        return "Created inactive — enable it on the Automations page when you're ready.";
    }
  }
  switch (resource) {
    case 'site_settings':
      return 'Saved — the tracker picks up the new settings within a few minutes.';
    case 'automation':
      return 'Applied — see it on the Automations page.';
    case 'funnel':
      return 'Applied — the funnel report is recounted with the new definition.';
    default:
      return 'Applied.';
  }
}

/** Created live: the create note must not say "inactive" for a draft that asked to go live. */
export function appliedNoteFor(p: ActionProposal): string {
  if (p.resource === 'automation' && operationOf(p) === 'create' && (p.payload as { activate?: unknown } | null)?.activate === true) {
    return 'Created and live — manage it on the Automations page.';
  }
  return appliedNote(p.resource, operationOf(p));
}
