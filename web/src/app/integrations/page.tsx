'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { IntegrationIcon } from '@/components/integrations/IntegrationIcon';
import { useT } from '@/lib/i18n';
import { INTEGRATIONS, INTEGRATION_CATEGORIES } from '@/lib/integrations';

export default function IntegrationsPage() {
  const t = useT().site.integrations;
  return (
    <div className="landing-container py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">{t.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {t.lead}
        </p>
      </div>

      <div className="mt-14 space-y-12">
        {INTEGRATION_CATEGORIES.map((category) => {
          const items = INTEGRATIONS.filter((i) => i.category === category);
          if (!items.length) return null;
          return (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
                {t.categories[category]}
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
                        {t.descriptions[item.name] ?? item.description}
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
        <h2 className="text-lg font-semibold text-foreground">{t.notListed}</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {t.notListedBody}
        </p>
        <Link href="/docs/quick-start" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          {t.quickStart} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
