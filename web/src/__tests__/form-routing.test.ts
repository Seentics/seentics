import { describe, expect, it } from 'vitest';
import { demoAutomations } from '@/lib/demo';
import { describeRouting, formInfoOf, setRoutingMode, toggleDestination } from '@/lib/form-routing';
import { defaultLeadForm } from '@/lib/lead-form';
import type { Connection } from '@/features/integrations/types';

const conn = (id: string, enabled = true): Connection => ({
  id, provider: 'zapier', name: id, enabled, status: 'active', config: {}, credentials_hint: '', consecutive_failures: 0,
  last_error: null, last_attempt_at: null, last_success_at: null, pending_count: 0, created_at: '', updated_at: '',
});
const a = conn('a');
const b = conn('b');
const off = conn('off', false);

describe('describeRouting', () => {
  it('sends to every enabled destination when none are chosen', () => {
    const r = describeRouting(undefined, [a, b, off]);
    expect(r.mode).toBe('all');
    expect(r.receiving.map((c) => c.id)).toEqual(['a', 'b']);
    expect(r.warning).toBeNull();
  });

  it('sends to exactly the chosen destinations, ignoring ids that no longer exist', () => {
    const r = describeRouting(['b', 'gone'], [a, b]);
    expect(r.mode).toBe('selected');
    expect(r.receiving.map((c) => c.id)).toEqual(['b']);
    expect(r.missing).toBe(1);
    expect(r.warning).toBeNull();
  });

  it('separates chosen destinations that are switched off', () => {
    const r = describeRouting(['a', 'off'], [a, off]);
    expect(r.receiving.map((c) => c.id)).toEqual(['a']);
    expect(r.paused.map((c) => c.id)).toEqual(['off']);
  });

  it('warns, with the reason, whenever a submission would go nowhere', () => {
    expect(describeRouting(undefined, [])?.warning).toMatch(/No destination is connected/);
    expect(describeRouting(undefined, [off]).warning).toMatch(/switched off/);
    expect(describeRouting([], [a]).warning).toMatch(/No destination is selected/);
    expect(describeRouting(['off'], [a, off]).warning).toMatch(/switched off or were removed/);
    expect(describeRouting(['gone'], [a]).warning).toMatch(/switched off or were removed/);
  });
});

describe('routing edits', () => {
  it('switching to "choose" starts from every current destination, and back to "all" forgets the list', () => {
    const chosen = setRoutingMode(defaultLeadForm(), 'selected', [a, b]);
    expect(chosen.destinations).toEqual(['a', 'b']);
    expect('destinations' in setRoutingMode(chosen, 'all', [a, b])).toBe(false);
  });

  it('toggles one destination without touching the others', () => {
    const form = { ...defaultLeadForm(), destinations: ['a'] };
    expect(toggleDestination(form, 'b', [a, b]).destinations).toEqual(['a', 'b']);
    expect(toggleDestination(form, 'a', [a, b]).destinations).toEqual([]);
  });
});

describe('formInfoOf', () => {
  const modal = (action: Record<string, unknown>) => ({ graph: { entry: 'n0', nodes: [{ id: 'n0', kind: 'action', action: { type: 'show_modal', ...action } }], edges: [] } });

  it('finds a form, its routing and whether it pays a prize', () => {
    expect(formInfoOf(modal({ form: { destinations: ['a'] }, layout: 'spin_wheel', wheel: { segments: [] } })))
      .toEqual({ hasForm: true, hasRewards: true, destinations: ['a'] });
    expect(formInfoOf(modal({ form: {}, coupon: { code: 'HI', description: '' } }))).toEqual({ hasForm: true, hasRewards: true, destinations: undefined });
  });

  it('is not fooled by a wheel left behind after switching layout, or a modal with no form', () => {
    expect(formInfoOf(modal({ form: {}, layout: 'modal', wheel: { segments: [] } })).hasRewards).toBe(false);
    expect(formInfoOf(modal({ title: 'Hi' })).hasForm).toBe(false);
    expect(formInfoOf(undefined).hasForm).toBe(false);
    expect(formInfoOf({ graph: { nodes: 'nope' } }).hasForm).toBe(false);
  });

  it('reads the routing the demo popups are saved with', () => {
    const popups = demoAutomations().automations as { id: string; definition?: unknown }[];
    for (const id of ['demo-auto-5', 'demo-auto-6']) {
      const info = formInfoOf(popups.find((p) => p.id === id)!.definition);
      expect(info.hasForm).toBe(true);
      expect(info.destinations?.length).toBe(2);
    }
  });
});
