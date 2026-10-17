import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoundingSpots } from '@/features/plans/types';

let founding: FoundingSpots | undefined;

// The header's hash-link scroller and theme toggle read media queries jsdom does not implement.
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

vi.mock('next/navigation', () => ({
  usePathname: () => '/agencies',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  notFound: () => { throw new Error('notFound'); },
}));
// The agency page and its links are Cloud only (as in production).
vi.mock('@/lib/features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/features')>()),
  isEnterprise: true,
  isOpenSource: false,
}));
vi.mock('@/features/plans/queries', () => ({
  useFoundingSpots: () => ({ data: founding }),
  usePlans: () => ({ data: undefined }),
}));

const { default: Footer } = await import('@/components/landing/Footer');
const { default: LandingHeader } = await import('@/components/landing/LandingHeader');
const { default: AgenciesPage } = await import('@/app/agencies/page');

const hrefs = (root: HTMLElement) => within(root).getAllByRole('link').map((a) => [a.textContent?.trim(), a.getAttribute('href')]);

beforeEach(() => { founding = undefined; });

describe('Footer', () => {
  it('links Docs and the agency pages', () => {
    const { container } = render(<Footer />);
    const links = hrefs(container);
    expect(links).toContainEqual(['Docs', '/docs']);
    expect(links).toContainEqual(['For agencies', '/agencies']);
    expect(links).toContainEqual(['Agency demo', '/agency?demo=1']);
    expect(links).toContainEqual(['Agency API', '/docs/agency/api']);
  });
});

describe('LandingHeader', () => {
  it('has For agencies on desktop and in the mobile menu', () => {
    const { container } = render(<LandingHeader />);
    expect(hrefs(container).filter(([, h]) => h === '/agencies')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const forAgencies = screen.getAllByRole('link', { name: 'For agencies' });
    expect(forAgencies).toHaveLength(2);
    for (const a of forAgencies) expect(a.getAttribute('href')).toBe('/agencies');
  });
});

describe('/agencies', () => {
  it('leads with the demo and Get Agency', () => {
    render(<AgenciesPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Every client site.');
    const demo = screen.getAllByRole('link', { name: 'See the live demo' });
    expect(demo.length).toBeGreaterThan(0);
    for (const a of demo) expect(a.getAttribute('href')).toBe('/agency?demo=1');
    for (const a of screen.getAllByRole('link', { name: /Get Agency/ })) expect(a.getAttribute('href')).toBe('/pricing');
  });

  it('marks what is not live as Soon, and only that', () => {
    const { container } = render(<AgenciesPage />);
    const soon = [...container.querySelectorAll('[data-soon="true"]')].map((el) => el.querySelector('h3')?.textContent);
    expect(soon).toEqual(['Client dashboards on your own domain']);
    expect(screen.getAllByTestId('soon')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/observability/i);
  });

  it('shows the founding line with the limit while open, a count only from 10 claimed', () => {
    const { unmount } = render(<AgenciesPage />);
    expect(screen.getByTestId('founding-line').textContent).toMatch(/30% off for life with code\s*FOUNDING30.*Limited to the first 50 customers/);
    unmount();

    founding = { code: 'FOUNDING30', total: 50, claimed: 38, left: 12, status: 'open' };
    render(<AgenciesPage />);
    expect(screen.getByTestId('founding-line').textContent).toContain('Only 12 of 50 founding spots left');
  });

  it('hides the founding line when the offer is closed', () => {
    founding = { code: 'FOUNDING30', total: 50, claimed: 50, left: 0, status: 'closed' };
    render(<AgenciesPage />);
    expect(screen.queryByTestId('founding-line')).toBeNull();
    expect(screen.queryByText(/FOUNDING30/)).toBeNull();
  });
});
