'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Copy, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { curlFor, groupEndpoints, useApiCatalogue, type ApiEndpoint } from '@/lib/api-keys-api';

/**
 * The public API reference.
 *
 * Built from the catalogue the server serves, which a test there compares against the
 * router — so this cannot document an endpoint that does not exist, or miss one that
 * does. The previous version of this screen hard-coded a single example with the wrong
 * host, the wrong path and the wrong auth header.
 */

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Could not copy', description: 'Select the text and copy it manually.' });
    }
  };

  return (
    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copy}>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

function EndpointRow({ endpoint, curl }: { endpoint: ApiEndpoint; curl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-[10px]">{endpoint.method}</Badge>
        <span className="min-w-0 flex-1">
          <code className="block truncate font-mono text-xs text-foreground">{endpoint.path}</code>
          <span className="mt-1 block text-[11px] text-muted-foreground">{endpoint.summary}</span>
        </span>
        <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono text-[10px]">{endpoint.scope}</Badge>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          {endpoint.params.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Query parameters
              </p>
              <div className="space-y-1.5">
                {endpoint.params.map(p => (
                  <div key={p.name} className="flex flex-wrap items-baseline gap-2 text-[11px]">
                    <code className="font-mono font-semibold text-foreground">{p.name}</code>
                    <span className="text-muted-foreground">{p.description}</span>
                    {p.default !== undefined && (
                      <span className="text-muted-foreground/70">Default: {p.default}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Example</p>
              <CopyButton value={curl} label="Copy curl" />
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-foreground">
              {curl}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}


export function ApiReferencePanel({ websiteId }: { websiteId: string }) {
  const { data: catalogue, isLoading } = useApiCatalogue();

  // Read here rather than at module scope so the page still renders on the server.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const basePath = catalogue?.meta.base_path ?? '/api/v1/raw';

  const groups = useMemo(() => groupEndpoints(catalogue?.data ?? []), [catalogue]);

  return (
    <div className="space-y-6">
      <div className="surface p-4">
        <div className="flex items-start gap-3">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold text-foreground">Authenticating</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Send your key as an <code className="font-mono">X-API-Key</code> header. Every
              endpoint below is a <code className="font-mono">GET</code> under{' '}
              <code className="font-mono">{basePath}</code>, and answers with{' '}
              <code className="font-mono">{'{ meta, data }'}</code>.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading the reference…</p>
      ) : (
        groups.map(([group, endpoints]) => (
          <div key={group}>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {group}
            </h3>
            <div className="surface overflow-hidden">
              {endpoints.map(e => (
                <EndpointRow
                  key={e.path}
                  endpoint={e}
                  curl={curlFor(e, basePath, origin, websiteId)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
