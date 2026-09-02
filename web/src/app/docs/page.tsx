import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { C, Callout, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';
import { DOCS_NAV } from '@/components/docs/nav';

export const metadata = {
  title: 'Documentation · Seentics',
  description: 'How Seentics works: analytics, session replays, heatmaps, funnels and automations from a single script tag.',
};

/**
 * Was 1,580 lines holding all seventeen topics as anchor sections, with eleven route
 * pages sitting alongside it carrying overlapping text that nothing linked to. Now an
 * introduction and an index; each topic owns its own URL.
 */
export default function DocsIndexPage() {
  return (
    <DocPage
      eyebrow="Getting started"
      title="Documentation"
      lead="Seentics is analytics you can act on: one script tag gives you traffic, recordings, heatmaps and funnels, wired to automations that run in the visitor's browser."
    >
      <DocSection title="How the pieces fit">
        <P>
          Everything starts from a single <C>&lt;script&gt;</C> tag, about 11&nbsp;KB gzipped. That
          one file handles all of it — there is no second SDK to add for funnels, no separate
          recorder tag, no tag manager in between.
        </P>
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Measure.</strong> Pageviews, sources,
            devices and geography, live and historical.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Understand.</strong> Session replays,
            click and scroll heatmaps, and funnels that show which step loses people.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Act.</strong> Automations that fire on a
            behaviour — exit intent, rage clicks, a custom event — and respond in the page.
          </Li>
        </Ul>
        <P>
          The last one is the part other analytics tools do not have. A funnel that tells you 56% of
          visitors leave at pricing is useful; an automation that shows those visitors an offer
          before they go is what you would do about it.
        </P>
      </DocSection>

      <DocSection title="Start here">
        <P>
          If you have not installed anything yet,{' '}
          <Link href="/docs/quick-start" className="font-medium text-primary hover:underline">
            Quick start
          </Link>{' '}
          takes about two minutes. If you are looking for a specific attribute or endpoint, the{' '}
          <Link href="/docs/tracker" className="font-medium text-primary hover:underline">
            tracker reference
          </Link>{' '}
          and the{' '}
          <Link href="/docs/api" className="font-medium text-primary hover:underline">
            REST API
          </Link>{' '}
          are the reference pages.
        </P>
      </DocSection>

      {/* Index. The sidebar covers navigation, but a first-time reader landing here
          needs the shape of the documentation without reading a nav rail. */}
      {DOCS_NAV.map((group) => (
        <DocSection key={group.title} title={group.title}>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.items
              .filter((item) => item.href !== '/docs')
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex flex-col rounded-lg border border-border p-4 transition-colors hover:border-primary/40"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary">
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                    {item.title}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {item.summary}
                  </span>
                </Link>
              ))}
          </div>
        </DocSection>
      ))}

      <DocSection title="Self-hosting">
        <P>
          Seentics is open source under AGPL-3.0 and runs on your own infrastructure. Point the
          tracker at your host with <C>data-api-host</C> and nothing leaves it.
        </P>
        <Callout kind="note" title="Which licence applies to what">
          The platform is AGPL-3.0. The <C>@seentics/ui</C> component package in the repo carries its
          own licence — check <C>ui/blocks/package.json</C> rather than assuming the platform&apos;s
          terms apply to it.
        </Callout>
      </DocSection>
    </DocPage>
  );
}
