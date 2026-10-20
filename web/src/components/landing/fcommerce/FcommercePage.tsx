'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';
import { MacbookFrame } from '@/components/landing/mocks/MacbookFrame';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CheckoutDesktop, CheckoutPhone } from './CheckoutPhone';
import { ConversionFlow } from './FeatureVisuals';
import { fcommerceBn, fcommerceEn, type FcommerceCopy } from './copy';
import { ACCENT, AnalyticsTabs, LiveDashboard, Marked, Points, StartLink, outlineBtn, panel, solidBtn } from './parts';

/** Where a new seller goes once signed in: straight to opening a store (app/websites/page.tsx). */
const STORE_START = '/websites?create=store';

/**
 * Bangla unless the visitor chose English: the static page is rendered in Bangla, and on mount the
 * page asks the locale provider for Bangla too (header, footer, badges), without writing the
 * visitor's choice, so a visitor who picked English keeps it.
 */
function useFcommerceCopy(): FcommerceCopy {
  const { locale, preferLocale } = useLocale();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    preferLocale('bn');
    setMounted(true);
  }, [preferLocale]);
  return !mounted || locale === 'bn' ? fcommerceBn : fcommerceEn;
}

export default function FcommercePage() {
  const copy = useFcommerceCopy();
  const blocks = copy.features.blocks;
  const visuals = [
    <div key="page" className="flex justify-center"><CheckoutPhone view="product" /></div>,
    <LiveDashboard key="orders" profile="fcommerce" initial="Overview" />,
    <ConversionFlow key="tracking" />,
  ];

  return (
    // Headings drop .lx-display's negative tracking: it pulls Bangla conjuncts apart.
    <div lang={copy === fcommerceBn ? 'bn' : 'en'} className={cn('lx relative flex min-h-screen flex-col overflow-x-clip bg-background [&_.lx-display]:!tracking-normal', ACCENT)}>
      <LandingHeader />
      <main className="flex-1">
        {/* Hero: centred words, the order page on a phone below */}
        <section className="pt-28 sm:pt-36 lg:pt-40">
          <div className="landing-container flex flex-col items-center gap-12 sm:gap-16">
            <div className="mx-auto min-w-0 max-w-[52rem] text-center">
              <p className="text-[15px] font-semibold text-[var(--fc-text)]">{copy.eyebrow}</p>
              <h1 className="lx-display mt-4 text-[2.1rem] !font-bold !leading-[1.3] [text-wrap:balance] sm:text-[2.9rem] lg:text-[3.3rem]">
                <Marked text={copy.title} block />
              </h1>
              <p className="lx-dim mx-auto mt-6 max-w-[42rem] text-[17px] leading-relaxed sm:text-lg">
                <Marked text={copy.lead} />
              </p>
              {/* Stacked full width on a phone, for the thumb; side by side from sm up. */}
              <div className="mx-auto mt-8 flex max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
                <StartLink next={STORE_START} label={copy.start} openLabel={copy.openDashboard} />
                <Link href="#pricing" className={outlineBtn} style={{ borderColor: 'var(--lx-line-strong)', color: 'var(--lx-text)' }}>
                  {copy.seePlans}
                </Link>
              </div>
              <ul className="lx-dim mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14.5px]">
                {copy.trust.map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-[var(--fc-text)]" strokeWidth={3} />{t}</li>
                ))}
              </ul>
            </div>
            {/* The same order page on a laptop and a phone; the phone overlaps the laptop's corner from md up */}
            <div className="w-full min-w-0 max-w-[68rem] rounded-3xl bg-[var(--fc-soft)] px-4 py-8 sm:px-10 sm:py-12">
              <div className="relative md:pb-16 md:pr-[150px]">
                {/* The laptop from md up: on a phone it would be a third of its size; the phone says it all there. */}
                <div className="hidden md:block">
                  <MacbookFrame designWidth={1100} designHeight={688} url="seentics.shop/rupa-fashion/smart-watch">
                    <CheckoutDesktop />
                  </MacbookFrame>
                </div>
                <div className="flex justify-center md:absolute md:-bottom-4 md:right-0 md:block">
                  <CheckoutPhone className="md:origin-bottom-right md:scale-[0.72] lg:scale-[0.8]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Without and with Seentics */}
        <section className="landing-section mt-16 bg-[var(--fc-tint)] sm:mt-24" aria-labelledby="compare-title">
          <div className="landing-container">
            <h2 id="compare-title" className="lx-display text-[1.7rem] !font-bold !leading-[1.3] [text-wrap:balance] sm:text-[2.4rem]">
              <Marked text={copy.compare.title} block />
            </h2>
            <p className="lx-dim mt-4 max-w-2xl text-[16px] leading-relaxed sm:text-lg">{copy.compare.sub}</p>
            <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
              {/* Today: muted, crossed out */}
              <div className="rounded-3xl border p-6 sm:p-8" style={panel}>
                <p className="lx-faint text-[13px] font-semibold uppercase tracking-[0.08em]">{copy.compare.columns[0]}</p>
                <ul className="mt-5 space-y-5">
                  {copy.compare.rows.map((r) => (
                    <li key={r.label} className="flex gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400"><X className="h-4 w-4" strokeWidth={3} /></span>
                      <span className="min-w-0">
                        <span className="lx-faint block text-[13px] font-semibold">{r.label}</span>
                        <span className="lx-dim block text-[16px] leading-snug">{r.now}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* With Seentics: the solid green card */}
              <div className="rounded-3xl bg-[var(--fc)] p-6 text-white shadow-[0_30px_60px_-30px_rgba(15,107,79,0.7)] sm:p-8">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">{copy.compare.columns[1]}</p>
                <ul className="mt-5 space-y-5">
                  {copy.compare.rows.map((r) => (
                    <li key={r.label} className="flex gap-3.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#0f6b4f]"><Check className="h-4 w-4" strokeWidth={3} /></span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-white/70">{r.label}</span>
                        <span className="block text-[16px] font-semibold leading-snug">{r.with}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* The three features, each beside the real screen */}
        <section className="landing-section">
          <div className="landing-container space-y-20 sm:space-y-28">
            {blocks.map((block, i) => (
              <div key={block.tag} className={cn('grid items-center gap-10 lg:gap-14', i === 1 ? 'lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]' : 'lg:grid-cols-2')}>
                <div className={cn('min-w-0', i % 2 === 1 && 'lg:order-2')}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--fc)] text-[17px] font-bold text-white">
                    {(i + 1).toLocaleString(copy === fcommerceBn ? 'bn-BD' : 'en-US')}
                  </span>
                  <p className="mt-4 text-[15px] font-semibold text-[var(--fc-text)]">{block.tag}</p>
                  <h3 className="lx-display mt-2 text-[1.5rem] !font-bold !leading-[1.35] [text-wrap:balance] sm:text-[1.9rem]">
                    <Marked text={block.head} block />
                  </h3>
                  <p className="lx-dim mt-3 text-[15.5px] leading-relaxed sm:text-[17px]">{block.text}</p>
                  <Points points={block.points} />
                </div>
                <div className={cn('w-full min-w-0', i === 1 ? '' : 'justify-self-center')}>
                  {visuals[i]}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Analytics, included */}
        <section className="landing-section border-t" style={{ borderColor: 'var(--lx-line)' }} aria-labelledby="analytics-title">
          <div className="landing-container">
            <p className="text-[15px] font-semibold text-[var(--fc-text)]">{copy.analytics.tag}</p>
            <h2 id="analytics-title" className="lx-display mt-2 text-[1.7rem] !font-bold !leading-[1.3] [text-wrap:balance] sm:text-[2.4rem]">
              <Marked text={copy.analytics.title} block />
            </h2>
            <p className="lx-dim mt-4 max-w-2xl text-[16px] leading-relaxed sm:text-lg">{copy.analytics.sub}</p>
            <AnalyticsTabs label={copy.analytics.tag} tabs={copy.analytics.tabs} profile="fcommerce" />
          </div>
        </section>

        {/* Pricing in taka */}
        <section id="pricing" className="landing-section scroll-mt-24 bg-[var(--fc-tint)]" aria-labelledby="pricing-title">
          <div className="landing-container">
            <h2 id="pricing-title" className="lx-display text-[1.7rem] !font-bold !leading-[1.3] sm:text-[2.4rem]">{copy.pricing.title}</h2>
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
                  <ul className="mt-5 space-y-2 border-b pb-5" style={{ borderColor: 'var(--lx-line)' }}>
                    {plan.limits.map((l) => (
                      <li key={l} className="flex items-center gap-2.5 text-[16px] font-bold" style={{ color: 'var(--lx-text)' }}>
                        <Check className="h-4 w-4 shrink-0 text-[var(--fc-text)]" strokeWidth={3} />{l}
                      </li>
                    ))}
                  </ul>
                  <p className="lx-faint mt-5 text-[13px] font-semibold">{copy.pricing.includedTitle}</p>
                  <ul className="mt-3 flex-1 space-y-2">
                    {copy.pricing.included.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14.5px]" style={{ color: 'var(--lx-text)' }}>
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--fc-text)]" strokeWidth={3} />{f}
                      </li>
                    ))}
                  </ul>
                  <StartLink next={STORE_START}
                    label={plan.cta}
                    openLabel={copy.openDashboard}
                    className={cn(plan.featured ? solidBtn : outlineBtn, 'mt-7 w-full')}
                  />
                </div>
              ))}
            </div>
            <p className="lx-dim mt-5 text-sm leading-relaxed">{copy.pricing.pay}</p>
            <Link href="/pricing" className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline decoration-[color:var(--lx-line-strong)] underline-offset-4" style={{ color: 'var(--lx-text)' }}>
              {copy.pricing.compare} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
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

        {/* Final CTA: the one solid green band */}
        <section className="bg-[var(--fc)] py-16 sm:py-20">
          <div className="landing-container flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-[1.7rem] font-bold leading-[1.3] text-white [text-wrap:balance] sm:text-[2.4rem]">{copy.final}</h2>
            <StartLink next={STORE_START}
              label={copy.start}
              openLabel={copy.openDashboard}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-[10px] bg-white px-7 text-[16px] font-semibold text-[#0f6b4f] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f6b4f]"
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
