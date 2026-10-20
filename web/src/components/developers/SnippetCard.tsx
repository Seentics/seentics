'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

/** The site's own tracking snippet, served from this dashboard's origin (read after mount). */
export function trackingSnippet(websiteId: string, origin: string): string {
  return `<script defer data-website-id="${websiteId}" src="${origin}/trackers/seentics.min.js"></script>`;
}

export function SnippetCard({ websiteId }: { websiteId: string }) {
  const all = useT();
  const t = all.developers.snippet;
  const [origin, setOrigin] = useState('https://seentics.com');
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const snippet = trackingSnippet(websiteId, origin);

  const copy = () => {
    void navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="mb-5 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t.pasteInto} <code className="font-mono">&lt;head&gt;</code> {t.ofEveryPage}{' '}
            <code className="font-mono">{websiteId}</code>
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" onClick={copy} aria-label={t.copySnippet}>
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? all.actions.copied : all.actions.copy}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed text-foreground">
        <code data-testid="tracking-snippet">{snippet}</code>
      </pre>
    </section>
  );
}
