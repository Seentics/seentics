'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The docs' shared primitives.
 *
 * `CodeBlock`, `EndpointBlock` and a section-header helper were defined separately in
 * the 1,580-line index page and again in several of the route pages, so a fix to any
 * of them had to be made in more than one place and they had already drifted.
 *
 * The design is deliberately plainer than what it replaces. The old pages gave every
 * section a coloured icon tile — blue, emerald, pink, red, orange, purple, cyan,
 * amber, indigo, violet — which put eleven unrelated hues down a reference document,
 * and the layout floated a `blur-[160px]` primary glow behind the text. Colour here
 * now means something: an HTTP method, or the kind of a callout.
 */

/* ── Page scaffolding ─────────────────────────────────────────────────────── */

export function DocPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  /** The nav group this page sits in, so you know where you are. */
  eyebrow?: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <article className="min-w-0">
      <header className="mb-10 border-b border-border pb-8">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-primary/70">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        {lead && <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{lead}</p>}
      </header>

      {/* `[&>section]` rather than a wrapper per section: every page is a stack of
          sections and this keeps the rhythm in one place. */}
      <div className="space-y-12 [&>section]:scroll-mt-24">{children}</div>
    </article>
  );
}

export function DocSection({
  id,
  title,
  children,
}: {
  id?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      {title && (
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      )}
      {children}
    </section>
  );
}

/** Body copy. Kept to a comfortable measure — reference text is read, not scanned. */
export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return (
    <ul className="max-w-[68ch] space-y-2 text-[15px] leading-relaxed text-muted-foreground">
      {children}
    </ul>
  );
}

export function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Inline code. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[0.86em] text-foreground">
      {children}
    </code>
  );
}

/* ── Code ─────────────────────────────────────────────────────────────────── */

export function CodeBlock({
  code,
  language = 'bash',
  filename,
}: {
  code: string;
  language?: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <span className="font-mono text-[11px] text-muted-foreground">{filename ?? language}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Code keeps a fixed dark surface in both themes. A light code block on a
          light page loses the one visual cue that says "this is literal text". */}
      <pre className="overflow-x-auto bg-zinc-950 p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-zinc-200">{code}</code>
      </pre>
    </div>
  );
}

/* ── Callouts ─────────────────────────────────────────────────────────────── */

const CALLOUTS = {
  note: { icon: Info, ring: 'border-border', tint: 'bg-muted/40', mark: 'text-muted-foreground' },
  tip: {
    icon: Lightbulb,
    ring: 'border-emerald-500/25',
    tint: 'bg-emerald-500/[0.07]',
    mark: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-amber-500/30',
    tint: 'bg-amber-500/[0.08]',
    mark: 'text-amber-600 dark:text-amber-400',
  },
} as const;

export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: keyof typeof CALLOUTS;
  title?: string;
  children: ReactNode;
}) {
  const c = CALLOUTS[kind];
  return (
    <div className={cn('max-w-[68ch] rounded-lg border p-4', c.ring, c.tint)}>
      <div className="flex gap-3">
        <c.icon className={cn('mt-0.5 h-4 w-4 shrink-0', c.mark)} />
        <div className="min-w-0 space-y-1">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <div className="text-[14px] leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Reference tables ─────────────────────────────────────────────────────── */

/**
 * An attribute/parameter table.
 *
 * A table rather than prose because that is what people scan a reference for, and it
 * makes an omission obvious — the old tracker page described four attributes in
 * paragraphs, two of which did not exist.
 */
export function RefTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-[14px] text-muted-foreground [&_code]:whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Endpoints ────────────────────────────────────────────────────────────── */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Semantic, and the one place colour is doing real work on these pages. */
const METHOD: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  POST: 'bg-blue-500/12 text-blue-700 dark:text-blue-400',
  PUT: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  PATCH: 'bg-orange-500/12 text-orange-700 dark:text-orange-400',
  DELETE: 'bg-rose-500/12 text-rose-700 dark:text-rose-400',
};

export function Endpoint({
  method,
  path,
  children,
  response,
}: {
  method: HttpMethod;
  path: string;
  children?: ReactNode;
  response?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-muted/40 px-4 py-3">
        <span className={cn('rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider', METHOD[method])}>
          {method}
        </span>
        <code className="min-w-0 break-all font-mono text-[13px] text-foreground">{path}</code>
      </div>
      {children && <div className="px-4 py-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>}
      {response && (
        <div className="border-t border-border bg-zinc-950 px-4 py-3">
          <pre className="overflow-x-auto text-[12px] leading-relaxed">
            <code className="font-mono text-zinc-300">{response}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
