'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AppWindow, Globe, Loader2, RefreshCw } from 'lucide-react';
import { createEmbedToken, type EmbedToken } from '@/features/agency';
import { getWebsites } from '@/features/websites/api';
import { demoWebsite, isDemo } from '@/lib/demo';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CopyButton } from '@/components/agency/CopyButton';
import { cn } from '@/lib/utils';

const LIFETIMES = [
  { seconds: 3600, label: '1 hour' },
  { seconds: 86400, label: '24 hours' },
  { seconds: 7 * 86400, label: '7 days' },
  { seconds: 30 * 86400, label: '30 days' },
];

function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-white p-0.5 shadow-sm dark:bg-muted">
      {options.map(o => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-primary/10 text-primary dark:bg-background dark:text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The iframe plus the few lines that let it size itself to its content. */
function snippetFor(src: string, origin: string): string {
  return `<iframe
  src="${src}"
  title="Analytics"
  loading="lazy"
  style="width: 100%; height: 900px; border: 0;"
></iframe>
<script>
  // Grow the iframe to fit the dashboard, so it never scrolls inside your page.
  window.addEventListener("message", function (e) {
    if (e.origin !== "${origin}" || !e.data || e.data.type !== "seentics:embed:resize") return;
    document.querySelectorAll('iframe[src^="${origin}/embed/"]').forEach(function (f) {
      f.style.height = e.data.height + "px";
    });
  });
</script>`;
}

export function EmbedsTab({ websiteId }: { websiteId: string }) {
  const demo = isDemo(websiteId);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const { data: sites = [] } = useQuery({
    queryKey: ['websites', demo],
    queryFn: async () => (demo ? [demoWebsite()] : getWebsites()),
    enabled: !!websiteId,
  });
  const [siteId, setSiteId] = useState(websiteId);
  useEffect(() => setSiteId(websiteId), [websiteId]);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [lifetime, setLifetime] = useState(3600);
  const [token, setToken] = useState<EmbedToken | null>(null);
  const [view, setView] = useState<'preview' | 'code'>('preview');
  // A token belongs to one site: changing site invalidates the one on screen.
  useEffect(() => setToken(null), [siteId]);

  const generate = useMutation({
    mutationFn: async (): Promise<EmbedToken> => {
      if (demo) {
        return { token: '', expiresAt: new Date(Date.now() + lifetime * 1000).toISOString(), embedUrl: `${origin}/embed/demo` };
      }
      return createEmbedToken(siteId, lifetime);
    },
    onSuccess: setToken,
    onError: (e: any) =>
      toast.error(e?.response?.status === 403 ? 'Only admins and owners of this website can embed it.' : 'Could not create the embed link.'),
  });

  /** The token's URL plus the presentation options, which need no new token. */
  const src = useMemo(() => {
    if (!token) return '';
    const url = new URL(token.embedUrl);
    if (theme !== 'auto') url.searchParams.set('theme', theme);
    if (days !== 30) url.searchParams.set('days', String(days));
    return url.toString();
  }, [token, theme, days]);

  const field = (label: string, control: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label className="block text-xs text-muted-foreground">{label}</Label>
      {control}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Settings: what to embed, then how it looks, then generate. */}
      <aside className="surface h-fit space-y-4 p-5">
        <h3 className="text-sm font-semibold text-foreground">Settings</h3>
        {field('Website', (
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="h-9 text-sm">
              <Globe className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
              <SelectValue placeholder="Choose a website" />
            </SelectTrigger>
            <SelectContent>
              {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        {field('Link expires after', (
          <Select value={String(lifetime)} onValueChange={v => setLifetime(Number(v))}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIFETIMES.map(l => <SelectItem key={l.seconds} value={String(l.seconds)}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        {field('Theme', (
          <Segmented value={theme} onChange={setTheme} options={[
            { value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
          ]} />
        ))}
        {field('Opens on', (
          <Segmented value={days} onChange={setDays} options={[
            { value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' },
          ]} />
        ))}

        <div className="space-y-2 border-t border-border/60 pt-4">
          <Button className="w-full gap-1.5" disabled={!siteId || generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : token ? <RefreshCw className="h-3.5 w-3.5" /> : null}
            {token ? 'Generate new link' : 'Generate embed'}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {token
              ? `Works until ${format(new Date(token.expiresAt), 'MMM d, HH:mm')}. For a page people visit daily, mint a fresh link per visit from your backend — see Management API.`
              : 'For a page people visit daily, mint a fresh link per visit from your backend — see Management API.'}
          </p>
        </div>
      </aside>

      {/* Result: the preview, or the code to paste. */}
      <section className="surface min-w-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <Segmented value={view} onChange={setView} options={[
            { value: 'preview', label: 'Preview' }, { value: 'code', label: 'Embed code' },
          ]} />
          {token && view === 'code' && <CopyButton text={snippetFor(src, origin)} />}
        </div>
        {!token ? (
          <div className="flex h-[560px] flex-col items-center justify-center gap-2 text-center">
            <AppWindow className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Nothing to preview yet</p>
            <p className="text-xs text-muted-foreground">Choose a website and generate an embed.</p>
          </div>
        ) : view === 'preview' ? (
          <iframe key={src} src={src} title="Embed preview" className="h-[760px] w-full border-0 bg-muted/30" />
        ) : (
          <pre className="max-h-[760px] overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200">
            <code>{snippetFor(src, origin)}</code>
          </pre>
        )}
      </section>
    </div>
  );
}
