import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Client mode: a client user sees only the pages their agency allowed on the website they are
 * on, is sent away from any other, cannot change what they may only view, and is told so when
 * the server refuses anyway. An account sees the dashboard as before.
 */

const nav = vi.hoisted(() => ({ pathname: '/websites/w1', replace: vi.fn(), push: vi.fn() }));
const client = vi.hoisted(() => ({ getClientMe: vi.fn() }));
const role = vi.hoisted(() => ({ getMyRole: vi.fn(async () => 'member') }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/client-mode/api', async (orig) => ({ ...(await orig<object>()), getClientMe: client.getClientMe }));
vi.mock('@/lib/websites-api', () => ({ getMyRole: role.getMyRole }));
vi.mock('@/features/suite/api', () => ({ fetchEntitlements: vi.fn(async () => { throw new Error('entitlements must not be asked in client mode'); }), suiteKeys: { entitlements: ['entitlements'] } }));

import { Sidebar } from '@/components/dashboard/Sidebar';
import { ClientModeProvider, EditGuard, useReadOnly } from '@/features/client-mode/ClientMode';
import { FeatureGate } from '@/features/client-mode/FeatureGate';
import { editOnlyFallback, featureForPath, firstAllowedPath } from '@/features/client-mode/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/stores/useAuthStore';
import type { ClientMe } from '@/features/client-mode/types';

const BRAND = {
  slug: 'meridian', brand_name: 'Meridian Digital', logo_url: '', primary_color: '#7c3aed',
  support_email: 'help@meridian.test', footer_text: '', hide_seentics: true,
};

const ME: ClientMe = {
  user: { id: 'u1', email: 'jess@acme.test', name: 'Jess' },
  agency: { owner_id: 'o1', slug: 'meridian' },
  brand: BRAND,
  websites: [
    {
      id: 'w1', name: 'Acme', url: 'https://acme.test', client_id: 'c1', client_name: 'Acme',
      features: { overview: 'view', recordings: 'off', heatmaps: 'view', funnels: 'edit', goals: 'view', ai: 'off', privacy: 'off' },
    },
    { id: 'w2', name: 'Acme Shop', url: 'https://shop.acme.test', client_id: 'c1', client_name: 'Acme', features: { leads: 'edit' } },
  ],
};

function signInAs(kind: 'client' | 'account') {
  useAuth.setState({
    user: { id: 'u1', email: 'jess@acme.test', name: 'Jess', kind, agency: kind === 'client' ? { owner_id: 'o1', slug: 'meridian' } : undefined } as never,
    access_token: null,
    isAuthenticated: true,
    isLoading: false,
  });
}

function renderIn(websiteId: string, ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClientModeProvider websiteId={websiteId}>{ui}</ClientModeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nav.pathname = '/websites/w1';
  nav.replace.mockClear();
  client.getClientMe.mockReset().mockResolvedValue(ME);
  localStorage.clear();
});

afterEach(() => {
  useAuth.getState().resetAuth();
  document.documentElement.style.removeProperty('--primary');
});

describe('routes', () => {
  it('maps each page to its feature, and account-only pages to none', () => {
    expect(featureForPath('/websites/w1', 'w1')).toBe('overview');
    expect(featureForPath('/websites/w1/replays/s9', 'w1')).toBe('recordings');
    expect(featureForPath('/websites/w1/ai', 'w1')).toBe('ai');
    expect(featureForPath('/websites/w1/ai-reports', 'w1')).toBe('ai');
    expect(featureForPath('/websites/w1/settings/goals', 'w1')).toBe('goals');
    expect(featureForPath('/websites/w1/settings/privacy', 'w1')).toBe('privacy');
    expect(featureForPath('/websites/w1/developers', 'w1')).toBeNull();
    expect(featureForPath('/websites/w1/settings/billing', 'w1')).toBeNull();
    expect(featureForPath('/websites/w1/settings/team', 'w1')).toBeNull();
  });

  it('lands on the first allowed page, the overview without AI mode', () => {
    expect(firstAllowedPath('w1', ME.websites[0]!.features)).toBe('/websites/w1?dashboard=1');
    expect(firstAllowedPath('w2', ME.websites[1]!.features)).toBe('/websites/w2/leads');
    expect(firstAllowedPath('w3', {})).toBeNull();
    expect(editOnlyFallback('/websites/w1/automations/new', 'w1')).toBe('/websites/w1/automations');
  });
});

describe('sidebar in client mode', () => {
  it('lists only the allowed pages, the agency’s brand, and none of the account’s things', async () => {
    signInAs('client');
    nav.pathname = '/websites/w1';
    renderIn('w1', <Sidebar websiteId="w1" />);
    const desktop = (await screen.findAllByRole('link', { name: /Overview/ }))[0]!.closest('aside')!;
    const labels = within(desktop).getAllByRole('link').map((a) => a.textContent?.trim());
    expect(labels).toEqual(['MMeridian Digital', 'Overview', 'Heatmaps', 'Funnels', 'Settings']);
    expect(within(desktop).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/websites/w1/settings/goals');
    expect(within(desktop).queryByText('Developers')).toBeNull();
    expect(within(desktop).queryByText('Agency workspace')).toBeNull();
    expect(within(desktop).queryByText('Customize')).toBeNull();
    expect(within(desktop).queryByText('Seentics')).toBeNull();
    // The brand's colour becomes the dashboard's primary.
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--primary')).toBe('262 83% 58%'));
  });

  it('lists everything for an account', async () => {
    signInAs('account');
    renderIn('w1', <Sidebar websiteId="w1" />);
    const desktop = (await screen.findAllByRole('link', { name: /Overview/ }))[0]!.closest('aside')!;
    expect(within(desktop).getByText('Developers')).toBeTruthy();
    expect(within(desktop).getByText('Recording')).toBeTruthy();
    expect(within(desktop).getByText('Seentics')).toBeTruthy();
    expect(client.getClientMe).not.toHaveBeenCalled();
  });
});

describe('FeatureGate', () => {
  const page = <FeatureGate><p>page content</p></FeatureGate>;

  it('sends a client away from a page whose feature is off, to the first allowed page', async () => {
    signInAs('client');
    nav.pathname = '/websites/w1/replays';
    renderIn('w1', page);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/websites/w1?dashboard=1'));
    expect(screen.queryByText('page content')).toBeNull();
  });

  it('never shows a client an account-only page', async () => {
    signInAs('client');
    nav.pathname = '/websites/w1/developers';
    renderIn('w1', page);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/websites/w1?dashboard=1'));
  });

  it('sends a client off a website that is not theirs, to their first one', async () => {
    signInAs('client');
    nav.pathname = '/websites/other/funnels';
    renderIn('other', page);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/websites/w1?dashboard=1'));
  });

  it('sends a client who may only view automations from "new automation" back to the list', async () => {
    client.getClientMe.mockResolvedValue({ ...ME, websites: [{ ...ME.websites[0]!, features: { automations: 'view' } }] });
    signInAs('client');
    nav.pathname = '/websites/w1/automations/new';
    renderIn('w1', page);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/websites/w1/automations'));
  });

  it('shows an allowed page', async () => {
    signInAs('client');
    nav.pathname = '/websites/w1/funnels';
    renderIn('w1', page);
    expect(await screen.findByText('page content')).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('lets an account through without asking /client/me', () => {
    signInAs('account');
    nav.pathname = '/websites/w1/developers';
    renderIn('w1', page);
    expect(screen.getByText('page content')).toBeTruthy();
    expect(client.getClientMe).not.toHaveBeenCalled();
  });
});

describe('read-only pages', () => {
  function Probe({ websiteId }: { websiteId: string }) {
    const readOnly = useReadOnly();
    const { canEdit, isLoading } = usePermissions(websiteId);
    return (
      <div>
        <span data-testid="state">{isLoading ? 'loading' : `${readOnly ? 'read-only' : 'editable'} ${canEdit ? 'can-edit' : 'no-edit'}`}</span>
        <EditGuard feature="goals"><button type="button">New goal</button></EditGuard>
        <EditGuard feature="funnels"><button type="button">New funnel</button></EditGuard>
        <EditGuard feature="goals" mode="disable"><button type="button">Save goals</button></EditGuard>
      </div>
    );
  }

  it('hides or disables the writes of a feature the client may only view', async () => {
    signInAs('client');
    nav.pathname = '/websites/w1/heatmaps';
    renderIn('w1', <Probe websiteId="11111111-1111-4111-8111-111111111111" />);
    await screen.findByRole('button', { name: 'New funnel' });
    expect(screen.queryByRole('button', { name: 'New goal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save goals' })).toBeDisabled();
    // Heatmaps is view-only: usePermissions says no edits, whatever the role.
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('read-only no-edit'));
  });

  it('allows edits on a page set to Edit', async () => {
    signInAs('client');
    nav.pathname = '/websites/w1/funnels';
    renderIn('w1', <Probe websiteId="11111111-1111-4111-8111-111111111111" />);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('editable can-edit'));
  });

  it('changes nothing for an account', async () => {
    signInAs('account');
    renderIn('w1', <Probe websiteId="11111111-1111-4111-8111-111111111111" />);
    expect(screen.getByRole('button', { name: 'New goal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save goals' })).not.toBeDisabled();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('editable can-edit'));
  });
});
