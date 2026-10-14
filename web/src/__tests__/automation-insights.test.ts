import { describe, expect, it } from 'vitest';
import { automationLine, automationTone } from '@/features/automations/insights';

const a = (isActive: boolean, stats?: Partial<{ totalExecutions: number; successCount: number; failureCount: number; successRate: number; last30Days: number }>) =>
  ({ id: 'a', name: 'Exit offer', isActive, stats: stats && { totalExecutions: 0, successCount: 0, failureCount: 0, successRate: 100, last30Days: 0, ...stats } }) as never;

describe('automation lines', () => {
  it('reads a healthy automation from its runs', () => {
    expect(automationLine(a(true, { totalExecutions: 1284, successRate: 100, last30Days: 612 })))
      .toBe('Ran 1,284 times · 612 in the last 30 days · 100% succeeded');
    expect(automationTone(a(true, { totalExecutions: 1284 }))).toBe('working');
  });

  it('calls out failures first, even when switched off', () => {
    const failing = a(false, { totalExecutions: 50, failureCount: 12, successRate: 76 });
    expect(automationTone(failing)).toBe('failing');
    expect(automationLine(failing)).toBe('Failing — 12 of 50 runs failed (76% succeeded)');
  });

  it('tells live-but-silent apart from switched off', () => {
    expect(automationLine(a(true, { totalExecutions: 0 }))).toBe('Live, but its trigger has not happened yet');
    expect(automationLine(a(false))).toBe('Switched off · never ran');
    expect(automationLine(a(false, { totalExecutions: 9 }))).toBe('Switched off · ran 9 times before');
  });
});
