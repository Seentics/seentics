import { AGENCY_API, AGENCY_API_BASE, type AgencyEndpoint } from './agency-api-spec';

/**
 * curl and Node examples for each endpoint, built from the spec alone: the path with the example
 * IDs filled in, the query, the scope's header, and the example body.
 */

export interface ExampleOptions {
  baseUrl?: string;
  apiKey?: string;
}

const KEY_PLACEHOLDER = 'snt_acct_your_account_key';

/** `/agency/clients/:id` with the example params, plus the example query. */
export function examplePath(ep: AgencyEndpoint): string {
  const params = ep.example?.params ?? {};
  const path = ep.path.replace(/:([a-zA-Z_]+)/g, (_, name: string) => params[name] ?? `{${name}}`);
  const query = ep.example?.query;
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : '';
  return `${path}${qs}`;
}

const hasBody = (ep: AgencyEndpoint) => ep.requestExample !== undefined;

export function curlExample(ep: AgencyEndpoint, opts: ExampleOptions = {}): string {
  const base = opts.baseUrl ?? AGENCY_API_BASE;
  const lines = [`curl -X ${ep.method} "${base}${examplePath(ep)}"`, `  -H "X-API-Key: ${opts.apiKey ?? KEY_PLACEHOLDER}"`];
  if (ep.method === 'POST') lines.push('  -H "Idempotency-Key: $(uuidgen)"');
  if (hasBody(ep)) {
    lines.push('  -H "Content-Type: application/json"');
    lines.push(`  -d '${JSON.stringify(ep.requestExample)}'`);
  }
  return lines.join(' \\\n');
}

export function nodeExample(ep: AgencyEndpoint, opts: ExampleOptions = {}): string {
  const base = opts.baseUrl ?? AGENCY_API_BASE;
  const headers: string[] = [`'X-API-Key': process.env.SEENTICS_API_KEY ?? '${opts.apiKey ?? KEY_PLACEHOLDER}'`];
  if (ep.method === 'POST') headers.push(`'Idempotency-Key': crypto.randomUUID()`);
  if (hasBody(ep)) headers.push(`'Content-Type': 'application/json'`);
  const init = [
    `  method: '${ep.method}',`,
    `  headers: {\n${headers.map(h => `    ${h},`).join('\n')}\n  },`,
    ...(hasBody(ep) ? [`  body: JSON.stringify(${JSON.stringify(ep.requestExample, null, 2).replace(/\n/g, '\n  ')}),`] : []),
  ];
  return [
    `const res = await fetch('${base}${examplePath(ep)}', {`,
    ...init,
    '});',
    'if (!res.ok) throw new Error((await res.json()).error.message);',
    'const { data } = await res.json();',
  ].join('\n');
}

const byId = (id: string) => AGENCY_API.find(e => e.id === id)!;

/** The quick start: create a client, add its website, read the snippet, check tracking. */
export const QUICK_START: Array<{ title: string; endpoint: AgencyEndpoint }> = [
  { title: 'Create a client', endpoint: byId('create-client') },
  { title: 'Add its website (the answer includes the snippet)', endpoint: byId('add-client-website') },
  { title: 'Fetch install instructions any time', endpoint: byId('get-install') },
  { title: 'Check that events are arriving', endpoint: byId('verify-website') },
];
