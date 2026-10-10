'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CopyButton } from '@/components/agency/CopyButton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type DocField = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  default?: string;
  /** Shown in the payload. Without one: the request example's value, else the default. */
  example?: unknown;
  /** Fields of a nested object, each shown on its own commented line. */
  children?: DocField[];
};

/** One endpoint, as the reference renders it. Both APIs' specs are written in this shape. */
export type EndpointDoc = {
  method: HttpMethod;
  /** Relative to the API's base URL, with `:param` placeholders. */
  path: string;
  group: string;
  /** Plain-English name, e.g. "Create a client". */
  title: string;
  /** What it does and when to use it — a sentence or two a reader can act on. */
  description: string;
  /** What the key needs, e.g. `websites:write` or `analytics:read`. */
  access: string;
  pathParams?: DocField[];
  query?: DocField[];
  body?: DocField[];
  exampleBody?: unknown;
  /** Status of the example response. */
  status: number;
  exampleResponse: unknown;
  /** Other answers worth knowing, e.g. `409 website_limit_reached`. */
  errors?: { status: number; code: string; when: string }[];
};

const METHOD_STYLE: Record<HttpMethod, string> = {
  GET: 'text-sky-600 dark:text-sky-400',
  POST: 'text-emerald-600 dark:text-emerald-400',
  PATCH: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-rose-600 dark:text-rose-400',
};

const METHOD_PILL: Record<HttpMethod, string> = {
  GET: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  POST: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  PATCH: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  DELETE: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const docId = (d: EndpointDoc) => `${d.method} ${d.path}`;

/** The first sentence: a reference line, not a paragraph. */
const firstSentence = (text: string) => (text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text).replace(/`/g, '');

const STATUS_TEXT: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content' };

/**
 * The request as a commented example: every field on its own line, explained by a `//`
 * comment, so the payload documents itself. Values come from the example where there is
 * one, otherwise a placeholder of the field's type.
 */
const comment = (f: DocField) => `// ${f.required ? 'required — ' : ''}${firstSentence(f.description)}`;

function objectLines(fields: DocField[], example: Record<string, unknown>, indent: string): string[] {
  return fields.flatMap((f, i) => {
    const comma = i < fields.length - 1 ? ',' : '';
    if (f.children?.length) {
      const nested = (example[f.name] ?? {}) as Record<string, unknown>;
      return [
        `${indent}"${f.name}": {  ${comment(f)}`,
        ...objectLines(f.children, nested, `${indent}  `),
        `${indent}}${comma}`,
      ];
    }
    const value = f.example ?? example[f.name] ?? f.default;
    return [`${indent}"${f.name}": ${JSON.stringify(value ?? null)}${comma}  ${comment(f)}`];
  });
}

function payloadFor(doc: EndpointDoc): string | null {
  if (doc.body?.length) {
    return `{\n${objectLines(doc.body, (doc.exampleBody ?? {}) as Record<string, unknown>, '  ').join('\n')}\n}`;
  }
  if (doc.query?.length) {
    return doc.query
      .map(f => `${f.name}=${f.default ?? '…'}  // ${f.required ? 'required — ' : ''}${firstSentence(f.description)}`)
      .join('\n');
  }
  return null;
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 py-1 pl-3 pr-1">
        <span className="text-[11px] font-medium text-zinc-400">{title}</span>
        <CopyButton text={code} className="h-6 w-6 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" />
      </div>
      <pre className="max-h-[440px] overflow-auto p-3 font-mono text-xs leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** One endpoint: title, one-line description, URL, payload and response. Nothing else. */
function EndpointDetail({ doc, baseUrl }: { doc: EndpointDoc; baseUrl: string }) {
  const url = `${baseUrl}${doc.path}`;
  const payload = payloadFor(doc);
  const response = `// ${doc.status} ${STATUS_TEXT[doc.status] ?? ''}\n${doc.exampleResponse === null ? '' : JSON.stringify(doc.exampleResponse, null, 2)}`;

  return (
    <article className="max-w-3xl space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{doc.title}</h2>
        <p className="text-sm text-muted-foreground">{firstSentence(doc.description)}</p>
      </header>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pl-3 pr-1">
        <span className={cn('font-mono text-xs font-bold', METHOD_STYLE[doc.method])}>{doc.method}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{url}</code>
        <CopyButton text={url} />
      </div>

      {/* What the key must be allowed to do. A call without it answers 403 insufficient_scope. */}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        Requires the
        <code className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{doc.access}</code>
        scope
      </p>

      {payload && <CodeBlock title={doc.body ? 'Payload' : 'Query parameters'} code={payload} />}
      <CodeBlock title="Response" code={response} />
    </article>
  );
}

/**
 * An API reference: endpoints listed on the left, the selected one on the right with its
 * description, URL, headers, parameters and a Request / Response code panel.
 */
export function EndpointReference({ docs, baseUrl, intro }: {
  docs: EndpointDoc[];
  /** Absolute base every `path` is appended to. */
  baseUrl: string;
  /** One line on authentication, shown once above the list. */
  intro: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => !q || `${d.title} ${d.method} ${d.path} ${d.group}`.toLowerCase().includes(q));
  }, [docs, search]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, EndpointDoc[]>();
    for (const d of filtered) byGroup.set(d.group, [...(byGroup.get(d.group) ?? []), d]);
    return [...byGroup.entries()];
  }, [filtered]);

  const current = docs.find(d => docId(d) === selected) ?? filtered[0] ?? docs[0];

  return (
    <div className="surface flex flex-col overflow-hidden lg:h-[calc(100vh-11rem)] lg:min-h-[520px]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0 text-sm text-muted-foreground">{intro}</div>
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pl-3 pr-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Base URL</span>
          <code className="truncate font-mono text-xs text-foreground">{baseUrl}</code>
          <CopyButton text={baseUrl} />
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 lg:flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="border-b border-border p-3 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${docs.length} endpoints`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {groups.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">No match.</p>}
          {groups.map(([group, items]) => (
            <div key={group} className="mb-3">
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
              {items.map(d => {
                const active = current && docId(d) === docId(current);
                return (
                  <button
                    key={docId(d)}
                    onClick={() => setSelected(docId(d))}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                      active ? 'bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className={cn('w-12 shrink-0 rounded px-1 py-px text-center font-mono text-[9.5px] font-bold', METHOD_PILL[d.method])}>
                      {d.method}
                    </span>
                    <span className="truncate">{d.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="min-w-0 p-6 lg:min-h-0 lg:overflow-y-auto lg:p-8">
          {current ? (
            <EndpointDetail doc={current} baseUrl={baseUrl} />
          ) : (
            <p className="text-sm text-muted-foreground">No endpoints.</p>
          )}
        </div>
      </div>
    </div>
  );
}
