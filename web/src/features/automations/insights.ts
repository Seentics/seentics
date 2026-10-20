import { automationsEn, type AutomationsMessages } from '@/lib/i18n/messages/automations-en';
import type { Automation } from './types';

export type AutomationGroupId = 'failing' | 'never_fired' | 'working' | 'off';
export type AutomationTone = AutomationGroupId;

/** The groups, in order. Labels and descriptions are `automations.groups[id]`. */
export const AUTOMATION_GROUP_META: Array<{ id: AutomationGroupId; dot: string }> = [
  { id: 'failing',     dot: 'bg-red-500' },
  { id: 'never_fired', dot: 'bg-amber-400' },
  { id: 'working',     dot: 'bg-emerald-500' },
  { id: 'off',         dot: 'bg-muted-foreground/40' },
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

/** One line on what an automation has done, in plain words, from its run counts. */
export function automationLine(a: Automation, t: AutomationsMessages['line'] = automationsEn.line): string {
  const s = a.stats;
  const runs = s?.totalExecutions ?? 0;
  const recent = s?.last30Days ?? 0;
  switch (automationTone(a)) {
    case 'failing':
      return t.failing(s!.failureCount, runs, Math.round(s!.successRate));
    case 'never_fired':
      return t.neverFired;
    case 'off':
      return runs > 0 ? t.offRan(runs) : t.offNever;
    case 'working':
      return t.working(runs, recent, Math.round(s?.successRate ?? 100));
  }
}
