import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENCY_API } from '../agency-api-spec';

/**
 * The workspace calls only the public agency API, and the API page documents all of it: this
 * fails when `api.ts` calls an endpoint the spec does not list, or the spec lists one without
 * its `x-scope`.
 */

// Comments stripped, so prose that mentions `call(` is not counted as one.
const source = readFileSync(path.resolve(__dirname, '../api.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const CALL = /\bcall(?:<[^(]*>)?\(\s*'(GET|POST|PUT|PATCH|DELETE)',\s*'([^']+)'/g;
const calls = [...source.matchAll(CALL)].map(m => ({ method: m[1]!, path: m[2]! }));
const key = (e: { method: string; path: string }) => `${e.method} ${e.path}`;

describe('agency API parity', () => {
  it('finds the calls, and every call names its method and path literally', () => {
    expect(calls.length).toBeGreaterThan(20);
    // Every invocation of `call` other than its definition must have matched the pattern above.
    const invocations = source.match(/(?<!function )\bcall(?:<[^(]*>)?\(/g) ?? [];
    expect(invocations.length).toBe(calls.length);
  });

  it('every path api.ts calls is in agency-api-spec.ts', () => {
    const documented = new Set(AGENCY_API.map(key));
    const missing = calls.filter(c => !documented.has(key(c))).map(key);
    expect(missing).toEqual([]);
  });

  it('every spec endpoint has an x-scope matching its method', () => {
    for (const ep of AGENCY_API) {
      expect(ep['x-scope'], key(ep)).toMatch(/^agency:(read|write)$/);
      expect(ep['x-scope'], key(ep)).toBe(ep.method === 'GET' ? 'agency:read' : 'agency:write');
    }
  });

  it('documents each endpoint once, under /agency, with a response example', () => {
    const keys = AGENCY_API.map(key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(AGENCY_API.map(e => e.id)).size).toBe(AGENCY_API.length);
    for (const ep of AGENCY_API) {
      expect(ep.path.startsWith('/agency/') || ep.path === '/agency').toBe(true);
      expect(ep.responseExample, key(ep)).not.toBeUndefined();
      for (const name of ep.path.match(/:([a-zA-Z_]+)/g) ?? []) {
        expect(ep.pathParams?.some(p => `:${p.name}` === name), `${key(ep)} documents ${name}`).toBe(true);
        expect(ep.example?.params?.[name.slice(1)], `${key(ep)} has an example ${name}`).toBeTruthy();
      }
    }
  });
});
