'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, MessageCircle, PlayCircle, Server, X } from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';
import { ACCENT, AnalyticsTabs, LiveDashboard, Marked, Points, StartLink, outlineBtn, panel, solidBtn } from '@/components/landing/fcommerce/parts';
import { useLocale } from '@/lib/i18n';
import { ProviderIcon } from '@/components/integrations/ProviderIcon';
import { usePlans } from '@/features/plans/queries';
import { allowance } from '@/features/plans/pricing-spec';
import type { Plan } from '@/features/plans/types';
import { cn } from '@/lib/utils';
import { bdCopy as copy, type Platform } from './copy';

/** Messenger chat for sellers who ask before signing up; the buttons are left out until it is set. */
const MESSENGER_URL = process.env.NEXT_PUBLIC_MESSENGER_URL ?? '';

const PLATFORMS: Platform[] = ['woocommerce', 'shopify', 'custom'];
/** Sign-up answers "what is this website for?" as an online store (app/websites/page.tsx). */
const STORE_NEXT = '/websites?profile=store';
/** The demo dashboard, in the online store's sidebar order. */
const DEMO_HREF = '/websites/demo?profile=store';
const LOGOS = [
  { src: '/integrations/woocommerce.svg', name: 'WooCommerce' },
  { src: '/integrations/shopify.svg', name: 'Shopify' },
  { src: '/integrations/wordpress.svg', name: 'WordPress' },
];

/** A limit in words: lakh grouping, the way prices and counts are written in Bangladesh; -1 is unlimited. */
function formatLimit(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value === -1) return copy.pricing.unlimited;
  return value.toLocaleString('en-IN');
}

/** A plan's value for one of the card's limits; a metered one is its included amount. */
function planLimit(plan: Plan | undefined, key: string, metered: boolean): number | undefined {
  if (!plan) return undefined;
  return metered ? allowance(plan, 'core', key) : plan.limits.core?.[key];
}

const h2 = 'lx-display text-[1.7rem] !font-bold !leading-[1.3] [text-wrap:balance] sm:text-[2.4rem]';

function MessengerLink({ className }: { className?: string }) {
  if (!MESSENGER_URL) return null;
  return (
    <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className={className} style={{ borderColor: 'var(--lx-line-strong)', color: 'var(--lx-text)' }}>
      <MessageCircle className="h-5 w-5 text-[#0866ff]" />{copy.messenger}
    </a>
  );
}

/** Website order → Seentics server → Facebook, Google Analytics, TikTok. */
function ServerFlow() {
  const f = copy.tracking.flow;
  const Step = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-[0_20px_40px_-28px_rgba(0,0,0,0.35)]">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-zinc-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0f6b4f] text-[12px] font-bold text-white">{n}</span>{title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
  const Down = () => <div className="flex justify-center py-1.5 text-zinc-400"><ArrowRight className="h-5 w-5 rotate-90" /></div>;
  return (
    <div aria-hidden className="mx-auto w-full max-w-[460px] select-none rounded-3xl bg-[var(--fc-soft)] p-4 sm:p-6" lang="bn">
      <Step n="১" title={f.order.title}>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3.5 py-2.5">
          <img src="/integrations/woocommerce.svg" alt="" className="h-7 w-7" />
          <span className="min-w-0 text-[13.5px]"><b>{f.order.name}</b><span className="block text-[12px] text-zinc-500">{f.order.detail}</span></span>
        </div>
      </Step>
      <Down />
      <Step n="২" title={f.server.title}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white"><Server className="h-5 w-5" /></span>
          <ul className="grid gap-1 text-[12.5px] text-zinc-700">
            {f.server.lines.map((l) => <li key={l} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />{l}</li>)}
          </ul>
        </div>
      </Step>
      <Down />
      <Step n="৩" title={f.out.title}>
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {f.out.rows.map((r) => (
            <li key={r} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[12.5px] font-semibold">
              {r}<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
            </li>
          ))}
        </ul>
      </Step>
    </div>
  );
}

/** "How it works", opening on the platform an ad link names: /bd?platform=shopify. */
function HowItWorks() {
  const [platform, setPlatform] = useState<Platform>('woocommerce');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('platform');
    if (p && (PLATFORMS as string[]).includes(p)) setPlatform(p as Platform);
  }, []);
  return (
    <section className="landing-section bg-[var(--fc-tint)]" aria-labelledby="how-title">
      <div className="landing-container">
        <h2 id="how-title" className={h2}><Marked text={copy.how.title} block /></h2>
        <p className="lx-dim mt-4 text-[16px] sm:text-lg">{copy.how.sub}</p>
        <div role="tablist" aria-label={copy.how.sub} className="mt-8 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === platform}
              onClick={() => setPlatform(p)}
              className={cn('rounded-full px-5 py-2.5 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                p === platform ? 'bg-[var(--fc)] text-white' : 'border hover:bg-[var(--lx-line)]')}
              style={p === platform ? undefined : { borderColor: 'var(--lx-line-strong)', color: 'var(--lx-text)' }}
            >
              {copy.how.tabs[p]}
            </button>
          ))}
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {copy.how.steps[platform].map((s, i) => (
            <li key={s.head} className="rounded-2xl border p-6" style={panel}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fc)] text-[18px] font-bold text-white">{(i + 1).toLocaleString('bn-BD')}</span>
              <h3 className="mt-4 text-[18px] font-bold" style={{ color: 'var(--lx-text)' }}>{s.head}</h3>
              <p className="lx-dim mt-2 text-[15.5px] leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
        {MESSENGER_URL && <p className="lx-dim mt-6 text-[15px]">{copy.how.help}</p>}
      </div>
    </section>
  );
}

export default function BdPage() {
  const { preferLocale } = useLocale();
  const { data: plans } = usePlans('core');
  const planOf = (tier: Plan['tier']) => plans?.find((p) => p.tier === tier);
  // Header and footer in Bangla too, without writing the visitor's own choice.
  useEffect(() => { preferLocale('bn'); }, [preferLocale]);

  return (
    // Headings drop .lx-display's negative tracking: it pulls Bangla conjuncts apart.
    <div lang="bn" className={cn('lx relative flex min-h-screen flex-col overflow-x-clip bg-background [&_.lx-display]:!tracking-normal', ACCENT)}>
      <LandingHeader />
      <main className="flex-1">
        {/* 1 · Hero */}
        <section className="pt-28 sm:pt-36 lg:pt-40">
          <div className="landing-container flex flex-col items-center gap-12 sm:gap-16">
            <div className="mx-auto min-w-0 max-w-[52rem] text-center">
              <p className="text-[15px] font-semibold text-[var(--fc-text)]">{copy.eyebrow}</p>
              <h1 className="lx-display mt-4 text-[2.1rem] !font-bold !leading-[1.3] [text-wrap:balance] sm:text-[2.9rem] lg:text-[3.3rem]">
                <Marked text={copy.title} block />
              </h1>
              <p className="lx-dim mx-auto mt-6 max-w-[42rem] text-[17px] leading-relaxed sm:text-lg"><Marked text={copy.lead} /></p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <StartLink label={copy.start} openLabel={copy.openDashboard} next={STORE_NEXT} />
                <Link href={DEMO_HREF} className={outlineBtn} style={{ borderColor: 'var(--lx-line-strong)', color: 'var(--lx-text)' }}>
                  <PlayCircle className="h-5 w-5 text-[var(--fc-text)]" />{copy.demo}
                </Link>
                <MessengerLink className={outlineBtn} />
              </div>
              <div className="mt-8 flex flex-col items-center gap-3">
                <div className="flex items-center gap-5">
                  {LOGOS.map((l) => <img key={l.name} src={l.src} alt={l.name} className="h-7 w-7 opacity-80 dark:invert" />)}
                </div>
                <p className="lx-faint text-[14px]">{copy.platformsLine}</p>
              </div>
            </div>
            {/* The homepage hero's preview, with an online store's sidebar, opening on Conversions */}
            <div className="w-full min-w-0">
              <LiveDashboard profile="store" initial="Conversions" />
              <p className="lx-faint mt-6 text-center text-sm">
                {copy.previewCaption}{' '}
                <Link href={DEMO_HREF} className="underline decoration-[color:var(--lx-line-strong)] underline-offset-4 hover:text-[color:var(--lx-text)]">{copy.demo}</Link>
              </p>
            </div>
          </div>
        </section>

        {/* 2 · The problem */}
        <section className="landing-section mt-16 bg-[var(--fc-tint)] sm:mt-24" aria-labelledby="problem-title">
          <div className="landing-container">
            <h2 id="problem-title" className={h2}><Marked text={copy.problem.title} block /></h2>
            <p className="lx-dim mt-4 max-w-3xl text-[16px] leading-relaxed sm:text-lg">{copy.problem.sub}</p>
            <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
              <div className="rounded-3xl border p-6 sm:p-8" style={panel}>
                <p className="lx-faint text-[13px] font-semibold uppercase tracking-[0.08em]">{copy.problem.columns[0]}</p>
                <ul className="mt-5 space-y-5">
                  {copy.problem.rows.map((r) => (
                    <li key={r.label} className="flex gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400"><X className="h-4 w-4" strokeWidth={3} /></span>
                      <span className="min-w-0"><span className="lx-faint block text-[13px] font-semibold">{r.label}</span><span className="lx-dim block text-[16px] leading-snug">{r.now}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-[var(--fc)] p-6 text-white shadow-[0_30px_60px_-30px_rgba(15,107,79,0.7)] sm:p-8">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">{copy.problem.columns[1]}</p>
                <ul className="mt-5 space-y-5">
                  {copy.problem.rows.map((r) => (
                    <li key={r.label} className="flex gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#0f6b4f]"><Check className="h-4 w-4" strokeWidth={3} /></span>
                      <span className="min-w-0"><span className="block text-[13px] font-semibold text-white/70">{r.label}</span><span className="block text-[16px] font-semibold leading-snug">{r.with}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3 · Core: server-side tracking, then analytics */}
        <section className="landing-section">
          <div className="landing-container grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--fc-text)]">{copy.tracking.tag}</p>
              <h2 className={cn(h2, 'mt-2')}><Marked text={copy.tracking.head} block /></h2>
              <p className="lx-dim mt-4 text-[16px] leading-relaxed sm:text-[17px]">{copy.tracking.text}</p>
              <Points points={copy.tracking.points} />
            </div>
            <ServerFlow />
          </div>
        </section>
        <section className="landing-section border-t" style={{ borderColor: 'var(--lx-line)' }} aria-labelledby="analytics-title">
          <div className="landing-container">
            <p className="text-[15px] font-semibold text-[var(--fc-text)]">{copy.analytics.tag}</p>
            <h2 id="analytics-title" className={cn(h2, 'mt-2')}><Marked text={copy.analytics.title} block /></h2>
            <p className="lx-dim mt-4 max-w-2xl text-[16px] leading-relaxed sm:text-lg">{copy.analytics.sub}</p>
            <AnalyticsTabs label={copy.analytics.tag} tabs={copy.analytics.tabs} profile="store" />
          </div>
        </section>

        {/* 4 · How it works */}
        <HowItWorks />

        {/* 5 · Extras */}
        <section className="landing-section" aria-labelledby="extras-title">
          <div className="landing-container">
            <h2 id="extras-title" className={h2}>{copy.extras.title}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {copy.extras.items.map((x) => (
                <div key={x.head} className="rounded-3xl border p-6 sm:p-8" style={panel}>
                  {x.soon && <span className="mb-3 inline-block rounded-full bg-amber-400 px-3 py-0.5 text-[12.5px] font-semibold text-amber-950">{copy.extras.soon}</span>}
                  <h3 className="text-[20px] font-bold leading-snug" style={{ color: 'var(--lx-text)' }}>{x.head}</h3>
                  <p className="lx-dim mt-2 text-[16px] leading-relaxed">{x.text}</p>
                  {'logos' in x && x.logos && (
                    // The real tools a lead can go to: Zapier, Mailchimp, Klaviyo, HubSpot, and Slack by webhook.
                    <div className="mt-5 flex flex-wrap gap-2">
                      <ProviderIcon provider="zapier" hint="hooks.zapier.com" className="h-9 w-9" />
                      <ProviderIcon provider="mailchimp" className="h-9 w-9" />
                      <ProviderIcon provider="klaviyo" className="h-9 w-9" />
                      <ProviderIcon provider="hubspot" className="h-9 w-9" />
                      <ProviderIcon provider="zapier" hint="hooks.slack.com" className="h-9 w-9" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7 · Pricing (6 · proof waits for real customer results) */}
        <section id="pricing" className="landing-section scroll-mt-24 bg-[var(--fc-tint)]" aria-labelledby="pricing-title">
          <div className="landing-container">
            <h2 id="pricing-title" className={h2}>{copy.pricing.title}</h2>
            <p className="lx-dim mt-4 max-w-2xl text-[16px] leading-relaxed">{copy.pricing.lead}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {copy.pricing.plans.map((plan) => (
                <div key={plan.name} className={cn('flex flex-col rounded-2xl border p-6', plan.featured && 'border-2 !border-[var(--fc)]')} style={panel}>
                  <h3 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: 'var(--lx-text)' }}>
                    {plan.name}
                    {plan.featured && <span className="rounded-full bg-[var(--fc)] px-2.5 py-0.5 text-[12px] font-semibold text-white">{copy.pricing.popular}</span>}
                  </h3>
                  <p className="mt-3">
                    <span className="text-[2.4rem] font-bold leading-none" style={{ color: 'var(--lx-text)' }}>{plan.price}</span>
                    {plan.price !== '৳0' && <span className="lx-faint text-sm">{copy.pricing.perMonth}</span>}
                  </p>
                  <p className="lx-dim mt-2 text-[15px]">{plan.note}</p>
                  <dl className="mt-5 space-y-2 border-y py-4" style={{ borderColor: 'var(--lx-line)' }}>
                    {copy.pricing.limits.map((l) => (
                      <div key={l.key} className="flex items-baseline justify-between gap-3">
                        <dt className="lx-dim text-[14.5px]">{l.label}</dt>
                        <dd className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--lx-text)' }}>{formatLimit(planLimit(planOf(plan.tier), l.key, l.metered))}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="lx-faint mt-5 text-[13px] font-semibold">{copy.pricing.includedTitle}</p>
                  <ul className="mt-3 flex-1 space-y-2">
                    {copy.pricing.included.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14.5px]" style={{ color: 'var(--lx-text)' }}>
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--fc-text)]" strokeWidth={3} />{f}
                      </li>
                    ))}
                  </ul>
                  <StartLink label={plan.cta} openLabel={copy.openDashboard} next={STORE_NEXT} className={cn(plan.featured ? solidBtn : outlineBtn, 'mt-7 w-full')} />
                </div>
              ))}
            </div>
            <p className="lx-dim mt-5 text-sm">{copy.pricing.limitsNote}</p>
            <Link href="/pricing" className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline decoration-[color:var(--lx-line-strong)] underline-offset-4" style={{ color: 'var(--lx-text)' }}>
              {copy.pricing.compare} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* 8 · FAQ and final call to action */}
        <section className="landing-section" aria-labelledby="faq-title">
          <div className="landing-container max-w-3xl">
            <h2 id="faq-title" className="lx-display mb-6 text-[1.7rem] !font-bold sm:text-[2.4rem]">{copy.faq.title}</h2>
            <div className="border-t" style={{ borderColor: 'var(--lx-line)' }}>
              {copy.faq.items.map((item) => (
                <details key={item.q} className="group border-b py-5" style={{ borderColor: 'var(--lx-line)' }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-semibold" style={{ color: 'var(--lx-text)' }}>
                    {item.q}
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--fc-text)] transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="lx-dim mt-3 text-[15.5px] leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-[var(--fc)] py-16 sm:py-20">
          <div className="landing-container flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-[1.7rem] font-bold leading-[1.3] text-white sm:text-[2.4rem]">{copy.final}</h2>
            <div className="flex flex-wrap gap-3">
              <StartLink
                label={copy.start}
                openLabel={copy.openDashboard}
                next={STORE_NEXT}
                className="inline-flex h-12 items-center justify-center rounded-[10px] bg-white px-7 text-[16px] font-semibold text-[#0f6b4f] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              />
              <Link href={DEMO_HREF} className="inline-flex h-12 items-center gap-2 rounded-[10px] border border-white/40 px-6 text-[16px] font-semibold text-white hover:bg-white/10">
                <PlayCircle className="h-5 w-5" />{copy.demo}
              </Link>
              {MESSENGER_URL && (
                <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-[10px] border border-white/40 px-6 text-[16px] font-semibold text-white hover:bg-white/10">
                  <MessageCircle className="h-5 w-5" />{copy.messenger}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Floating Messenger button on every screen */}
      {MESSENGER_URL && (
        <a
          href={MESSENGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.messenger}
          className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#0866ff] text-white shadow-[0_12px_30px_-8px_rgba(8,102,255,0.7)] transition-transform hover:scale-105"
          style={{ right: 'calc(20px + env(safe-area-inset-right, 0px))', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
        >
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </div>
  );
}
