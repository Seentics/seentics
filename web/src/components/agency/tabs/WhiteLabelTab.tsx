'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, Globe, Loader2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import {
  customDomainError,
  refreshCustomDomain,
  removeCustomDomain,
  setCustomDomain,
  updateWhiteLabel,
  type CustomDomain,
  type WhiteLabelPatch,
  type WhiteLabelSettings,
} from '@/features/agency';
import { agencyKeys, isDemoRefusal, useAgencyMutation, useCustomDomain, useWhiteLabel } from '@/features/agency/queries';
import { isAgencyPlanRequired, useAgencyPlan } from '@/features/agency/plan';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { AgencyPlanPrompt } from '@/components/agency/AgencyPlanPrompt';
import { CopyButton } from '@/components/agency/CopyButton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const DEFAULT_COLOR = '#6366f1';
const isValidHex = (v: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);
/** Core takes only https logos (it loads them on the client's portal). */
const isValidLogo = (v: string) => v === '' || /^https:\/\/[^\s/@]+\.[^\s]+$/i.test(v);

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

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor?: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Pulls a 400 validation message out of Core's `{ error: 'validation_error', details }`, else the generic one. */
function saveError(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; details?: Array<{ message?: string }> } } })?.response?.data;
  return data?.details?.[0]?.message || data?.message || (e as Error)?.message || 'Failed to save settings';
}

/**
 * Cloud only, Agency plan only: the brand on the client portal (served by Core) and the agency's
 * own domain for it (served by the gateway). Without the plan, the prompt in place of both.
 */
export function WhiteLabelTab({ websiteId }: { websiteId: string }) {
  const { allowed, markRefused } = useAgencyPlan(websiteId);
  if (!allowed) return <AgencyPlanPrompt websiteId={websiteId} feature="white-label" />;
  return <WhiteLabelSettingsForm websiteId={websiteId} onPlanRequired={markRefused} />;
}

function WhiteLabelSettingsForm({ websiteId, onPlanRequired }: { websiteId: string; onPlanRequired: () => void }) {
  const queryClient = useQueryClient();
  const demo = isDemo(websiteId);
  const { data: settings, isLoading, isError, error } = useWhiteLabel(websiteId, { enabled: true });
  const { data: domain } = useCustomDomain(websiteId, { enabled: true });

  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [hex, setHex] = useState(DEFAULT_COLOR);
  const [supportEmail, setSupportEmail] = useState('');
  const [footerText, setFooterText] = useState('');
  const [hideSeentics, setHideSeentics] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBrandName(settings.brandName);
    setLogoUrl(settings.logoUrl);
    setColor(settings.primaryColor || DEFAULT_COLOR);
    setHex(settings.primaryColor || DEFAULT_COLOR);
    setSupportEmail(settings.supportEmail);
    setFooterText(settings.footerText);
    setHideSeentics(settings.hideSeentics);
  }, [settings]);
  useEffect(() => setLogoFailed(false), [logoUrl]);

  useEffect(() => {
    if (isAgencyPlanRequired(error)) onPlanRequired();
  }, [error, onPlanRequired]);

  const mutation = useMutation({
    mutationFn: async (req: WhiteLabelPatch): Promise<WhiteLabelSettings | null> => {
      if (demoMutationGuard(websiteId)) return null;
      return updateWhiteLabel(req);
    },
    onSuccess: (updated) => {
      if (!updated) return;
      toast.success('White label settings saved');
      queryClient.setQueryData([...agencyKeys.whiteLabel, demo], updated);
    },
    onError: (e) => {
      if (isAgencyPlanRequired(e)) return onPlanRequired();
      toast.error(saveError(e));
    },
  });

  const logoInvalid = !isValidLogo(logoUrl.trim());
  const hexInvalid = hex.length > 0 && !isValidHex(hex);

  const save = () =>
    mutation.mutate({
      brandName: brandName.trim(),
      logoUrl: logoUrl.trim(),
      primaryColor: isValidHex(hex) ? hex : color,
      supportEmail: supportEmail.trim(),
      footerText: footerText.trim(),
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
        <Section title="Brand" hint="How your agency appears on the client portal.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand name" htmlFor="wl-brand" hint="Shown at the top of the portal.">
              <Input id="wl-brand" placeholder="Your agency name" value={brandName} maxLength={80} onChange={e => setBrandName(e.target.value)} className={field} />
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
                  aria-label="Primary color hex"
                  placeholder={DEFAULT_COLOR}
                  value={hex}
                  onChange={e => pickColor(e.target.value)}
                  maxLength={7}
                  className={cn(field, 'w-28 font-mono', hexInvalid && 'border-destructive')}
                />
              </div>
            </Field>
          </div>
          <Field
            label="Logo URL" htmlFor="wl-logo" hint="An https:// link to a PNG or SVG, 48×48 px or larger."
            error={logoInvalid ? 'The logo must be an https:// address.' : undefined}
          >
            <Input id="wl-logo" placeholder="https://youragency.com/logo.png" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className={cn(field, logoInvalid && 'border-destructive')} />
          </Field>
        </Section>

        <Section title="Contact and footer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email" htmlFor="wl-support" hint="Where the portal tells clients to write.">
              <Input id="wl-support" type="email" placeholder="support@youragency.com" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className={field} />
            </Field>
            <Field label="Footer text" htmlFor="wl-footer" hint="A line at the bottom of the portal.">
              <Input id="wl-footer" placeholder="Reports by Your Agency" value={footerText} maxLength={200} onChange={e => setFooterText(e.target.value)} className={field} />
            </Field>
          </div>
        </Section>

        <section className={cn(box, 'flex flex-row items-center justify-between gap-4 space-y-0')}>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Hide Seentics branding</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Remove &quot;Powered by Seentics&quot; from the portal, so only your brand shows.</p>
          </div>
          <Switch checked={hideSeentics} onCheckedChange={setHideSeentics} className="shrink-0" aria-label="Hide Seentics branding" />
        </section>

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={mutation.isPending || logoInvalid || hexInvalid} className="gap-2">
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save settings
          </Button>
        </div>

        <CustomDomainSection websiteId={websiteId} domain={domain} onPlanRequired={onPlanRequired} />
      </div>

      {/* What a client sees */}
      <aside className="space-y-2 lg:sticky lg:top-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Client portal preview</p>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
            {logoUrl && !logoInvalid && !logoFailed ? (
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
            {['Analytics', 'Recordings', 'Heatmaps'].map((item, i) => (
              <div
                key={item}
                className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium', i === 0 ? 'text-white' : 'bg-card text-muted-foreground')}
                style={i === 0 ? { backgroundColor: accent } : undefined}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-border px-3.5 py-2.5 text-[11px] text-muted-foreground">
            {footerText.trim() && <p className="truncate">{footerText.trim()}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{supportEmail || 'support@youragency.com'}</span>
              {!hideSeentics && <span className="shrink-0">Powered by Seentics</span>}
            </div>
          </div>
        </div>
        {domain?.state === 'active' && <p className="truncate text-[11px] text-muted-foreground">https://{domain.hostname}/client-portal/…</p>}
      </aside>
    </div>
  );
}

// ─── Custom domain ───────────────────────────────────────────────────────────

const STATE_COPY: Record<CustomDomain['state'], { label: string; hint: string; icon: React.ElementType; tone: string }> = {
  pending_dns: {
    label: 'Waiting for DNS',
    hint: 'Add the record below at your DNS provider. This page checks again every few seconds.',
    icon: Clock,
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  pending_certificate: {
    label: 'Issuing certificate',
    hint: 'DNS is set. The HTTPS certificate usually takes a few minutes.',
    icon: Clock,
    tone: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  active: {
    label: 'Active',
    hint: 'Portal links you hand out now use this domain.',
    icon: CheckCircle2,
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  failed: {
    label: 'Failed',
    hint: 'Check the records below, then check again — or remove it and start over.',
    icon: XCircle,
    tone: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

function DnsRecord({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-md border border-border/60 bg-muted/40 p-3 text-xs" data-testid={`dns-${type.toLowerCase()}`}>
      <span className="text-muted-foreground">Type</span>
      <span className="font-mono font-semibold text-foreground">{type}</span>
      <span className="text-muted-foreground">Name</span>
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground">{name}</code>
        <CopyButton text={name} className="h-7 w-7" />
      </span>
      <span className="text-muted-foreground">Value</span>
      <span className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-foreground">{value}</code>
        <CopyButton text={value} className="h-7 w-7" />
      </span>
    </div>
  );
}

/**
 * The portal on the agency's own hostname. Saving registers it with the gateway, which answers with
 * the CNAME (and, sometimes, a TXT ownership record) to add; the state is polled while pending.
 */
export function CustomDomainSection({ websiteId, domain, onPlanRequired }: {
  websiteId: string;
  domain: CustomDomain | null | undefined;
  onPlanRequired: () => void;
}) {
  const queryClient = useQueryClient();
  const demo = isDemo(websiteId);
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const key = [...agencyKeys.customDomain, demo];

  const onFail = (e: unknown) => {
    if (isDemoRefusal(e)) return;
    if (isAgencyPlanRequired(e)) return onPlanRequired();
    setError(customDomainError(e));
  };
  const save = useAgencyMutation(websiteId, setCustomDomain);
  const refresh = useAgencyMutation(websiteId, refreshCustomDomain);
  const remove = useAgencyMutation(websiteId, removeCustomDomain);
  const saved = (d: CustomDomain | null) => { setError(null); queryClient.setQueryData(key, d); };

  const submit = () => {
    const h = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!h) return;
    save.mutate(h, { onSuccess: d => { saved(d); setHostname(''); }, onError: onFail });
  };

  return (
    <Section
      title="Custom domain"
      hint="Serve the client portal from your own domain. Use a subdomain, such as reports.youragency.com — not your main site."
    >
      {confirmDialog}
      {!domain ? (
        <div className="space-y-2">
          <Label htmlFor="wl-domain" className="text-xs">Hostname</Label>
          <div className="flex gap-2">
            <Input
              id="wl-domain"
              placeholder="reports.youragency.com"
              value={hostname}
              onChange={e => { setHostname(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              className={cn(field, 'font-mono', error && 'border-destructive')}
            />
            <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={submit} disabled={!hostname.trim() || save.isPending}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              Add domain
            </Button>
          </div>
        </div>
      ) : (
        <CustomDomainStatus
          domain={domain}
          refreshing={refresh.isPending}
          removing={remove.isPending}
          onRefresh={() => refresh.mutate(undefined, { onSuccess: saved, onError: onFail })}
          onRemove={async () => {
            const ok = await confirm({
              title: `Remove ${domain.hostname}?`,
              description: 'Portal links on this domain stop working. Links on Seentics’ own address keep working.',
              confirmLabel: 'Remove domain',
              destructive: true,
            });
            if (ok) remove.mutate(undefined, { onSuccess: () => { saved(null); toast.success('Custom domain removed'); }, onError: onFail });
          }}
        />
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </Section>
  );
}

function CustomDomainStatus({ domain, refreshing, removing, onRefresh, onRemove }: {
  domain: CustomDomain;
  refreshing: boolean;
  removing: boolean;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const copy = STATE_COPY[domain.state];
  const Icon = copy.icon;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <code className="truncate font-mono text-sm font-semibold text-foreground">{domain.hostname}</code>
          <span data-testid="domain-state" className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', copy.tone)}>
            <Icon className="h-3 w-3" />
            {copy.label}
          </span>
        </div>
        <div className="flex gap-1.5">
          {domain.state !== 'active' && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Check now
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground hover:text-destructive" onClick={onRemove} disabled={removing}>
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {copy.hint}
        {domain.lastCheckedAt && ` Last checked ${formatDistanceToNow(new Date(domain.lastCheckedAt), { addSuffix: true })}.`}
      </p>
      {domain.reason && domain.state !== 'active' && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{domain.reason}</p>
      )}
      {domain.state !== 'active' && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Add {domain.ownershipVerification ? 'these records' : 'this record'} at your DNS provider</p>
          <DnsRecord type="CNAME" name={domain.hostname} value={domain.cnameTarget} />
          {domain.ownershipVerification && (
            <DnsRecord
              type={domain.ownershipVerification.type.toUpperCase()}
              name={domain.ownershipVerification.name}
              value={domain.ownershipVerification.value}
            />
          )}
        </div>
      )}
    </div>
  );
}
