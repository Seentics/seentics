import fs from 'node:fs';
import path from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DOCS_NAV, DOCS_PAGES } from '@/components/docs/nav';
import { AGENCY_API, AGENCY_API_GROUPS, AGENCY_ERROR_CODES } from '@/features/agency/agency-api-spec';
import {
  AGENCY_DOCS_QUICK_START,
  AgencyApiReference,
  AgencyQuickStart,
  exampleFor,
  groupAnchor,
} from '../AgencyDocs';

const APP = path.resolve(__dirname, '../../../../app');
const AGENCY_DIR = path.join(APP, 'docs/agency');

const AGENCY_PAGES = [
  '/docs/agency',
  '/docs/agency/getting-started',
  '/docs/agency/clients-and-websites',
  '/docs/agency/install-and-verify',
  '/docs/agency/branding-and-domain',
  '/docs/agency/embeds',
  '/docs/agency/usage-and-limits',
  '/docs/agency/client-sign-in',
  '/docs/agency/api',
  '/docs/agency/api/reference',
];

/** Every `page.tsx` under a directory, as the route it serves. */
function routesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routesUnder(full));
    else if (entry.name === 'page.tsx') out.push(`/${path.relative(APP, dir).split(path.sep).join('/')}`);
  }
  return out;
}

const pageExists = (route: string) => fs.existsSync(path.join(APP, route, 'page.tsx'));

describe('agency docs nav', () => {
  it('has an Agency group with every agency page, in order', () => {
    const group = DOCS_NAV.find((g) => g.title === 'Agency');
    expect(group?.items.map((i) => i.href)).toEqual(AGENCY_PAGES);
  });

  it('lists every agency page in DOCS_PAGES (sidebar, previous/next and sitemap)', () => {
    const hrefs = DOCS_PAGES.map((p) => p.href);
    for (const href of AGENCY_PAGES) expect(hrefs).toContain(href);
  });

  it('matches the pages on disk: no page missing from the nav, no nav entry without a page', () => {
    expect(routesUnder(AGENCY_DIR).sort()).toEqual([...AGENCY_PAGES].sort());
  });

  it('has metadata with a title and description on every agency page', () => {
    for (const route of AGENCY_PAGES) {
      const src = fs.readFileSync(path.join(APP, route, 'page.tsx'), 'utf8');
      expect(src, route).toMatch(/export const metadata = \{\s*title: '[^']+',\s*description:/);
    }
  });

  it('links only to docs routes that exist, and to anchors the reference renders', () => {
    const anchors = new Set([...AGENCY_API.map((e) => e.id), ...AGENCY_API_GROUPS.map(groupAnchor), 'errors']);
    for (const route of AGENCY_PAGES) {
      const src = fs.readFileSync(path.join(APP, route, 'page.tsx'), 'utf8');
      for (const [, href] of src.matchAll(/href="(\/[^"]*)"/g)) {
        const [target, hash] = href!.split('#');
        expect(pageExists(target!), `${route} links to ${href}`).toBe(true);
        if (hash && target === '/docs/agency/api/reference') expect(anchors.has(hash), `${route} links to ${href}`).toBe(true);
      }
    }
  });
});

describe('AgencyApiReference', () => {
  it('renders every endpoint in the spec, with its method, path and scope', () => {
    render(<AgencyApiReference />);
    for (const ep of AGENCY_API) {
      const block = screen.getByTestId(`endpoint-${ep.id}`);
      expect(within(block).getByText(`/api/v1${ep.path}`)).toBeInTheDocument();
      expect(within(block).getAllByText(ep.method).length).toBeGreaterThan(0);
      expect(within(block).getByText(ep['x-scope'])).toBeInTheDocument();
      expect(within(block).getByText(ep.summary)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^endpoint-/)).toHaveLength(AGENCY_API.length);
  });

  it('renders a section per group and every error code', () => {
    const { container } = render(<AgencyApiReference />);
    for (const group of AGENCY_API_GROUPS) expect(container.querySelector(`#${groupAnchor(group)}`)).not.toBeNull();
    for (const e of AGENCY_ERROR_CODES) expect(screen.getAllByText(e.code).length).toBeGreaterThan(0);
  });
});

describe('agency API quick start', () => {
  it('creates a client, adds a website, gets the snippet and reads usage', () => {
    expect(AGENCY_DOCS_QUICK_START.map((s) => s.endpoint.id)).toEqual([
      'create-client',
      'add-client-website',
      'get-install',
      'usage',
    ]);
    render(<AgencyQuickStart />);
    expect(screen.getByTestId('agency-quick-start').textContent).toContain('/agency/clients');
  });

  it('reads the key from the environment in curl and Node', () => {
    const ep = AGENCY_DOCS_QUICK_START[0]!.endpoint;
    expect(exampleFor(ep, 'curl')).toContain('X-API-Key: $SEENTICS_API_KEY');
    expect(exampleFor(ep, 'curl')).toContain('Idempotency-Key');
    expect(exampleFor(ep, 'node')).toContain('process.env.SEENTICS_API_KEY');
  });

  it('turns group names into anchors', () => {
    expect(groupAnchor('Branding')).toBe('branding');
    expect(groupAnchor('Usage & limits')).toBe('usage-limits');
  });
});
