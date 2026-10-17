import Link from 'next/link';

/**
 * The agency overview as it really is: screenshots of /agency?demo=1, dark and light, shown to match
 * the visitor's theme. A drawn mock drifted from the dashboard; these are the dashboard. Refresh them
 * with scripts/agency-screenshots.mjs whenever the overview changes.
 */
export function AgencyOverviewShot({ href }: { href: string }) {
  const img = 'block h-auto w-full';
  return (
    <Link
      href={href}
      aria-label="Open the agency demo"
      className="block overflow-hidden rounded-xl border border-[color:var(--lx-line-strong)] shadow-2xl shadow-black/20 transition-transform hover:-translate-y-0.5"
    >
      {/* Static export: plain <img>, two files, one hidden per theme. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/agency/overview-light.png" alt="The Seentics agency overview with demo data: clients, websites, visitors, events, alerts and top movers" width={2880} height={1800} loading="eager" className={`${img} dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/agency/overview-dark.png" alt="" aria-hidden width={2880} height={1800} loading="eager" className={`${img} hidden dark:block`} />
    </Link>
  );
}
