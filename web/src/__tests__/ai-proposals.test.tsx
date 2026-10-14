import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProposalCard } from '@/components/ai/ProposalCard';
import {
  appliedNote, appliedNoteFor, confirmLabel, confirmPermission, diffRow, operationOf, proposalBadge, riskCallouts,
} from '@/features/ai/proposal-format';
import type { ActionProposal } from '@/features/ai/types';

const create: ActionProposal = {
  resource: 'automation',
  operation: 'create',
  payload: { name: 'Exit offer' },
  summary: { title: 'Exit offer', lines: ['Trigger: exit intent'], hasExternalEffect: false },
};

const funnelChange: ActionProposal = {
  resource: 'funnel',
  operation: 'update',
  target: { id: 'f1', version: '2026-10-01T10:00:00.000Z' },
  requiredRole: 'member',
  payload: {},
  diff: [
    { field: 'name', label: 'Name', before: 'Signup', after: 'Signup v2' },
    { field: 'steps', label: 'Steps', before: ['Pricing', 'Cart', 'Paid'], after: ['Pricing', 'Checkout', 'Paid'] },
  ],
  summary: { title: 'Change the "Signup" funnel', lines: ['Name: Signup → Signup v2', 'Steps: 3 items → 3 items', 'Recounted.'], hasExternalEffect: false },
};

const settings: ActionProposal = {
  resource: 'site_settings',
  operation: 'update',
  target: { id: 's', version: 'v' },
  requiredRole: 'admin',
  payload: { replay_exclude_patterns: '/account' },
  diff: [{ field: 'replay_exclude_patterns', label: 'Never record pages matching', before: ['/checkout', '/account'], after: ['/account'] }],
  summary: {
    title: 'Change what this site collects',
    lines: ['Recordings will start capturing /checkout.'],
    hasExternalEffect: false,
    risks: [{ kind: 'data', message: 'Recordings will start capturing /checkout.' }],
  },
};

describe('proposal format helpers', () => {
  it('treats a draft without an operation as a create', () => {
    expect(operationOf({})).toBe('create');
    expect(proposalBadge({ ...create, operation: undefined })).toBe('New automation');
  });

  it('labels each operation', () => {
    expect(proposalBadge(funnelChange)).toBe('Change funnel');
    expect(proposalBadge({ ...create, operation: 'set_status', payload: { active: false } })).toBe('Switch off automation');
    expect(confirmLabel(create)).toBe('Create it');
    expect(confirmLabel(funnelChange)).toBe('Apply change');
    expect(confirmLabel({ ...create, operation: 'set_status', payload: { active: true } })).toBe('Switch on');
    expect(confirmLabel({ ...create, resource: 'error', operation: 'set_status', payload: { status: 'resolved' } })).toBe('Mark resolved');
    expect(confirmLabel({ ...create, resource: 'alert_snooze' })).toBe('Snooze');
  });

  it('renders a scalar change as before → after', () => {
    expect(diffRow({ field: 'name', label: 'Name', before: 'a', after: null })).toEqual({ kind: 'scalar', label: 'Name', before: 'a', after: '(none)' });
  });

  it('renders a list change as one list marked added, removed and kept, in the new order', () => {
    const row = diffRow(funnelChange.diff![1]!);
    expect(row).toEqual({
      kind: 'list', label: 'Steps',
      items: [
        { text: 'Pricing', change: 'kept' },
        { text: 'Cart', change: 'removed' },
        { text: 'Checkout', change: 'added' },
        { text: 'Paid', change: 'kept' },
      ],
    });
    expect(diffRow({ field: 'p', label: 'P', before: null, after: ['/a'] })).toEqual({ kind: 'list', label: 'P', items: [{ text: '/a', change: 'added' }] });
  });

  it('decides who may confirm, letting the server decide while the role loads', () => {
    expect(confirmPermission('', settings)).toEqual({ allowed: true });
    expect(confirmPermission('member', settings).allowed).toBe(false);
    expect(confirmPermission('member', settings).reason).toContain('admin');
    expect(confirmPermission('admin', settings).allowed).toBe(true);
    expect(confirmPermission('owner', settings).allowed).toBe(true);
    expect(confirmPermission('viewer', create).allowed).toBe(false);
    expect(confirmPermission('member', create).allowed).toBe(true);
  });

  it('puts going live first, and warns on an older external draft without risks', () => {
    const risks = riskCallouts({
      ...create,
      summary: { ...create.summary, hasExternalEffect: true, risks: [{ kind: 'stops', message: 's' }, { kind: 'live', message: 'l' }] },
    });
    expect(risks.map((r) => r.kind)).toEqual(['live', 'external', 'stops']);
  });

  it('says what happens next for each kind of draft', () => {
    expect(appliedNote('automation')).toContain('inactive');
    expect(appliedNoteFor({ ...create, payload: { activate: true } })).toContain('live');
    expect(appliedNote('site_settings', 'update')).toContain('tracker');
  });
});

describe('ProposalCard', () => {
  it('keeps the existing create card working', () => {
    render(<ProposalCard proposal={create} onConfirm={() => {}} />);
    expect(screen.getByText('New automation')).toBeTruthy();
    expect(screen.getByText('Draft — nothing created yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create it/ })).toBeTruthy();
  });

  it('shows the diff, the data callout, and disables confirm for a member with the reason', () => {
    render(<ProposalCard proposal={settings} onConfirm={() => {}} role="member" />);
    expect(screen.getAllByText('Recordings will start capturing /checkout.').length).toBeGreaterThan(0);
    expect(screen.getByText('Never record pages matching')).toBeTruthy();
    const button = screen.getByRole('button', { name: /Apply change/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Only the site owner or an admin can confirm this change.')).toBeTruthy();
  });

  it('drops summary lines the diff already shows, and shows a stale draft clearly', () => {
    render(<ProposalCard proposal={funnelChange} onConfirm={() => {}} role="admin" stale error="This draft is out of date." />);
    expect(screen.queryByText('Name: Signup → Signup v2')).toBeNull();
    expect(screen.getByText('Recounted.')).toBeTruthy();
    expect(screen.getByText('This draft is out of date.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Apply change/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
