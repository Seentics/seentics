import Link from 'next/link';
import { ArrowRight, ActivitySquare, BarChart3, Check } from 'lucide-react';
import { config } from '@/lib/config';
import { ObserveGlyph } from './LandingHeader';

/**
 * The suite, before the prices.
 *
 * Pricing sells "the whole suite, or just analytics", but nothing above it said what
 * the other products were — Observability and Uptime only appeared in the header menu.
 * This names the three products, what each one does and where to start with it, so a
 * visitor who only wants analytics can ignore the rest and one who wants more can see
 * it exists before they read a price.
 *
 * Observability's purple and Uptime's green are those products' own brand colours (the
 * same ones the header menu uses); analytics keeps this app's primary.
 */
const PRODUCTS = [
  {
    name: 'Analytics',
    pitch: 'Understand your visitors and act on it.',
    points: ['Web analytics and funnels', 'Session replay and heatmaps', 'No-code automations and AI analysis'],
    cta: 'Start with analytics',
    href: '/signup',
    external: false,
    icon: BarChart3,
    tint: 'bg-primary text-primary-foreground',
  },
  {
    name: 'Observability',
    pitch: 'See what is happening inside your services.',
    points: ['Logs, metrics and distributed traces', 'OpenTelemetry ingestion', 'Grouped errors across every service'],
    cta: 'Explore Observability',
    href: config.observeUrl,
    external: true,
    icon: ObserveGlyph,
    tint: 'bg-[hsl(267_60%_47%)] text-white',
  },
  {
    name: 'Uptime',
    pitch: 'Know the moment your site goes down.',
    points: ['HTTP, API and SSL checks every 60 seconds', 'Alerts to Slack or SMS', 'A public status page'],
    cta: 'Explore Uptime',
    href: config.uptimeUrl,
    external: true,
    icon: ActivitySquare,
    tint: 'bg-[hsl(145_72%_38%)] text-white',
  },
] as const;

export default function SuiteSection() {
  return (
    <section id="suite" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="landing-eyebrow">The Seentics suite</p>
          <h2 className="landing-h2 mb-4">One suite. Use only what you need.</h2>
          <p className="landing-lead">
            Start with analytics, add Observability and Uptime when you are ready, or take all three
            on one plan for less than buying them separately.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PRODUCTS.map((product) => (
            <div key={product.name} className="landing-card flex flex-col p-6 sm:p-7">
              <span className={`mb-6 flex h-11 w-11 items-center justify-center rounded-xl ${product.tint}`}>
                <product.icon className="h-5 w-5" />
              </span>
              <h3 className="landing-h3 mb-2">{product.name}</h3>
              <p className="landing-body mb-5 text-muted-foreground">{product.pitch}</p>
              <ul className="mb-7 space-y-2.5">
                {product.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={product.href}
                {...(product.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/75"
              >
                {product.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Every product is available on its own or together.{' '}
          <Link href="#pricing" className="font-semibold text-primary hover:text-primary/75">
            See pricing
          </Link>
        </p>
      </div>
    </section>
  );
}
