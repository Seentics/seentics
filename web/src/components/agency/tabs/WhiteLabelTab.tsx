'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getWhiteLabel, updateWhiteLabel, type WhiteLabelSettings } from '@/features/agency';
import { demoMutationGuard, demoWhiteLabel, isDemo } from '@/lib/demo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const DEFAULT_COLOR = '#6366f1';
const isValidHex = (v: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);

const field = 'h-8 !bg-card text-xs';
const box = 'space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={box}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Cloud only: the branding clients see. Served by the gateway. */
export function WhiteLabelTab({ websiteId }: { websiteId: string }) {
  const queryClient = useQueryClient();
  const demo = isDemo(websiteId);
  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['agency-white-label', demo],
    queryFn: () => (demo ? Promise.resolve(demoWhiteLabel()) : getWhiteLabel()),
  });

  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [hex, setHex] = useState(DEFAULT_COLOR);
  const [supportEmail, setSupportEmail] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [hideSeentics, setHideSeentics] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBrandName(settings.brandName);
    setLogoUrl(settings.logoUrl);
    setColor(settings.primaryColor || DEFAULT_COLOR);
    setHex(settings.primaryColor || DEFAULT_COLOR);
    setSupportEmail(settings.supportEmail);
    setCustomDomain(settings.customDomain);
    setHideSeentics(settings.hideSeentics);
  }, [settings]);
  useEffect(() => setLogoFailed(false), [logoUrl]);

  const mutation = useMutation({
    mutationFn: async (req: Partial<WhiteLabelSettings>) => {
      if (demoMutationGuard(websiteId)) return null;
      return updateWhiteLabel(req);
    },
    onSuccess: (updated) => {
      if (!updated) return;
      toast.success('White label settings saved');
      queryClient.setQueryData(['agency-white-label', demo], updated);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save settings'),
  });

  const save = () =>
    mutation.mutate({
      brandName: brandName.trim(),
      logoUrl: logoUrl.trim(),
      primaryColor: isValidHex(hex) ? hex : color,
      supportEmail: supportEmail.trim(),
      customDomain: customDomain.trim(),
      hideSeentics,
    });

  const pickColor = (val: string) => {
    setHex(val);
    if (isValidHex(val)) setColor(val);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Failed to load white label settings. Please refresh the page.
      </div>
    );
  }

  const shownName = brandName.trim() || 'Your agency';
  const accent = isValidHex(hex) ? hex : color;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Section title="Brand" hint="How your agency appears to clients.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand name" hint="Shown in the sidebar and in emails.">
              <Input placeholder="Your agency name" value={brandName} onChange={e => setBrandName(e.target.value)} className={field} />
            </Field>
            <Field label="Primary color" hint="Buttons and highlights.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => pickColor(e.target.value)}
                  aria-label="Pick a color"
                  className="h-8 w-10 cursor-pointer rounded-md border border-border bg-card p-0.5"
                />
                <Input
                  placeholder={DEFAULT_COLOR}
                  value={hex}
                  onChange={e => pickColor(e.target.value)}
                  maxLength={7}
                  className={cn(field, 'w-28 font-mono', hex.length > 0 && !isValidHex(hex) && 'border-destructive')}
                />
              </div>
            </Field>
          </div>
          <Field label="Logo URL" hint="A PNG or SVG, 48×48 px or larger.">
            <Input placeholder="https://youragency.com/logo.png" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className={field} />
          </Field>
        </Section>

        <Section title="Contact & domain">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email" hint="Shown on help and error pages.">
              <Input type="email" placeholder="support@youragency.com" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className={field} />
            </Field>
            <Field label="Custom domain" hint="Point a CNAME at us to serve from your domain.">
              <Input placeholder="analytics.youragency.com" value={customDomain} onChange={e => setCustomDomain(e.target.value)} className={cn(field, 'font-mono')} />
            </Field>
          </div>
        </Section>

        <section className={cn(box, 'flex flex-row items-center justify-between gap-4 space-y-0')}>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Hide Seentics branding</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Remove Seentics from what clients see, so only your brand shows.</p>
          </div>
          <Switch checked={hideSeentics} onCheckedChange={setHideSeentics} className="shrink-0" aria-label="Hide Seentics branding" />
        </section>

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={mutation.isPending} className="gap-2">
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save settings
          </Button>
        </div>
      </div>

      {/* What a client sees */}
      <aside className="space-y-2 lg:sticky lg:top-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Client view preview</p>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
            {logoUrl && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-7 w-7 rounded-md object-contain" onError={() => setLogoFailed(true)} />
            ) : (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {shownName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-semibold text-foreground">{shownName}</span>
          </div>
          <div className="space-y-2.5 bg-muted/30 p-3.5">
            {['Overview', 'Funnels', 'Heatmaps'].map((item, i) => (
              <div
                key={item}
                className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium', i === 0 ? 'text-white' : 'bg-card text-muted-foreground')}
                style={i === 0 ? { backgroundColor: accent } : undefined}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-2.5 text-[11px] text-muted-foreground">
            <span className="truncate">{supportEmail || 'support@youragency.com'}</span>
            {!hideSeentics && <span className="shrink-0">Powered by Seentics</span>}
          </div>
        </div>
        {customDomain && <p className="truncate text-[11px] text-muted-foreground">https://{customDomain}</p>}
      </aside>
    </div>
  );
}
