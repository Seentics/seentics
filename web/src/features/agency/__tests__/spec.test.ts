import { describe, expect, it } from 'vitest';
import { curlExample, examplePath, nodeExample, QUICK_START } from '../agency-api-docs';
import { AGENCY_API } from '../agency-api-spec';

const ep = (id: string) => AGENCY_API.find(e => e.id === id)!;

describe('examples generated from the spec', () => {
  it('fills the path with example ids and adds the query', () => {
    expect(examplePath(ep('delete-client'))).toBe('/agency/clients/5bbeaa88-b089-4923-ad54-8fdcbbcdba94?confirm=true');
    expect(examplePath(ep('usage'))).toBe('/agency/usage');
  });

  it('builds curl with the key, an Idempotency-Key on POST, and the body', () => {
    const curl = curlExample(ep('create-client'), { apiKey: 'sk_test' });
    expect(curl).toContain('curl -X POST "https://api.seentics.com/api/v1/agency/clients"');
    expect(curl).toContain('-H "X-API-Key: sk_test"');
    expect(curl).toContain('Idempotency-Key');
    expect(curl).toContain(`-d '${JSON.stringify(ep('create-client').requestExample)}'`);
    const get = curlExample(ep('list-clients'));
    expect(get).toContain('GET "https://api.seentics.com/api/v1/agency/clients?status=active"');
    expect(get).not.toContain('Idempotency-Key');
    expect(get).not.toContain('-d ');
  });

  it('builds Node fetch code that parses the envelope', () => {
    const node = nodeExample(ep('set-domain'), { baseUrl: 'http://localhost:3002/api/v1' });
    expect(node).toContain("await fetch('http://localhost:3002/api/v1/agency/domain'");
    expect(node).toContain("method: 'PUT'");
    expect(node).toContain('"hostname": "reports.meridian.test"');
    expect(node).not.toContain('Idempotency-Key');
    expect(node).toContain('const { data } = await res.json();');
    expect(nodeExample(ep('verify-website'))).toContain("'Idempotency-Key': crypto.randomUUID()");
  });

  it('generates an example for every endpoint, and the quick start in order', () => {
    for (const e of AGENCY_API) {
      expect(curlExample(e)).not.toMatch(/\{[a-z_]+\}/);
      expect(nodeExample(e)).toContain(e.method);
    }
    expect(QUICK_START.map(s => s.endpoint.id)).toEqual(['create-client', 'add-client-website', 'get-install', 'verify-website']);
  });
});
