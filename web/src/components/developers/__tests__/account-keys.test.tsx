import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mutate = vi.fn();
let agency = true;
vi.mock('@/features/agency/plan', () => ({ useAgencyPlan: () => ({ allowed: agency, markRefused: () => undefined }) }));
vi.mock('@/components/developers/api-keys', async (orig) => ({
  ...(await orig<typeof import('@/components/developers/api-keys')>()),
  useCreateAPIKey: () => ({ mutate, isPending: false }),
}));

import { CreateAccountKeyDialog } from '@/components/developers/AccountKeysPanel';

const sentScopes = () => (mutate.mock.calls.at(-1)?.[0] as { scopes: string[] }).scopes;

function open(preset?: 'agency') {
  render(<CreateAccountKeyDialog websiteId="site-1" open onOpenChange={() => undefined} preset={preset} />);
  fireEvent.change(screen.getByPlaceholderText(/Signup handler/), { target: { value: 'Backend' } });
}

beforeEach(() => {
  mutate.mockReset();
  agency = true;
});

describe('new account key', () => {
  it('offers the Agency API preset to Agency accounts: agency:read + agency:write', () => {
    open();
    fireEvent.click(screen.getByTestId('key-access-agency'));
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(sentScopes()).toEqual(['agency:read', 'agency:write']);
  });

  it('opens on the preset it is given', () => {
    open('agency');
    expect(screen.getByTestId('key-access-agency').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(sentScopes()).toEqual(['agency:read', 'agency:write']);
  });

  it('hides the preset without the Agency plan, but every scope can still be picked by hand', () => {
    agency = false;
    open();
    expect(screen.queryByTestId('key-access-agency')).toBeNull();
    fireEvent.click(screen.getByTestId('key-access-custom'));
    expect(screen.getByRole('button', { name: 'Create key' })).toHaveProperty('disabled', true);
    for (const scope of ['agency:write', 'websites:read', 'agency:read']) fireEvent.click(screen.getByRole('checkbox', { name: scope }));
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    // In Core's order, whatever the order picked.
    expect(sentScopes()).toEqual(['websites:read', 'agency:read', 'agency:write']);
  });

  it('full access stays the default: websites and the data API', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(sentScopes()).toEqual(['websites:read', 'websites:write', 'analytics:read', 'replays:read', 'heatmaps:read']);
  });
});
