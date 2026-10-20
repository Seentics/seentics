'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { HeroExplorer } from '@/components/landing/HeroExplorer';
import type { MockNavLabel } from '@/components/landing/mocks/MockSidebar';
import { useAuth } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';

/**
 * Pieces shared by the Bangladesh landing pages (/f-commerce and /bd): one deep green accent, the
 * `*marked*` copy, the start button and the analytics tabs.
 *
 * The accent is set as variables on the page root: `--fc` is the solid block behind marked words
 * and on buttons (white text on it in both themes), `--fc-text` the accent as text, `--fc-soft` /
 * `--fc-tint` the panel behind pictures and alternate bands.
 */
export const ACCENT = '[--fc:#0f6b4f] [--fc-text:#0f6b4f] [--fc-soft:#e7f1ed] [--fc-tint:#f5f7f6] dark:[--fc-text:#4fd1a1] dark:[--fc-soft:rgba(15,107,79,0.18)] dark:[--fc-tint:rgba(255,255,255,0.025)]';

export const solidBtn = 'inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[var(--fc)] px-6 text-[16px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
export const outlineBtn = 'inline-flex h-12 items-center justify-center gap-2 rounded-[10px] border px-6 text-[16px] font-semibold transition-colors hover:bg-[var(--lx-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export const panel = { borderColor: 'var(--lx-line-strong)', background: 'var(--lx-panel)' } as const;

/** Copy with `*marked*` words: a solid accent block in headings, accent-coloured text in body copy. */
export function Marked({ text, block = false }: { text: string; block?: boolean }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((part, i) =>
        part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
          <span
            key={i}
            className={block
              ? 'rounded-[0.14em] bg-[var(--fc)] px-[0.18em] text-white [-webkit-box-decoration-break:clone] [box-decoration-break:clone]'
              : 'font-semibold text-[var(--fc-text)]'}
          >
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** "Start free": sign-up that comes back to `next`, or straight there when signed in. */
export function StartLink({ label, openLabel, next = '/websites', className }: { label: string; openLabel: string; next?: string; className?: string }) {
  const { isAuthenticated } = useAuth();
  const [href, setHref] = useState('/signup');
  useEffect(() => {
    setHref(isAuthenticated
      ? next
      : `/signup?redirect_uri=${encodeURIComponent(`${window.location.origin}${next}`)}`);
  }, [isAuthenticated, next]);
  return (
    <Link href={href} className={className ?? solidBtn}>
      {isAuthenticated ? openLabel : label}
    </Link>
  );
}

export function Points({ points }: { points: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {points.map((p) => (
        <li key={p} className="flex items-start gap-2.5 text-[15px]" style={{ color: 'var(--lx-text)' }}>
          <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--fc-text)]" strokeWidth={3} />
          {p}
        </li>
      ))}
    </ul>
  );
}

/** The preview's sidebar for each website type, as the dashboard orders it (features/sidebar/profiles.ts). */
const PROFILE_ORDER: Record<'store' | 'fcommerce', readonly MockNavLabel[]> = {
  store: ['Overview', 'Conversions', 'Revenue', 'Funnels', 'Recording', 'Heatmaps', 'Integrations'],
  fcommerce: ['Overview', 'Conversions', 'Recording', 'Heatmaps', 'Funnels', 'Integrations'],
};

/**
 * The real dashboard, as the homepage hero shows it (HeroExplorer): the demo site's own pages in
 * the product window, with the sidebar of this website type and clickable between its screens.
 */
export function LiveDashboard({ profile, initial }: { profile: 'store' | 'fcommerce'; initial: MockNavLabel }) {
  // The preview pulls in the whole dashboard, and on a phone it is a third of its size and unreadable:
  // so it is left out below md (the page offers the Live Demo instead), and from md up mounts only
  // once it nears the viewport. Most visitors here come from Facebook ads, on phones, on mobile data.
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wide = window.matchMedia('(min-width: 768px)');
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      if (!wide.matches || observer) return;
      observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) { setShow(true); observer?.disconnect(); }
      }, { rootMargin: '400px' });
      observer.observe(el);
    };
    watch();
    wide.addEventListener('change', watch);
    return () => { observer?.disconnect(); wide.removeEventListener('change', watch); };
  }, []);
  return (
    <div ref={ref} className="hidden md:block">
      {show
        ? <HeroExplorer order={PROFILE_ORDER[profile]} initial={initial} />
        // Holds the window's place, so nothing jumps when it arrives.
        : <div aria-hidden className="aspect-[16/10] w-full rounded-xl bg-[var(--fc-soft)]" />}
    </div>
  );
}

/** The screen each tab opens on. */
const ANALYTICS_SCREENS = {
  overview: 'Overview',
  replays: 'Recording',
  heatmaps: 'Heatmaps',
  funnels: 'Funnels',
} as const satisfies Record<string, MockNavLabel>;

export type AnalyticsTab = { id: keyof typeof ANALYTICS_SCREENS; label: string; text: string };

export function AnalyticsTabs({ label, tabs, profile }: { label: string; tabs: AnalyticsTab[]; profile: 'store' | 'fcommerce' }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active] ?? tabs[0]!;
  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-center">
      <div role="tablist" aria-label={label} className="grid gap-2">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn('rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === active ? 'border-[var(--fc)] bg-[var(--fc-soft)]' : 'hover:bg-[var(--lx-line)]')}
            style={i === active ? undefined : { borderColor: 'var(--lx-line)' }}
          >
            <span className={cn('block text-[16px] font-semibold', i === active ? 'text-[var(--fc-text)]' : '')} style={i === active ? undefined : { color: 'var(--lx-text)' }}>{t.label}</span>
            <span className="lx-dim mt-1 block text-[14px] leading-relaxed">{t.text}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        <LiveDashboard profile={profile} initial={ANALYTICS_SCREENS[tab.id]} />
      </div>
    </div>
  );
}
