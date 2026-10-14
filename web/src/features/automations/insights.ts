import type { Automation } from './types';

export type AutomationGroupId = 'failing' | 'never_fired' | 'working' | 'off';
export type AutomationTone = AutomationGroupId;

export const AUTOMATION_GROUP_META: Array<{ id: AutomationGroupId; label: string; description: string; dot: string }> = [
  { id: 'failing',     label: 'Failing',            description: 'At least one in ten runs fails',        dot: 'bg-red-500' },
  { id: 'never_fired', label: 'Live, never fired',   description: 'Switched on, but its trigger has not happened', dot: 'bg-amber-400' },
  { id: 'working',     label: 'Working',            description: 'Live and running cleanly',               dot: 'bg-emerald-500' },
  { id: 'off',         label: 'Switched off',       description: 'Not running',                            dot: 'bg-muted-foreground/40' },
];

const FAILING_RATE = 90;

export function automationTone(a: Automation): AutomationTone {
  const s = a.stats;
  const runs = s?.totalExecutions ?? 0;
  if (runs > 0 && (s?.failureCount ?? 0) > 0 && (s?.successRate ?? 100) < FAILING_RATE) return 'failing';
  if (!a.isActive) return 'off';
  return runs === 0 ? 'never_fired' : 'working';
}

export const inAutomationGroup = (a: Automation, id: AutomationGroupId) => automationTone(a) === id;

export const AUTOMATION_TONE_DOT: Record<AutomationTone, string> = Object.fromEntries(
  AUTOMATION_GROUP_META.map((g) => [g.id, g.dot]),
) as Record<AutomationTone, string>;
export const AUTOMATION_TONE_RANK: Record<AutomationTone, number> = { failing: 3, never_fired: 2, working: 1, off: 0 };

const times = (n: number) => `${n.toLocaleString()} time${n === 1 ? '' : 's'}`;

/** One line on what an automation has done, in plain words, from its run counts. */
export function automationLine(a: Automation): string {
  const s = a.stats;
  const runs = s?.totalExecutions ?? 0;
  const recent = s?.last30Days ?? 0;
  switch (automationTone(a)) {
    case 'failing':
      return `Failing — ${s!.failureCount.toLocaleString()} of ${runs.toLocaleString()} runs failed (${Math.round(s!.successRate)}% succeeded)`;
    case 'never_fired':
      return 'Live, but its trigger has not happened yet';
    case 'off':
      return runs > 0 ? `Switched off · ran ${times(runs)} before` : 'Switched off · never ran';
    case 'working':
      return `Ran ${times(runs)}${recent ? ` · ${recent.toLocaleString()} in the last 30 days` : ''} · ${Math.round(s?.successRate ?? 100)}% succeeded`;
  }
}
