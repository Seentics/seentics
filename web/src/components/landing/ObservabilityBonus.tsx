import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { config } from '@/lib/config';

/**
 * The second product, kept in proportion: analytics is what Seentics sells, and this is a line for
 * the SaaS teams that also want to see inside their backend. No demo frame, no pinned scroll.
 */
const POINTS = [
  'Logs, metrics and distributed traces',
  'OpenTelemetry ingestion from any service',
  'Errors grouped across every service',
];

export default function ObservabilityBonus() {
  return (
    <section id="observability" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto grid max-w-5xl items-center gap-8 border-y border-border py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-14 md:py-14">
          <div>
            <p className="landing-eyebrow">Also for SaaS teams</p>
            <h2 className="mb-3 text-balance text-2xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
              Running a SaaS? See inside it too.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Observability is an add-on, not a requirement. Take it only if you also want to see what is happening in the
              services behind your product.
            </p>
            <Link
              href={`${config.observeUrl}/projects/demo`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(267_60%_47%)] hover:opacity-80 dark:text-[hsl(267_75%_70%)]"
            >
              Try the Observability demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-foreground/90 sm:text-base">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(267_60%_47%)] dark:bg-[hsl(267_75%_70%)]" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
