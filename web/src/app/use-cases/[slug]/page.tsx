import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FEATURES, USE_CASES, USE_CASE_BY_SLUG } from '@/lib/use-cases';
import { USE_CASE_DETAILS } from '@/lib/use-case-details';
import { SITE_URL } from '@/lib/site';
import { UseCaseIcon } from '@/components/use-cases/UseCaseIcon';
import { VisualBlock } from '@/components/use-cases/VisualBlock';
import { FlowDiagram, LoopDiagram } from '@/components/use-cases/Diagrams';
import { Shot } from '@/components/use-cases/Shot';

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = USE_CASE_BY_SLUG[slug];
  if (!u) return {};
  const url = `${SITE_URL}/use-cases/${u.slug}`;
  return {
    title: `${u.headline} | Seentics`,
    description: u.metaDescription,
    alternates: { canonical: `/use-cases/${u.slug}` },
    openGraph: { title: u.headline, description: u.metaDescription, url, siteName: 'Seentics', type: 'website' },
    twitter: { card: 'summary_large_image', title: u.headline, description: u.metaDescription },
  };
}

/** JSON for a <script type="application/ld+json">: `<` escaped so nothing can close the tag. */
const ld = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow?: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="mt-20 sm:mt-24" aria-labelledby={id}>
      {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
      <h2 id={id} className="mt-1.5 max-w-3xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      {lead && <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-muted-foreground">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = USE_CASE_BY_SLUG[slug];
  const d = USE_CASE_DETAILS[slug];
  if (!u || !d) notFound();

  const same = USE_CASES.filter((x) => x.group === u.group && x.slug !== u.slug);
  const more = [...same, ...USE_CASES.filter((x) => x.group !== u.group && x.slug !== u.slug)].slice(0, 4);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Seentics', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Use cases', item: `${SITE_URL}/use-cases` },
      { '@type': 'ListItem', position: 3, name: u.name, item: `${SITE_URL}/use-cases/${u.slug}` },
    ],
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: u.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <article className="landing-container py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(faq) }} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href="/use-cases" className="hover:text-foreground">Use cases</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{u.name}</span>
      </nav>

      {/* Hero: the promise on the left, the product (or what the visitor sees) on the right. */}
      <header className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
        <div>
          <UseCaseIcon useCase={u} size="md" />
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-[44px] sm:leading-[1.1]">{u.headline}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">{u.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup"><Button className="h-11 rounded-lg px-6 font-semibold">Get started free</Button></Link>
            <Link href="/websites/demo"><Button variant="outline" className="h-11 rounded-lg px-6 font-semibold">See the live demo</Button></Link>
          </div>
          {d.platforms && (
            <div className="mt-8">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">Works with</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                {d.platforms.map((p) => (
                  <span
                    key={p}
                    role="img"
                    aria-label={p}
                    className={`block h-6 bg-foreground/70 ${p === 'woocommerce' ? 'w-11' : 'w-6'}`}
                    style={{ WebkitMask: `url(/integrations/${p}.svg) center / contain no-repeat`, mask: `url(/integrations/${p}.svg) center / contain no-repeat` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0"><VisualBlock v={d.hero} priority /></div>
      </header>

      <Section id="who" eyebrow="Who it is for" title="Who can use it, and how">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {u.who.map((w) => (
            <div key={w.audience} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
              <h3 className="text-[15px] font-semibold text-foreground">{w.audience}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{w.how}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="seen" eyebrow="In practice" title={d.seen.heading} lead={d.seen.text}>
        <div className={`grid items-start gap-8 ${d.seen.visuals.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {d.seen.visuals.map((v, i) => <div key={i} className="min-w-0"><VisualBlock v={v} /></div>)}
        </div>
      </Section>

      <Section id="scenario" eyebrow="Worked example" title={d.scenario.heading}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            {d.scenario.paras.map((p, i) => (
              <p key={i} className="text-[16px] leading-relaxed text-muted-foreground">{p}</p>
            ))}
          </div>
          <aside className="rounded-xl border border-border bg-muted/30 p-5">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground/80">Features used</p>
            <ul className="mt-3 space-y-3">
              {u.features.map((f) => {
                const feat = FEATURES[f.key];
                return (
                  <li key={f.key}>
                    <Link href={feat.href} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-foreground hover:text-primary">
                      {feat.name}<ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{f.answers}</p>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </Section>

      <Section id="how" eyebrow="Set it up" title="How it works">
        <LoopDiagram steps={d.loop} />
        <ol className="mt-10 max-w-3xl space-y-6">
          {u.steps.map((st, i) => (
            <li key={st.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">{st.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="playbooks" eyebrow="Copy these" title="Three automations to start with" lead="Each one is built from the triggers and actions in the automation builder.">
        <div className="space-y-5">
          {d.playbooks.map((p) => (
            <div key={p.name} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h3 className="mb-4 text-[16px] font-semibold text-foreground">{p.name}</h3>
              <FlowDiagram trigger={p.trigger} condition={p.condition} action={p.action} result={p.result} />
            </div>
          ))}
        </div>
        {u.automation && (
          <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">Why it works: </strong>{u.automation.why}{' '}
            <Link href="/docs/automations" className="font-semibold text-primary hover:underline">How automations work</Link>
          </p>
        )}
      </Section>

      <Section id="dashboard" eyebrow="In your dashboard" title={d.dashboard.heading} lead={d.dashboard.text}>
        <div className="space-y-14">
          {d.dashboard.shots.map((s) => (
            <Shot key={s.name} name={s.name} alt={s.alt} url={s.url} annotations={s.annotations} crop={s.crop} />
          ))}
        </div>
        <p className="mt-6 text-[12.5px] text-muted-foreground">Screenshots are the Seentics dashboard running on its built-in demo data.</p>
      </Section>

      {u.funnel && (
        <Section id="journey" eyebrow="Measure it" title={u.funnel.name}>
          <ol className="flex flex-wrap items-center gap-2">
            {u.funnel.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13.5px] font-medium text-foreground">
                  <span className="mr-2 text-muted-foreground">{i + 1}</span>{step}
                </span>
                {i < u.funnel!.steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">{u.funnel.note}</p>
        </Section>
      )}

      <Section id="compare" eyebrow="The difference" title="Without and with Seentics">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border p-6">
            <h3 className="text-[15px] font-semibold text-muted-foreground">Without</h3>
            <ul className="mt-4 space-y-3">
              {d.without.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-muted-foreground">
                  <X className="mt-1 h-4 w-4 shrink-0 text-red-500/80" />{t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-6">
            <h3 className="text-[15px] font-semibold text-foreground">With Seentics</h3>
            <ul className="mt-4 space-y-3">
              {d.withSeentics.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-foreground/90">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <div className="mt-20 grid gap-10 sm:mt-24 lg:grid-cols-2">
        <section aria-labelledby="checklist">
          <h2 id="checklist" className="text-2xl font-bold tracking-tight text-foreground">Before you launch</h2>
          <ul className="mt-6 space-y-3">
            {d.checklist.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card"><Check className="h-3.5 w-3.5 text-primary" /></span>
                {c}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="metrics">
          <h2 id="metrics" className="text-2xl font-bold tracking-tight text-foreground">What to measure</h2>
          <ul className="mt-6 space-y-3">
            {u.metrics.map((m) => (
              <li key={m} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />{m}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Section id="faq" title="Questions">
        <div className="max-w-3xl divide-y divide-border rounded-xl border border-border">
          {u.faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-foreground">
                {f.q}
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="mt-20 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.07] to-transparent p-8 text-center sm:mt-24 sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Try it on your own site</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">One script tag. See your first visitors in minutes.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup"><Button className="h-11 rounded-lg px-6 font-semibold">Get started free</Button></Link>
          <Link href="/docs/quick-start"><Button variant="outline" className="h-11 rounded-lg px-6 font-semibold">Quick start</Button></Link>
        </div>
      </section>

      <section className="mt-20 sm:mt-24" aria-labelledby="related">
        <h2 id="related" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">More use cases</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {more.map((r) => (
            <Link key={r.slug} href={`/use-cases/${r.slug}`} className="rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
              <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-foreground">
                <UseCaseIcon useCase={r} size="xs" />
                {r.name}
              </span>
              <span className="mt-2 block text-[13px] leading-relaxed text-muted-foreground">{r.summary}</span>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
