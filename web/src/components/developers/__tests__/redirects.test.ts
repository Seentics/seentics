import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** `public/_redirects` as [from, to, status] rows, comments and blanks dropped. */
const rows = readFileSync(path.resolve(__dirname, '../../../../public/_redirects'), 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .map(l => l.split(/\s+/));
const target = (from: string) => rows.find(r => r[0] === from)?.slice(1);

describe('_redirects: Developers and the Agency workspace', () => {
  it('serves the developers page from its w-leaf shell, with a .txt twin', () => {
    expect(target('/websites/:websiteId/developers')).toEqual(['/websites/w-leaf/developers', '200']);
    expect(target('/websites/:websiteId/developers.txt')).toEqual(['/websites/w-leaf/developers.txt', '200']);
  });

  it('has no rows left for the old per-website agency page', () => {
    expect(rows.some(r => r[0].startsWith('/websites/:websiteId/agency'))).toBe(false);
  });

  it("serves a client's page from the c-leaf shell, with a .txt twin", () => {
    expect(target('/agency/clients/:clientId')).toEqual(['/agency/clients/c-leaf', '200']);
    expect(target('/agency/clients/:clientId.txt')).toEqual(['/agency/clients/c-leaf.txt', '200']);
  });

  it('puts the .txt twin before each rule (the HTML rule would otherwise answer it)', () => {
    for (const from of ['/websites/:websiteId/developers', '/agency/clients/:clientId']) {
      expect(rows.findIndex(r => r[0] === `${from}.txt`)).toBeLessThan(rows.findIndex(r => r[0] === from));
    }
  });
});
