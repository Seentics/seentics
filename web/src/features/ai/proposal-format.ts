/**
 * How a draft reads on its confirmation card. Pure, no React: the card renders what these return.
 *
 * Everything here works from what the server built (summary, diff, risks), never from the
 * assistant's prose, so the card cannot describe a different change than the one confirmed.
 */
import { aiEn, type AiMessages } from '@/lib/i18n/messages/ai-en';
import type { ActionProposal, ProposalChange, ProposalOperation, ProposalRisk } from './types';

/**
 * Every label here takes `t` (`useT().ai.proposal`) last for the viewer's language, English
 * without it.
 */
type T = AiMessages['proposal'];
const EN: T = aiEn.proposal;

export const resourceName = (resource: string, t: T = EN) => t.resource[resource] ?? resource.replace(/_/g, ' ');

/** Drafts stored before operations existed are all creates. */
export const operationOf = (p: Pick<ActionProposal, 'operation'>): ProposalOperation => p.operation ?? 'create';

const activeOf = (p: ActionProposal): boolean | null => {
  const active = (p.payload as { active?: unknown } | null)?.active;
  return typeof active === 'boolean' ? active : null;
};

/** The badge: "New automation", "Change funnel", "Switch off automation", "Snooze alerts". */
export function proposalBadge(p: ActionProposal, t: T = EN): string {
  const name = resourceName(p.resource, t);
  switch (operationOf(p)) {
    case 'create':
      return p.resource === 'alert_snooze' ? t.badge.snooze : t.badge.create(name);
    case 'update':
      return t.badge.update(name);
    case 'archive':
      return t.badge.archive(name);
    case 'set_status': {
      const active = activeOf(p);
      if (active !== null) return active ? t.badge.switchOn(name) : t.badge.switchOff(name);
      return t.badge.status(name);
    }
  }
}

/** The confirm button's label. */
export function confirmLabel(p: ActionProposal, t: T = EN): string {
  const c = t.confirm;
  const op = operationOf(p);
  if (op === 'create') return p.resource === 'alert_snooze' ? c.snooze : c.create;
  if (op === 'archive') return c.archive;
  if (op === 'set_status') {
    const active = activeOf(p);
    if (active !== null) return active ? c.switchOn : c.switchOff;
    const status = (p.payload as { status?: unknown } | null)?.status;
    if (status === 'resolved') return c.resolved;
    if (status === 'ignored') return c.ignored;
    if (status === 'unresolved') return c.unresolved;
    if (status === 'dismissed') return c.dismissed;
    if (status === 'applied_manual') return c.applied_manual;
  }
  return c.apply;
}

/** What the "nothing done yet" badge says. */
export const pendingLabel = (p: ActionProposal, t: T = EN) =>
  operationOf(p) === 'create' ? t.pendingCreate : t.pendingChange;

/** What the badge says once confirmed. */
export const doneLabel = (p: ActionProposal, t: T = EN) => (operationOf(p) === 'create' ? t.created : t.applied);

const ROLE_RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/**
 * Whether this person may confirm, and why not. `role` is '' while it loads (or for an unknown
 * role); the button is then enabled and the server decides, rather than blocking on a fetch.
 */
export function confirmPermission(
  role: string | undefined, p: Pick<ActionProposal, 'requiredRole'>, t: T = EN,
): { allowed: boolean; reason?: string } {
  const required = p.requiredRole ?? 'member';
  if (!role || !(role in ROLE_RANK)) return { allowed: true };
  if (ROLE_RANK[role]! >= ROLE_RANK[required]!) return { allowed: true };
  return {
    allowed: false,
    reason: required === 'admin' ? t.adminOnly : t.viewerCannot,
  };
}

/**
 * The callouts to show, worst first. Older drafts carry only `hasExternalEffect`; an admin-only
 * draft says so even to an admin, so nobody is surprised a colleague cannot confirm it.
 */
export function riskCallouts(p: ActionProposal, t: T = EN): ProposalRisk[] {
  const risks = [...(p.summary.risks ?? [])];
  if (p.summary.hasExternalEffect && !risks.some((r) => r.kind === 'external')) {
    risks.push({
      kind: 'external',
      message: t.externalRisk,
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


/**
 * A server diff entry as a row. Lists (steps, actions, patterns) are merged into one list in the
 * new order, each item marked added, removed or kept, with removed items placed where they were.
 */
export function diffRow(c: ProposalChange, t: T = EN): DiffRow {
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
  return { kind: 'scalar', label: c.label, before: c.before ?? t.none, after: c.after ?? t.none };
}

/** What happens next, once confirmed. */
export function appliedNote(resource: string, operation: ProposalOperation = 'create', t: T = EN): string {
  const n = t.note;
  if (operation === 'create') {
    switch (resource) {
      case 'funnel':
        return n.funnelCreated;
      case 'goal':
        return n.goalCreated;
      case 'alert_snooze':
        return n.snoozed;
      default:
        return n.createdInactive;
    }
  }
  switch (resource) {
    case 'site_settings':
      return n.settingsSaved;
    case 'automation':
      return n.automationApplied;
    case 'funnel':
      return n.funnelApplied;
    default:
      return n.applied;
  }
}

/** Created live: the create note must not say "inactive" for a draft that asked to go live. */
export function appliedNoteFor(p: ActionProposal, t: T = EN): string {
  if (p.resource === 'automation' && operationOf(p) === 'create' && (p.payload as { activate?: unknown } | null)?.activate === true) {
    return t.note.createdLive;
  }
  return appliedNote(p.resource, operationOf(p), t);
}
