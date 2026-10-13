import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every page under `websites/[websiteId]/` is a static shell served through a rule in
 * `public/_redirects`. A page with no rule builds fine and then 404s in production for every
 * real site id — which is how the Leads and Integrations pages shipped broken. This fails the
 * build for the next one instead.
 */
const web = path.resolve(__dirname, '../..');
const pagesRoot = path.join(web, 'src/app/websites/[websiteId]');

function routes(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // A further dynamic segment (e.g. a detail page) has its own placeholder rules.
    if (entry.startsWith('[')) continue;
    const route = `${prefix}/${entry}`;
    if (readdirSync(full).some((f) => /^page\.tsx?$/.test(f))) found.push(route);
    found.push(...routes(full, route));
  }
  return found;
}

describe('_redirects covers every website page', () => {
  const rules = readFileSync(path.join(web, 'public/_redirects'), 'utf8')
    .split('\n')
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((l) => l?.startsWith('/websites/:websiteId/'));

  for (const route of routes(pagesRoot)) {
    it(`${route} has an HTML rule and a .txt twin`, () => {
      expect(rules).toContain(`/websites/:websiteId${route}`);
      expect(rules).toContain(`/websites/:websiteId${route}.txt`);
    });
  }
});
