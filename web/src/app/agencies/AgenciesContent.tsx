'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Braces,
  Building2,
  Check,
  Gauge,
  Globe,
  LayoutDashboard,
  LogIn,
  Palette,
  PanelsTopLeft,
  type LucideIcon,
} from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';
import { FoundingLine } from '@/components/landing/agencies/FoundingLine';
import { AgencyPrice } from '@/components/landing/agencies/AgencyPrice';
import { AgencyOverviewShot } from '@/components/landing/agencies/AgencyOverviewShot';
import { AgencyFaq } from '@/components/landing/agencies/AgencyFaq';
import { useT } from '@/lib/i18n';

const DEMO_HREF = '/agency?demo=1';

type Feature = { icon: LucideIcon; name: string; text: string; soon?: boolean };

/** The feature cards' icons, in the order of `useT().agency.landing.features`; the sixth is not live yet. */
const FEATURE_ICONS: LucideIcon[] = [LayoutDashboard, Building2, Palette, PanelsTopLeft, Braces, Gauge, Globe, LogIn];
const SOON_INDEX = 6;

function SoonBadge() {
  const t = useT().agency.landing;
  return (
    <span data-testid="soon" className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {t.soon}
    </span>
  );
}

function FeatureCard({ f }: { f: Feature }) {
  return (
    <div
      data-soon={f.soon ? 'true' : undefined}
      className="flex flex-col gap-3 rounded-xl border p-5"
      style={{ borderColor: 'var(--lx-line-strong)', background: f.soon ? 'transparent' : 'var(--lx-panel)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${f.soon ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}
        >
          <f.icon className="h-[18px] w-[18px]" />
        </span>
        {f.soon && <SoonBadge />}
      </div>
      <div>
        <h3 className="text-[15px] font-medium" style={{ color: 'var(--lx-text)' }}>
          {f.name}
        </h3>
        <p className="lx-dim mt-1 text-[14px] leading-relaxed">{f.text}</p>
      </div>
    </div>
  );
}

/** The /agencies page's body, in the visitor's language. */
export function AgenciesContent() {
  const t = useT().agency.landing;
  const features: Feature[] = t.features.map((f, i) => ({ ...f, icon: FEATURE_ICONS[i] ?? LayoutDashboard, soon: i === SOON_INDEX }));
  return (
    <div className="lx relative flex min-h-screen flex-col overflow-x-clip bg-background">
      <LandingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="pt-36 sm:pt-44 lg:pt-52">
          <div className="landing-container">
            <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--lx-text)' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {t.eyebrow}
            </p>
            <h1 className="lx-display mt-5 max-w-[22ch] text-[2.5rem] !font-bold sm:text-[3.25rem] lg:text-[4rem]">
              {t.heroTitle}
              <br />
              <span>{t.heroTitle2}</span>
            </h1>
            <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <p className="lx-dim max-w-[40rem] text-base leading-relaxed sm:text-lg">
                {t.heroBody}
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link href={DEMO_HREF} className="lx-btn lx-btn-primary">
                  {t.seeDemo}
                </Link>
                <Link href="/pricing" className="lx-btn lx-btn-ghost">
                  {t.getAgency} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <FoundingLine className="mt-8" />

            <div className="mt-12 sm:mt-16">
              <AgencyOverviewShot href={DEMO_HREF} />
              <p className="lx-faint mt-5 text-center text-sm">
                {t.shotCaption}{' '}
                <Link
                  href={DEMO_HREF}
                  className="underline decoration-[color:var(--lx-line-strong)] underline-offset-4 hover:text-[color:var(--lx-text)]"
                >
                  {t.openDemo}
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="landing-section" aria-labelledby="features-title">
          <div className="landing-container">
            <div className="mb-10 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
              <h2 id="features-title" className="lx-display text-[1.75rem] sm:text-4xl">
                {t.featuresTitle}
                <br />
                <span>{t.featuresTitle2}</span>
              </h2>
              <p className="lx-dim max-w-md text-base leading-relaxed">{t.featuresBody}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <FeatureCard key={f.name} f={f} />
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="pb-12 sm:pb-16 md:pb-24" aria-labelledby="price-title">
          <div className="landing-container">
            <div
              className="grid gap-8 rounded-2xl border p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16"
              style={{ borderColor: 'var(--lx-line-strong)', background: 'var(--lx-panel)' }}
            >
              <div>
                <h2 id="price-title" className="lx-heading text-2xl sm:text-3xl">{t.planName}</h2>
                <ul className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {t.included.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[15px]" style={{ color: 'var(--lx-text)' }}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-5 lg:items-end lg:text-right">
                <AgencyPrice />
                <div className="flex flex-wrap gap-2">
                  <Link href="/pricing" className="lx-btn lx-btn-primary">
                    {t.getAgency}
                  </Link>
                  <Link href="/pricing" className="lx-btn lx-btn-ghost">
                    {t.comparePlans} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AgencyFaq />

        {/* Final CTA */}
        <section className="landing-container py-28 sm:py-40">
          <div className="flex flex-col gap-8 border-t pt-16 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: 'var(--lx-line)' }}>
            <h2 className="lx-display text-[1.75rem] sm:text-4xl">
              {t.finalTitle}
              <br />
              <span>{t.finalTitle2}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={DEMO_HREF} className="lx-btn lx-btn-primary">
                {t.seeDemo}
              </Link>
              <Link href="/pricing" className="lx-btn lx-btn-ghost">
                {t.getAgency} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
