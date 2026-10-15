import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { IntegrationIcon } from '@/components/integrations/IntegrationIcon';
import { INTEGRATIONS, INTEGRATION_CATEGORIES } from '@/lib/integrations';

export default function IntegrationsPage() {
  return (
    <div className="landing-container py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">Integrations</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Works with the stack you already have
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          One script tag is all Seentics needs. For the platforms below there is a guide, and for
          stores and frameworks a plugin or package that also reports purchases and events.
        </p>
      </div>

      <div className="mt-14 space-y-12">
        {INTEGRATION_CATEGORIES.map((category) => {
          const items = INTEGRATIONS.filter((i) => i.category === category);
          if (!items.length) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
                {category}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="group flex items-start gap-3.5 rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <IntegrationIcon integration={item} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                        {item.name}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-16 rounded-xl border border-border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Not listed?</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          If your site lets you add a script to its pages, Seentics works there. Paste the tag and
          you are done.
        </p>
        <Link href="/docs/quick-start" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          Quick start <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
