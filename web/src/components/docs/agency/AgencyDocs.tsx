'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { C, Callout, CodeBlock, DocSection, Endpoint, P, RefTable } from '@/components/docs/DocsKit';
import { curlExample, nodeExample } from '@/features/agency/agency-api-docs';
import {
  AGENCY_API,
  AGENCY_API_GROUPS,
  AGENCY_ERROR_CODES,
  type AgencyEndpoint,
  type SpecField,
} from '@/features/agency/agency-api-spec';

/**
 * Pieces shared by the agency docs (`app/docs/agency/**`). The endpoint reference and the API quick
 * start are rendered from `features/agency/agency-api-spec.ts` — the same spec the workspace's API
 * page and the parity test read — so these pages cannot drift from the API.
 */

/** An internal docs link, styled as the other docs pages style theirs. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-primary hover:underline">
      {children}
    </Link>
  );
}

/** Bold UI label, as the other docs pages write a button or field name. */
export function B({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

export function ComingSoon({ title = 'Coming soon', children }: { title?: string; children: ReactNode }) {
  return (
    <Callout kind="note" title={title}>
      {children}
    </Callout>
  );
}

/* ── curl / Node ──────────────────────────────────────────────────────────── */

export type Lang = 'curl' | 'node';
const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'curl', label: 'curl' },
  { id: 'node', label: 'Node' },
];

/** curl reads the key from `$SEENTICS_API_KEY` in the shell; Node from `process.env.SEENTICS_API_KEY`. */
export const exampleFor = (ep: AgencyEndpoint, lang: Lang) =>
  lang === 'curl' ? curlExample(ep, { apiKey: '$SEENTICS_API_KEY' }) : nodeExample(ep);

export function LangTabs({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="tablist" aria-label="Example language" className="inline-flex rounded-md border border-border p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={lang === l.id}
          onClick={() => onChange(l.id)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            lang === l.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/* ── Quick start ──────────────────────────────────────────────────────────── */

const byId = (id: string) => {
  const ep = AGENCY_API.find((e) => e.id === id);
  if (!ep) throw new Error(`agency-api-spec has no endpoint "${id}"`);
  return ep;
};

/** Onboard a client end to end: the four calls the API page's quick start walks through. */
export const AGENCY_DOCS_QUICK_START: Array<{ title: string; note: ReactNode; endpoint: AgencyEndpoint }> = [
  {
    title: 'Create a client',
    note: (
      <>
        Answers the new client. Keep its <C>id</C> for the next step.
      </>
    ),
    endpoint: byId('create-client'),
  },
  {
    title: 'Add the client’s website',
    note: (
      <>
        Answers <C>{'{ website, install }'}</C>: the website, and its install snippet in{' '}
        <C>install.snippet_html</C>.
      </>
    ),
    endpoint: byId('add-client-website'),
  },
  {
    title: 'Get the install snippet and tracking status',
    note: (
      <>
        Any time later. <C>verification.status</C> is <C>not_seen</C> until the first event arrives, then{' '}
        <C>receiving</C>.
      </>
    ),
    endpoint: byId('get-install'),
  },
  {
    title: 'Read this month’s usage',
    note: <>Your plan’s pool, what has been used, and any overage, for the current UTC month.</>,
    endpoint: byId('usage'),
  },
];

export function AgencyQuickStart() {
  const [lang, setLang] = useState<Lang>('curl');
  return (
    <div className="space-y-6" data-testid="agency-quick-start">
      <div className="flex items-center justify-between gap-3">
        <P>The IDs below are examples: use the ones each step gives back.</P>
        <LangTabs lang={lang} onChange={setLang} />
      </div>
      {AGENCY_DOCS_QUICK_START.map((step, i) => (
        <div key={step.endpoint.id} className="space-y-2">
          <p className="text-[15px] font-semibold text-foreground">
            {i + 1}. {step.title}
          </p>
          <P>{step.note}</P>
          <CodeBlock code={exampleFor(step.endpoint, lang)} language={lang === 'curl' ? 'bash' : 'js'} />
        </div>
      ))}
    </div>
  );
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

export function AgencyErrorTable() {
  return (
    <RefTable
      columns={['Status', 'Code', 'Meaning']}
      rows={AGENCY_ERROR_CODES.map((e) => [<C key="s">{e.status}</C>, <C key="c">{e.code}</C>, inlineCode(e.meaning)])}
    />
  );
}

/* ── Reference ────────────────────────────────────────────────────────────── */

/** The spec writes code in descriptions as `backticks`. */
function inlineCode(text: string): ReactNode {
  const parts = text.split(/`([^`]+)`/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <C key={i}>{part}</C> : part));
}

export const groupAnchor = (group: string) => group.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function Fields({ title, fields }: { title: string; fields?: SpecField[] }) {
  if (!fields?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <RefTable
        columns={['Name', 'Type', 'Description']}
        rows={fields.map((f) => [
          <span key="n">
            <C>{f.name}</C>
            {f.required && <span className="ml-1.5 text-xs text-muted-foreground">required</span>}
          </span>,
          <span key="t" className="font-mono text-[12.5px] text-foreground">
            {f.type}
          </span>,
          inlineCode(f.description),
        ])}
      />
    </div>
  );
}

function ReferenceEndpoint({ ep, lang }: { ep: AgencyEndpoint; lang: Lang }) {
  return (
    <div id={ep.id} data-testid={`endpoint-${ep.id}`} className="scroll-mt-24 space-y-4">
      <Endpoint method={ep.method} path={`/api/v1${ep.path}`}>
        <span className="block font-medium text-foreground">{ep.summary}</span>
        {ep.description && <span className="mt-1 block">{inlineCode(ep.description)}</span>}
        <span className="mt-1 block text-[13px]">
          Scope <C>{ep['x-scope']}</C>
          {ep.method === 'POST' && (
            <>
              {' '}
              · send an <C>Idempotency-Key</C>
            </>
          )}
        </span>
      </Endpoint>
      <Fields title="Path parameters" fields={ep.pathParams} />
      <Fields title="Query" fields={ep.query} />
      <Fields title="Body" fields={ep.body} />
      {ep.requestExample !== undefined && (
        <CodeBlock code={JSON.stringify(ep.requestExample, null, 2)} language="json" filename="Request body" />
      )}
      {ep.responseExample === null ? (
        <P>
          Answers <C>{ep.status ?? 200}</C> with no body.
        </P>
      ) : (
        <CodeBlock
          code={JSON.stringify(ep.responseExample, null, 2)}
          language="json"
          filename={`Response ${ep.status ?? 200}`}
        />
      )}
      <CodeBlock code={exampleFor(ep, lang)} language={lang === 'curl' ? 'bash' : 'js'} filename={lang === 'curl' ? 'curl' : 'Node'} />
    </div>
  );
}

/** Every endpoint in the spec, grouped as the spec groups them. */
export function AgencyApiReference() {
  const [lang, setLang] = useState<Lang>('curl');
  return (
    <>
      <DocSection title="Endpoints">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <P>
            {AGENCY_API.length} endpoints in {AGENCY_API_GROUPS.length} groups. Paths are relative to{' '}
            <C>https://api.seentics.com</C>.
          </P>
          <LangTabs lang={lang} onChange={setLang} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2" data-testid="agency-reference-index">
          {AGENCY_API_GROUPS.map((group) => (
            <div key={group} className="space-y-1.5">
              <a href={`#${groupAnchor(group)}`} className="text-sm font-semibold text-foreground hover:text-primary">
                {group}
              </a>
              <ul className="space-y-1">
                {AGENCY_API.filter((e) => e.group === group).map((ep) => (
                  <li key={ep.id}>
                    <a href={`#${ep.id}`} className="flex gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                      <span className="w-12 shrink-0 font-mono text-[11px] font-semibold uppercase">{ep.method}</span>
                      <span className="min-w-0">{ep.summary}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DocSection>

      {AGENCY_API_GROUPS.map((group) => (
        <DocSection key={group} id={groupAnchor(group)} title={group}>
          <div className="space-y-10">
            {AGENCY_API.filter((e) => e.group === group).map((ep) => (
              <ReferenceEndpoint key={ep.id} ep={ep} lang={lang} />
            ))}
          </div>
        </DocSection>
      ))}

      <DocSection id="errors" title="Error codes">
        <AgencyErrorTable />
      </DocSection>
    </>
  );
}
