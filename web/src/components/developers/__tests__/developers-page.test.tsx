import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/path-segment', () => ({ usePathSegment: () => 'site-1' }));
vi.mock('@/components/dashboard-header', () => ({
  DashboardPageHeader: ({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) => (
    <header><h1>{title}</h1><p>{description}</p>{children}</header>
  ),
}));
vi.mock('@/components/developers/api-keys', () => ({
  useAPIKeys: () => ({ data: [{ id: 'k1', scopes: ['websites:read'], lastUsed: null }], isLoading: false }),
}));
vi.mock('@/components/developers/AccountKeysPanel', () => ({
  AccountKeysList: () => <div>keys list</div>,
  CreateAccountKeyDialog: ({ open, preset }: { open: boolean; preset?: string }) => (open ? <div role="dialog">New API key {preset ?? 'default'}</div> : null),
}));
vi.mock('@/features/api-keys/queries', () => ({
  useApiCatalogue: () => ({
    isLoading: false,
    isError: false,
    data: {
      meta: { base_path: '/api/v1/raw' },
      data: [{ method: 'GET', path: '/v1/websites/:website_id/analytics/top-pages', group: 'Analytics', summary: 'Top pages', scope: 'analytics:read', params: [], example: {} }],
    },
  }),
}));

import DevelopersPage from '@/app/websites/[websiteId]/developers/page-client';
import { WEBSITES_API } from '@/components/developers/websites-api-spec';

const tabs = () => screen.getAllByRole('tab').map(t => t.textContent?.replace(/\d+$/, '').trim());

beforeEach(() => {
  window.history.replaceState(null, '', '/websites/site-1/developers');
});

describe('Developers page', () => {
  it('has the six developer tabs and no agency ones', () => {
    render(<DevelopersPage />);
    expect(screen.getByRole('heading', { name: 'Developers' })).toBeTruthy();
    expect(tabs()).toEqual(['API keys', 'Data API', 'Management API', 'AI assistants (MCP)', 'Tracker & SDK setup', 'Webhooks & integrations']);
    for (const gone of [/Clients/, /Embeds/, /White label/]) {
      expect(screen.queryByRole('tab', { name: gone })).toBeNull();
    }
  });

  it('opens the tab named in the URL and writes the chosen tab back', async () => {
    window.history.replaceState(null, '', '/websites/site-1/developers?tab=data-api');
    render(<DevelopersPage />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Data API' }).getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(screen.getByRole('tab', { name: /Webhooks/ }));
    expect(window.location.search).toBe('?tab=integrations');
    expect(screen.getByRole('link', { name: /Integrations & webhooks/ }).getAttribute('href')).toBe('/websites/site-1/settings/integrations');
  });

  it('API keys: opens the new-key dialog', () => {
    render(<DevelopersPage />);
    fireEvent.click(screen.getByRole('button', { name: /New account key/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('?new=agency opens the new-key dialog on the Agency API preset', async () => {
    window.history.replaceState(null, '', '/websites/site-1/developers?new=agency');
    render(<DevelopersPage />);
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('New API key agency'));
    expect(window.location.search).toBe('');
  });

  it('AI assistants: the MCP URL, a snippet per assistant, and a key on the assistant preset', () => {
    render(<DevelopersPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'AI assistants (MCP)' }));
    const url = screen.getByTestId('mcp-url').textContent ?? '';
    expect(url).toMatch(/^https?:\/\/.+\/api\/v1\/mcp$/);
    expect(screen.getByTestId('mcp-snippet').textContent).toContain(`claude mcp add --transport http seentics ${url}`);
    fireEvent.click(screen.getByRole('tab', { name: 'Cursor' }));
    expect(JSON.parse(screen.getByTestId('mcp-snippet').textContent ?? '')).toEqual({
      mcpServers: { seentics: { url, headers: { Authorization: 'Bearer YOUR_API_KEY' } } },
    });
    fireEvent.click(screen.getByTestId('mcp-create-key'));
    expect(screen.getByRole('dialog')).toHaveTextContent('New API key assistant');
  });

  it("setup: shows this site's snippet, copies it, and links the guides (no Observability SDKs)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<DevelopersPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Tracker & SDK setup/ }));
    const snippet = screen.getByTestId('tracking-snippet').textContent ?? '';
    expect(snippet).toContain('data-website-id="site-1"');
    expect(snippet).toContain(`${window.location.origin}/trackers/seentics.min.js`);
    fireEvent.click(screen.getByRole('button', { name: 'Copy snippet' }));
    expect(writeText).toHaveBeenCalledWith(snippet);
    await screen.findByText('Copied');
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    for (const h of ['/docs/quick-start', '/docs/tracker', '/docs/frameworks', '/docs/google-tag-manager', '/docs/proxy']) {
      expect(hrefs).toContain(h);
    }
    expect(hrefs.some(h => h?.includes('observ'))).toBe(false);
  });

  it('Management API documents websites only', () => {
    render(<DevelopersPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Management API' }));
    expect(WEBSITES_API.every(e => e.path.startsWith('/websites') && !e.path.includes('embed'))).toBe(true);
    expect(screen.queryByText(/Create a client/)).toBeNull();
    expect(screen.getAllByText('Create a website').length).toBeGreaterThan(0);
  });
});
