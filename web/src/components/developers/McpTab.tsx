'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, MessageSquareText } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/developers/CopyButton';
import { useT } from '@/lib/i18n';

/** The MCP endpoint, absolute: an assistant runs outside this page, so a same-origin path is no use. */
export function mcpUrl(origin: string): string {
  const url = getApiUrl('/mcp');
  return url.startsWith('http') ? url : `${origin}${url}`;
}

const KEY = 'YOUR_API_KEY';

/** How each assistant is pointed at the server. Every one sends the key as a Bearer token. Where each goes is `mcp.where[id]`. */
export function mcpClientSnippets(url: string): Array<{ id: 'claude-code' | 'claude-desktop' | 'cursor' | 'vscode' | 'other'; label: string; code: string }> {
  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      code: `claude mcp add --transport http seentics ${url} \\\n  --header "Authorization: Bearer ${KEY}"`,
    },
    {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      code: JSON.stringify({
        mcpServers: {
          seentics: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', `Authorization: Bearer ${KEY}`] },
        },
      }, null, 2),
    },
    {
      id: 'cursor',
      label: 'Cursor',
      code: JSON.stringify({ mcpServers: { seentics: { url, headers: { Authorization: `Bearer ${KEY}` } } } }, null, 2),
    },
    {
      id: 'vscode',
      label: 'VS Code',
      code: JSON.stringify({ servers: { seentics: { type: 'http', url, headers: { Authorization: `Bearer ${KEY}` } } } }, null, 2),
    },
    {
      id: 'other',
      label: 'Other',
      code: `URL     ${url}\nHeader  Authorization: Bearer ${KEY}`,
    },
  ];
}

/** The server's tools, as the assistant sees them (Core `app/http/mcp/tools.ts`); what each reads is `mcp.tools[i]`. */
const TOOLS: string[] = [
  'list_websites',
  'compare_websites',
  'explain_change',
  'compare_segment',
  'get_traffic_summary, get_top_pages, get_top_sources, get_audience_breakdown',
  'get_goal_stats, list_funnels, get_funnel_performance, get_revenue_summary',
  'list_frustrated_sessions, get_session_summary, list_heatmap_pages, get_heatmap_insights',
  'list_error_groups, list_alerts, list_recommendations',
];

/**
 * Seentics inside an AI assistant: one account key with the data scopes, and the snippet for
 * the assistant. The server reads only, so a key on the `assistant` preset cannot change anything.
 */
export function McpTab({ onCreateKey }: { onCreateKey: () => void }) {
  const t = useT().developers.mcp;
  const [origin, setOrigin] = useState('https://seentics.com');
  useEffect(() => setOrigin(window.location.origin), []);
  const url = mcpUrl(origin);
  const snippets = mcpClientSnippets(url);
  const [client, setClient] = useState(snippets[0]!.id);
  const chosen = snippets.find(s => s.id === client) ?? snippets[0]!;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t.askTitle}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t.askBody}</p>
        </div>
        <ul className="grid gap-1.5 px-4 py-3 sm:grid-cols-2">
          {t.examples.map(q => (
            <li key={q} className="flex items-start gap-2 text-xs text-foreground">
              <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span>“{q}”</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{t.step1}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t.step1Use} <strong>{t.step1Access}</strong> {t.step1Rest}
            </p>
          </div>
          <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={onCreateKey} data-testid="mcp-create-key">
            <KeyRound className="h-3.5 w-3.5" />
            {t.createKey}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t.step2}</h3>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 font-mono text-xs" data-testid="mcp-url">{url}</code>
            <CopyButton text={url} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2" role="tablist" aria-label={t.assistant}>
          {snippets.map(s => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === client}
              onClick={() => setClient(s.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                s.id === client ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {s.id === 'other' ? t.other : s.label}
            </button>
          ))}
        </div>
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">{t.where[chosen.id]}</p>
            <CopyButton text={chosen.code} />
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted/30 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground">
            <code data-testid="mcp-snippet">{chosen.code}</code>
          </pre>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t.replace}<code className="font-mono">{KEY}</code> {t.withKey}{' '}
            <Link href="/docs/mcp" className="text-primary hover:underline">{t.guide}</Link>{t.forMore}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t.canRead}</h3>
        </div>
        <ul className="divide-y divide-border">
          {TOOLS.map((names, i) => (
            <li key={names} className="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="text-xs text-foreground sm:w-56 sm:shrink-0">{t.tools[i]}</span>
              <code className="min-w-0 break-words font-mono text-[11px] text-muted-foreground">{names}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
