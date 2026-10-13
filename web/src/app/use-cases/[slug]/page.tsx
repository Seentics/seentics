import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FEATURES, USE_CASES, USE_CASE_BY_SLUG } from '@/lib/use-cases';
import { SITE_URL } from '@/lib/site';

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

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = USE_CASE_BY_SLUG[slug];
  if (!u) notFound();

  const related = USE_CASES.filter((x) => x.group === u.group && x.slug !== u.slug).slice(0, 4);
  const more = related.length < 4 ? [...related, ...USE_CASES.filter((x) => x.group !== u.group)].slice(0, 4) : related;

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

      <header className="mt-6 max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
          <u.icon className="h-3.5 w-3.5 text-primary" />
          Use case
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{u.headline}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{u.intro}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup"><Button className="h-11 rounded-lg px-6 font-semibold">Get started free</Button></Link>
          <Link href="/websites/demo"><Button variant="outline" className="h-11 rounded-lg px-6 font-semibold">See the live demo</Button></Link>
        </div>
      </header>

      <section className="mt-16" aria-labelledby="who">
        <h2 id="who" className="text-2xl font-bold tracking-tight text-foreground">Who can use it, and how</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {u.who.map((w) => (
            <div key={w.audience} className="rounded-xl border border-border p-5">
              <h3 className="text-[15px] font-semibold text-foreground">{w.audience}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{w.how}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold tracking-tight text-foreground">How it works</h2>
        <ol className="mt-6 max-w-3xl space-y-5">
          {u.steps.map((st, i) => (
            <li key={st.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">{st.title}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-bold tracking-tight text-foreground">What Seentics gives you</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {u.features.map((f) => {
            const feat = FEATURES[f.key];
            return (
              <div key={f.key} className="rounded-xl border border-border p-5">
                <Link href={feat.href} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-foreground hover:text-primary">
                  {feat.name}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{f.answers}</p>
              </div>
            );
          })}
        </div>
      </section>

      {u.funnel && (
        <section className="mt-16" aria-labelledby="journey">
          <h2 id="journey" className="text-2xl font-bold tracking-tight text-foreground">{u.funnel.name}</h2>
          <ol className="mt-6 flex flex-wrap items-center gap-2">
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
        </section>
      )}

      {u.automation && (
        <section className="mt-16" aria-labelledby="automation">
          <h2 id="automation" className="text-2xl font-bold tracking-tight text-foreground">Act on it in the page</h2>
          <div className="mt-6 max-w-3xl rounded-xl border border-border bg-muted/30 p-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">When</dt>
                <dd className="mt-1 text-[14.5px] font-medium text-foreground">{u.automation.trigger}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Then</dt>
                <dd className="mt-1 text-[14.5px] font-medium text-foreground">{u.automation.action}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{u.automation.why}</p>
            <Link href="/docs/automations" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary hover:underline">
              How automations work <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      )}

      <section className="mt-16" aria-labelledby="metrics">
        <h2 id="metrics" className="text-2xl font-bold tracking-tight text-foreground">What to measure</h2>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {u.metrics.map((m) => (
            <li key={m} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
              <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
              {m}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 max-w-3xl" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold tracking-tight text-foreground">Questions</h2>
        <div className="mt-6 divide-y divide-border rounded-xl border border-border">
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
      </section>

      <section className="mt-16 rounded-2xl border border-border bg-muted/30 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Try it on your own site</h2>
        <p className="mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          One script tag. See your first visitors in minutes.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/signup"><Button className="h-11 rounded-lg px-6 font-semibold">Get started free</Button></Link>
          <Link href="/docs/quick-start"><Button variant="outline" className="h-11 rounded-lg px-6 font-semibold">Quick start</Button></Link>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="related">
        <h2 id="related" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">More use cases</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {more.map((r) => (
            <Link key={r.slug} href={`/use-cases/${r.slug}`} className="rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
              <span className="flex items-center gap-2 text-[14.5px] font-semibold text-foreground">
                <r.icon className="h-4 w-4 text-primary" />
                {r.name}
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{r.summary}</span>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
