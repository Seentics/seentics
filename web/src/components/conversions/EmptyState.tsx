'use client';

/** No platform connected yet: what this does, in three lines, and where to start. */
import Link from 'next/link';
import { SeenticsOnly } from '@/components/seentics-only';
import { Button } from '@/components/ui/button';
import type { Platform } from '@/features/conversions/types';
import { PLATFORM_ORDER, PLATFORMS } from './conversion-format';
import { useT } from '@/lib/i18n';
import { PlatformMark } from './parts';

export function EmptyState({ canEdit, onConnect }: { canEdit: boolean; onConnect: (platform: Platform) => void }) {
  const t = useT().conversions.empty;
  return (
    <div className="space-y-6">
      <ul className="surface grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {t.points.map((p) => (
          <li key={p.title} className="p-5">
            <p className="text-[13px] font-semibold text-foreground">{p.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="connect-heading">
        <h2 id="connect-heading" className="mb-3 text-sm font-semibold text-foreground">{t.connectHeading}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_ORDER.map((key) => {
            const info = PLATFORMS[key];
            return (
              <div key={key} className="surface flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <PlatformMark platform={key} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{info.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{info.api}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="mt-auto" onClick={() => onConnect(key)} disabled={!canEdit}>
                  {t.connect}
                </Button>
              </div>
            );
          })}
        </div>
        <SeenticsOnly>
          <p className="mt-4 text-xs text-muted-foreground">
            {t.newTo} <Link href="/docs/conversions" className="font-medium text-primary hover:underline">{t.howItWorks}</Link>
          </p>
        </SeenticsOnly>
      </section>
    </div>
  );
}
