'use client';

/** No platform connected yet: what this does, in three lines, and where to start. */
import Link from 'next/link';
import { SeenticsOnly } from '@/components/seentics-only';
import { Button } from '@/components/ui/button';
import type { Platform } from '@/features/conversions/types';
import { PLATFORM_ORDER, PLATFORMS } from './conversion-format';
import { PlatformMark } from './parts';

const POINTS = [
  { title: 'What is sent', body: 'Purchases, popup leads, sign-ups and any custom event you map — from Seentics’ servers, so ad blockers and Safari can’t drop them.' },
  { title: 'How it is matched', body: 'The ad click ID (fbclid, gclid, ttclid, li_fat_id) from the landing page, the buyer’s email and phone hashed, and their IP and browser.' },
  { title: 'Only with consent', body: 'Only visitors who agreed to tracking are sent. A popup lead is sent only when its consent box was ticked.' },
];

export function EmptyState({ canEdit, onConnect }: { canEdit: boolean; onConnect: (platform: Platform) => void }) {
  return (
    <div className="space-y-6">
      <ul className="surface grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {POINTS.map((p) => (
          <li key={p.title} className="p-5">
            <p className="text-[13px] font-semibold text-foreground">{p.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="connect-heading">
        <h2 id="connect-heading" className="mb-3 text-sm font-semibold text-foreground">Connect a platform</h2>
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
                  Connect
                </Button>
              </div>
            );
          })}
        </div>
        <SeenticsOnly>
          <p className="mt-4 text-xs text-muted-foreground">
            New to server-side tracking? <Link href="/docs/conversions" className="font-medium text-primary hover:underline">How Conversions work</Link>
          </p>
        </SeenticsOnly>
      </section>
    </div>
  );
}
