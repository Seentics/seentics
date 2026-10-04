import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * Why Seentics, kept short: three plain columns, one claim each. No graphics; the page already
 * shows the product above and the details live in the docs.
 */
const REASONS = [
  {
    title: 'Live in minutes',
    body: 'One script tag in your head. No package to install and no build step, and data starts arriving straight away.',
    href: '/docs/quick-start',
    cta: 'Read the quick start',
    external: false,
  },
  {
    title: 'Private by default',
    body: 'No cookies, no fingerprinting, and IP addresses are never stored. You can export or erase your data any time.',
    href: '/privacy',
    cta: 'How we handle data',
    external: false,
  },
  {
    title: 'Open source',
    body: 'The analytics core is open source under AGPL-3.0. Self-host it free with no limits, or let us run it for you.',
    href: 'https://github.com/Seentics/seentics',
    cta: 'View on GitHub',
    external: true,
  },
] as const;

export default function WhyChoose() {
  return (
    <section id="why" className="landing-section landing-band">
      <div className="landing-container">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="landing-eyebrow">Why Seentics</p>
          <h2 className="text-balance text-2xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Simple to start. Easy to trust.
          </h2>
        </div>

        <div className="mx-auto grid max-w-5xl divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {REASONS.map((reason) => (
            <div key={reason.title} className="px-1 py-9 md:px-8 md:py-10 md:first:pl-0 md:last:pr-0">
              <span className="mb-5 block h-1 w-8 rounded-full bg-primary" />
              <h3 className="mb-3 text-2xl font-extrabold tracking-tight text-foreground">{reason.title}</h3>
              <p className="text-base leading-relaxed text-muted-foreground">{reason.body}</p>
              <Link
                href={reason.href}
                {...(reason.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/75"
              >
                {reason.cta}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
