'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateBranding } from '@/features/agency/api';
import { useAgencyMutation, useBranding, useDomain } from '@/features/agency/queries';
import type { BrandingInput } from '@/features/agency/types';
import { useT } from '@/lib/i18n';
import { agencyEn, type AgencyMessages } from '@/lib/i18n/messages/agency-en';
import { DomainSection } from './DomainSection';
import { ErrorNote, LoadingRow, Panel, WorkspacePage, useErrorText } from './ui';

const EMPTY: BrandingInput = {
  brand_name: '', logo_url: '', primary_color: '#2563eb', support_email: '', footer_text: '', hide_seentics: false, slug: '',
};

const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9-]{3,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is wrong with the form, field by field, in `m`'s language; empty when it can be saved. */
export function brandingProblems(
  f: BrandingInput,
  m: AgencyMessages['branding']['problems'] = agencyEn.branding.problems,
): Partial<Record<keyof BrandingInput, string>> {
  const p: Partial<Record<keyof BrandingInput, string>> = {};
  if (f.logo_url && !f.logo_url.startsWith('https://')) p.logo_url = m.logo;
  if (f.primary_color && !HEX.test(f.primary_color)) p.primary_color = m.colour;
  if (f.support_email && !EMAIL.test(f.support_email)) p.support_email = m.email;
  if (f.slug && !SLUG.test(f.slug.trim().toLowerCase())) p.slug = m.slug;
  return p;
}

function Preview({ form, domain }: { form: BrandingInput; domain: string | null }) {
  const t = useT().agency.branding.preview;
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [form.logo_url]);
  const name = form.brand_name.trim() || t.yourAgency;
  const accent = HEX.test(form.primary_color) ? form.primary_color : '#2563eb';
  const address = domain ? `https://${domain}` : form.slug ? `seentics.com/signin?agency=${form.slug.trim().toLowerCase()}` : 'seentics.com';
  return (
    <div data-testid="brand-preview" className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t.title}</p>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="truncate border-b border-border bg-muted/40 px-3 py-1.5 font-mono text-[10.5px] text-muted-foreground">{address}</div>
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
          {form.logo_url.startsWith('https://') && !logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo_url} alt="" className="h-7 w-7 rounded-md object-contain" onError={() => setLogoFailed(true)} />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: accent }}>
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
        </div>
        <div className="space-y-2 bg-muted/30 p-3.5">
          {t.nav.map((item, i) => (
            <div key={item} className={i === 0 ? 'rounded-md px-2.5 py-1.5 text-xs font-medium text-white' : 'rounded-md bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground'}
              style={i === 0 ? { backgroundColor: accent } : undefined}>
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t border-border px-3.5 py-2.5 text-[11px] text-muted-foreground">
          {form.footer_text.trim() && <p className="truncate">{form.footer_text.trim()}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{form.support_email || 'support@youragency.com'}</span>
            {!form.hide_seentics && <span className="shrink-0">{t.poweredBy}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandingView() {
  const t = useT().agency.branding;
  const errorMessage = useErrorText();
  const branding = useBranding();
  const domain = useDomain();
  const [form, setForm] = useState<BrandingInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const save = useAgencyMutation(updateBranding);

  useEffect(() => {
    if (!branding.data) return;
    const { updated_at: _u, ...rest } = branding.data;
    setForm({ ...EMPTY, ...rest, slug: rest.slug ?? '' });
  }, [branding.data]);

  const problems = brandingProblems(form, t.problems);
  const field = <K extends keyof BrandingInput>(k: K) => ({
    id: `brand-${k}`,
    value: (form[k] ?? '') as string,
    onChange: (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value })),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(problems).length) return;
    setError(null);
    save.mutate(
      {
        ...form,
        brand_name: form.brand_name.trim(),
        footer_text: form.footer_text.trim(),
        support_email: form.support_email.trim(),
        slug: form.slug?.trim().toLowerCase() || null,
      },
      { onSuccess: () => toast.success(t.saved), onError: err => setError(errorMessage(err)) },
    );
  };

  const activeDomain = domain.data?.state === 'active' ? domain.data.hostname : null;

  return (
    <WorkspacePage title={t.title} description={t.description}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel title={t.whiteLabel}>
            {branding.isLoading ? <LoadingRow /> : branding.isError ? <ErrorNote>{errorMessage(branding.error)}</ErrorNote> : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-brand_name" className="text-xs">{t.brandName}</Label>
                    <Input {...field('brand_name')} placeholder="Meridian Digital" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-slug" className="text-xs">{t.signinName}</Label>
                    <Input {...field('slug')} placeholder="meridian" className="h-9 font-mono" />
                    {problems.slug && <ErrorNote>{problems.slug}</ErrorNote>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-logo_url" className="text-xs">{t.logoUrl}</Label>
                  <Input {...field('logo_url')} placeholder="https://cdn.youragency.com/logo.png" className="h-9" />
                  {problems.logo_url && <ErrorNote>{problems.logo_url}</ErrorNote>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-primary_color" className="text-xs">{t.primaryColour}</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        aria-label={t.pickColour}
                        value={HEX.test(form.primary_color) ? form.primary_color : '#2563eb'}
                        onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-card p-1"
                      />
                      <Input {...field('primary_color')} className="h-9 font-mono" />
                    </div>
                    {problems.primary_color && <ErrorNote>{problems.primary_color}</ErrorNote>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-support_email" className="text-xs">{t.supportEmail}</Label>
                    <Input {...field('support_email')} type="email" placeholder="help@youragency.com" className="h-9" />
                    {problems.support_email && <ErrorNote>{problems.support_email}</ErrorNote>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand-footer_text" className="text-xs">{t.footerText}</Label>
                  <Input {...field('footer_text')} placeholder={t.footerPlaceholder} className="h-9" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <Label htmlFor="brand-hide" className="text-xs font-medium text-foreground">{t.hideSeentics}</Label>
                    <p className="text-[11px] text-muted-foreground">{t.hideSeenticsBody}</p>
                  </div>
                  <Switch id="brand-hide" checked={form.hide_seentics} onCheckedChange={v => setForm(f => ({ ...f, hide_seentics: v }))} aria-label={t.hideSeentics} />
                </div>
                {error && <ErrorNote>{error}</ErrorNote>}
                <div className="flex justify-end">
                  <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs" disabled={save.isPending || Object.keys(problems).length > 0}>
                    {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t.save}
                  </Button>
                </div>
              </form>
            )}
          </Panel>
          <DomainSection />
        </div>
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <Preview form={form} domain={activeDomain} />
        </aside>
      </div>
    </WorkspacePage>
  );
}
