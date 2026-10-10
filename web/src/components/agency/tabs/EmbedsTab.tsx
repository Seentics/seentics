'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Building2, ExternalLink, Globe, Link2, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import type { EmbedLink, EmbedSection } from '@/features/agency';
import { DEFAULT_EMBED_SECTIONS, EMBED_SECTIONS } from '@/features/agency/constants';
import { Switch } from '@/components/ui/switch';
import {
  isDemoRefusal, useAgencyClients, useCreateEmbedLink, useEmbedLinks, useRevokeEmbedLink, useUpdateEmbedLink,
} from '@/features/agency/queries';
import { getWebsites } from '@/features/websites/api';
import { demoWebsite, isDemo } from '@/lib/demo';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CopyButton } from '@/components/agency/CopyButton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The iframe, plus the few lines that let it size itself to its content. */
function snippetFor(src: string, origin: string): string {
  return `<!-- Put this on the page behind your "Analytics" menu item -->
<iframe
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

const box = 'rounded-lg border border-border bg-card p-4 shadow-sm';

export function EmbedsTab({ websiteId }: { websiteId: string }) {
  const demo = isDemo(websiteId);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const { data: sites = [] } = useQuery({
    queryKey: ['websites', demo],
    queryFn: async () => (demo ? [demoWebsite()] : getWebsites()),
    enabled: !!websiteId,
  });
  const { data: clients = [] } = useAgencyClients(websiteId);
  const { data: links = [], isLoading } = useEmbedLinks(websiteId);
  const create = useCreateEmbedLink(websiteId);
  const revoke = useRevokeEmbedLink(websiteId);
  const update = useUpdateEmbedLink(websiteId);
  const [confirm, confirmDialog] = useConfirm();

  const [scope, setScope] = useState<'website' | 'client'>('website');
  const [targetId, setTargetId] = useState(websiteId);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [days, setDays] = useState<7 | 30 | 90>(30);
  // What a new link will show, chosen before it exists; an existing link's own sections win.
  const [draftSections, setDraftSections] = useState<EmbedSection[]>(DEFAULT_EMBED_SECTIONS);

  // Switching between website and client picks a sensible first target.
  useEffect(() => {
    setTargetId(scope === 'website' ? websiteId : clients[0]?.id ?? '');
  }, [scope, websiteId, clients]);

  const link: EmbedLink | undefined = links.find(l => l.scope === scope && l.targetId === targetId);

  /** The link's URL plus the presentation options, which need no new link. */
  const src = useMemo(() => {
    if (!link || !origin) return '';
    const url = new URL(link.embedUrl, origin);
    if (theme !== 'auto') url.searchParams.set('theme', theme);
    if (days !== 30) url.searchParams.set('days', String(days));
    return url.toString();
  }, [link, theme, days, origin]);

  const onError = (e: unknown) => {
    if (isDemoRefusal(e)) return;
    const status = (e as { response?: { status?: number } })?.response?.status;
    toast.error(status === 403 ? 'Only admins and owners of this website can embed it.' : 'Something went wrong. Please try again.');
  };

  const shown: EmbedSection[] = link?.sections ?? draftSections;
  const toggleSection = (id: EmbedSection, on: boolean) => {
    const next = on ? [...shown, id] : shown.filter(x => x !== id);
    if (next.length === 0) return; // a link has to show something
    if (!link) return setDraftSections(next);
    update.mutate({ id: link.id, sections: next }, { onError });
  };

  const makeLink = () =>
    create.mutate({
      target: scope === 'website' ? { websiteId: targetId } : { clientId: targetId },
      sections: draftSections,
    }, {
      onSuccess: () => toast.success('Embed link created'),
      onError,
    });

  const revokeLink = async (l: EmbedLink) => {
    const ok = await confirm({
      title: `Revoke the link for ${l.targetName}?`,
      description: 'Every page showing it stops working at once. You can make a new link afterwards, with a new URL.',
      confirmLabel: 'Revoke link',
      destructive: true,
    });
    if (!ok) return;
    revoke.mutate(l.id, { onSuccess: () => toast.success('Link revoked'), onError });
  };

  const targets = scope === 'website'
    ? sites.map(s => ({ id: s.id, name: s.name }))
    : clients.map(c => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      {confirmDialog}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={cn(box, 'space-y-3')}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">What to embed</h3>
              <Segmented value={scope} onChange={setScope} options={[
                { value: 'website', label: 'Website' }, { value: 'client', label: 'Client' },
              ]} />
            </div>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-9 !bg-card text-sm">
                {scope === 'website'
                  ? <Globe className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
                  : <Building2 className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />}
                <SelectValue placeholder={scope === 'website' ? 'Choose a website' : 'Choose a client'} />
              </SelectTrigger>
              <SelectContent>
                {targets.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {scope === 'website'
                ? 'Shows this website’s analytics.'
                : 'Shows all of this client’s websites, with a switcher between them.'}
            </p>
          </div>

        <div className={cn(box, 'space-y-3')}>
          <div>
            <h3 className="text-sm font-semibold text-foreground">What to show</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {link ? 'Changes apply to the link at once. The URL stays the same.' : 'Choose what this link will show.'}
            </p>
          </div>
          <ul className="divide-y divide-border rounded-md border bg-muted/20">
            {EMBED_SECTIONS.map(sec => {
              const on = shown.includes(sec.id);
              const onlyOne = on && shown.length === 1;
              return (
                <li key={sec.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{sec.label}</p>
                      <p className="text-[11px] text-muted-foreground">{sec.description}</p>
                    </div>
                    <Switch
                      className="shrink-0"
                      checked={on}
                      disabled={onlyOne || update.isPending}
                      onCheckedChange={v => toggleSection(sec.id, v)}
                      aria-label={sec.label}
                    />
                  </div>
                  {on && sec.caution && (
                    <p className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" /> {sec.caution}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className={cn(box, 'space-y-3')}>
              <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div className="space-y-1.5">
                  <Label className="block text-xs text-muted-foreground">Theme</Label>
                  <Segmented value={theme} onChange={setTheme} options={[
                    { value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
                  ]} />
                </div>
                <div className="space-y-1.5">
                  <Label className="block text-xs text-muted-foreground">Opens on</Label>
                  <Segmented value={days} onChange={setDays} options={[
                    { value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' },
                  ]} />
                </div>
              </div>
            </div>

          {/* Every active link, so a forgotten one can be found and revoked. */}
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
              <h3 className="text-sm font-semibold text-foreground">Active links</h3>
              <span className="text-[11px] text-muted-foreground">
                {isLoading ? 'Loading…' : `${links.length} · none expire`}
              </span>
            </div>
            {links.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-muted-foreground">No embed links yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {links.map(l => {
                  const url = origin ? new URL(l.embedUrl, origin).toString() : l.embedUrl;
                  return (
                    <li key={l.id} className="flex items-center gap-2.5 px-4 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {l.scope === 'website' ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-tight text-foreground">{l.targetName}</p>
                        <p className="text-[11px] leading-tight text-muted-foreground">
                          {l.scope === 'website' ? 'Website' : 'Client'} · {format(new Date(l.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Open preview" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                      <CopyButton text={url} />
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Revoke link" disabled={revoke.isPending} onClick={() => revokeLink(l)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <div className={cn(box, 'space-y-3')}>
            <h3 className="text-sm font-semibold text-foreground">Embed link</h3>
            {link ? (
              <>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 py-1 pl-3 pr-1">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{src}</code>
                  <CopyButton text={src} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5" asChild>
                    <a href={src} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open preview
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => revokeLink(link)}>
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </Button>
                </div>
                <p className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />
                  It never expires. Anyone who has it can see these analytics, so keep it private.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  One permanent link per {scope}. Open it in a browser to see the dashboard, or put it in an iframe in your own
                  product, for example behind an &quot;Analytics&quot; menu item.
                </p>
                <Button className="w-full gap-1.5" size="sm" disabled={!targetId || create.isPending} onClick={makeLink}>
                  {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Create embed link
                </Button>
              </>
            )}
          </div>

          {link && (
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 py-1 pl-3 pr-1">
                <span className="text-[11px] font-medium text-zinc-400">Iframe code</span>
                <CopyButton text={snippetFor(src, origin)} className="h-6 w-6 border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" />
              </div>
              <pre className="max-h-64 overflow-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-200">
                <code>{snippetFor(src, origin)}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
